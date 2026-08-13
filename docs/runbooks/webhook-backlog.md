# Webhook backlog runbook

What to do when inbound webhooks (Razorpay payments, Shiprocket shipment
tracking) pile up unprocessed — a spike in `webhookEvents` docs stuck at
`status: 'received'` or `'failed'`, or the function error-rate alert firing
on `razorpayWebhook` / `shiprocketWebhook`.

## Where webhooks land in this codebase

| Source | Function | Raw log | Idempotency |
| --- | --- | --- | --- |
| Razorpay (payments, refunds, Khata repayments) | `functions/src/checkout/razorpayWebhook.ts` | `webhookEvents/{id}` | doc-id claim via transactional `create` — see `webhookEvent.ts`'s header comment |
| Shiprocket (shipment status) | `functions/src/shipping/shiprocketWebhook.ts` | — (updates `subOrders`/shipment tracking directly; see `reconcileAwbTracking.ts` for the polling fallback) | status-transition guard, not a separate raw log |

Both are `onRequest` functions (not `onCall`) — they're hit directly by the
gateway's servers, so App Check/callable auth doesn't apply; signature
verification (`signatureValid` on `webhookEvents`) is the trust boundary
instead.

## Diagnose the shape of the backlog

1. **Query `webhookEvents` by status.** A large count of `status: 'received'`
   (claimed but never finished processing) points to the function crashing
   or timing out mid-processing — check Cloud Logging for
   `razorpayWebhook` around the earliest stuck timestamp. A large count of
   `status: 'failed'` with a populated `error` field means processing ran
   and threw a handled exception — read the `error` text, it's usually
   specific (a missing order, a schema mismatch, a downstream call
   failing).
2. **Check whether it's one bad deploy or ongoing.** Correlate the backlog's
   start time against recent deploys (`.github/workflows/deploy.yml` run
   history) the same way [rollback.md](./rollback.md)'s pre-rollback
   checklist does. If a specific commit introduced the failure, that's a
   [rollback](./rollback.md), not a backlog to drain.
3. **Check Razorpay/Shiprocket's own dashboard for delivery retries.** Both
   gateways retry a failing webhook endpoint on their own schedule
   (Razorpay: exponential backoff over ~24 hours; Shiprocket: similar). If
   Cloud Functions itself is down or erroring on *every* request (a 5xx),
   the gateway's own retry queue is doing useful work already — fixing the
   root cause and letting the natural retries land is often simpler than
   manual replay.

## Draining a backlog after the root cause is fixed

- **Razorpay**: from the Razorpay Dashboard → Webhooks, most events can be
  manually resent for a given delivery. Since `webhookEvents` claims by
  doc-id (idempotent), a resend of an event already marked `processed` is a
  safe no-op — resending liberally to close gaps is fine.
- **Failed-but-processed-adjacent events** (the code ran but an exception
  interrupted a side effect, e.g. the order updated but the notification
  didn't queue): don't just flip `status` to `processed` by hand — that
  hides a real gap. Either resend from Razorpay (safe, per above) or run
  the specific missing side effect manually via an Admin SDK script, then
  update the `webhookEvents` doc's `status`/`processedAt` to reflect what
  actually happened.
- **Shiprocket**: no raw event log to replay from — `reconcileAwbTracking`
  (`functions/src/shipping/reconcileAwbTracking.ts`) is the scheduled
  polling fallback that self-heals any shipment whose webhook-driven status
  fell behind, by pulling current status directly from Shiprocket's API. If
  the backlog is Shiprocket-side, confirm this scheduled function is
  running (Cloud Scheduler → job history) rather than trying to replay
  individual webhook deliveries.

## After the backlog clears

- Re-run the affected order/shipment through its normal state and confirm
  it landed correctly (payment confirmed, invoice generated, shipment
  tracking current) — a cleared backlog isn't the same as a verified-correct
  one.
- If the root cause was a code bug, fix forward on `main` and add a
  regression test covering the specific payload shape that broke — see
  `functions/src/orders/__tests__` or `functions/src/tax/__tests__` for
  this codebase's existing test-file pattern.
- File an incident note per [rollback.md](./rollback.md)'s convention.
