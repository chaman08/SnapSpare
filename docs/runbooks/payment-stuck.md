# Payment stuck runbook

What to do when a buyer reports (or the payment-success-rate alert fires
for) an order that's stuck mid-payment: Razorpay took the money but the
order never moved past `pending_payment`, or the buyer was charged twice.

## How this is supposed to work

1. `createOrder` (`functions/src/checkout/createOrder.ts`) creates the order
   in `pending_payment` and reserves stock, then opens Razorpay Standard
   Checkout client-side.
2. On success, the client calls `confirmPayment`
   (`functions/src/checkout/confirmPayment.ts`) — but this is a
   **best-effort fast path**, not the source of truth. The buyer can close
   the tab, lose signal, or the call can fail, and the order stays
   `pending_payment` in the UI even though Razorpay actually captured the
   payment.
3. `razorpayWebhook` (`functions/src/checkout/razorpayWebhook.ts`) is the
   **authoritative** confirmation path — Razorpay calls it server-to-server
   regardless of what happened in the buyer's browser. Every raw delivery is
   persisted to `webhookEvents` (`packages/shared/src/schemas/webhookEvent.ts`)
   *before* processing, specifically so a stuck payment is always
   diagnosable from Firestore even if the processing step itself failed.
4. `releaseExpiredReservations` (`functions/src/checkout/releaseExpiredReservations.ts`)
   auto-cancels an order and releases its stock reservation after
   `config/app.reservationExpiryMinutes` (default 15) if nothing ever
   confirms it — most "stuck" reports resolve themselves within that window
   if the payment genuinely never landed.

## Triage

1. **Find the order.** Admin Console → Orders (`/admin/orders`) or query
   `orders/{orderId}` directly. Note `status` and `paymentMethod`.
2. **Check `webhookEvents` for a matching delivery.** Query by
   `razorpayOrderId`/`razorpayPaymentId` (see the order's `razorpay` field).
   - **No webhook event at all**, order still `pending_payment`, and it's
     been longer than `reservationExpiryMinutes`: the payment most likely
     never completed on Razorpay's side (buyer abandoned checkout). Confirm
     in the [Razorpay Dashboard](https://dashboard.razorpay.com) →
     Payments, searching by order/payment id. If Razorpay shows no
     successful capture either, this is expected behavior — the buyer needs
     to retry. If Razorpay *does* show a captured payment but no webhook
     ever arrived, treat it as a webhook delivery failure — see the
     [webhook backlog runbook](./webhook-backlog.md).
   - **A webhook event exists but `processedAt` is unset / an error is
     logged**: the delivery arrived but processing threw. Check Cloud
     Logging for the `razorpayWebhook` function around that timestamp for
     the stack trace, fix the underlying cause if it's a bug, then
     re-invoke the same logic manually (see "Manual reconciliation" below)
     — **never** ask Razorpay to re-fire the webhook as the primary fix,
     since idempotency on replays is what protects against double-crediting
     if it *does* eventually succeed on retry.
   - **A webhook event exists and looks processed, but the order still
     shows `pending_payment`**: check whether the event was for a
     *different* order (shared idempotency keys, or the buyer retried
     checkout and generated a second Razorpay order for the same cart) —
     `createOrder`'s `idempotencyKey` should prevent this, but confirm.
3. **Double-charge report**: search `webhookEvents` and the Razorpay
   Dashboard for two `payment.captured` events against the same order. If
   confirmed, the second capture needs a manual Razorpay refund (Dashboard →
   Payments → Refund) — this app's `refundEngine`
   (`functions/src/payments/refundEngine.ts`) only ever refunds against an
   order it created, not an out-of-band duplicate charge, so this step is
   outside app code.

## Manual reconciliation

If Razorpay confirms a payment captured but the app never recorded it:

1. Re-derive what `razorpayWebhook` would have done for a
   `payment.captured`/`order.paid` event (transition the order to
   `confirmed`, commit the stock reservation, queue the
   `payment_confirmed` notification) — do this via a one-off authenticated
   admin script using the Admin SDK, calling the same internal transition
   function the webhook handler uses (don't hand-write a parallel state
   change; import and call the real transition so every side effect —
   ledger, notification, invoice trigger — still fires).
2. After the fix, confirm the order shows `confirmed` and the buyer got
   their `payment_confirmed` notification (check `notificationsQueue`).
3. File an incident note (see "After any incident" below) — a webhook that
   silently failed to process is worth understanding, not just patching
   once.

## Prevention / what to watch

- The **payment success-rate alert** (see
  [monitoring & alerting](../ops/monitoring-alerting.md)) is the earlier
  warning sign — investigate it before individual stuck-payment reports
  start arriving.
- `withSentry` (`functions/src/monitoring/withSentry.ts`) wraps
  `confirmPayment` — Sentry issues there are the fastest way to spot a
  systemic problem (e.g. a Razorpay API shape change) versus an isolated
  one-off.

## After any incident

- Note what broke, how many orders were affected, and whether a refund or
  manual reconciliation was needed, in the same place other incidents are
  logged (see [rollback.md](./rollback.md)'s "After any rollback" section
  for the convention this follows).
