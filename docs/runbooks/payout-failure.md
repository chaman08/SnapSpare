# Payout failure runbook

What to do when a seller reports a missing/failed payout, or the
`payout_failed` notification type fires.

## How payouts work today (read this first)

**No live bank-transfer payout provider is wired in yet** — see the
README's "Deliberately left out" section for Phase 12. Concretely:

- Commission is computed and posted to each seller's ledger at *delivery*
  (`functions/src/payments/applyCommissionOnDelivered.ts`), and TCS/TDS are
  posted at invoice time (`functions/src/tax/ledger.ts`) — by the time a
  payout runs, every deduction has already happened and a payout only ever
  needs to pay out `ledgers/{sellerId}.currentBalancePaise`.
- `runSellerPayouts` (`functions/src/payments/runSellerPayouts.ts`,
  triggered manually via `triggerPayoutRun`
  (`functions/src/payments/triggerPayoutRun.ts`) from Admin Console →
  Finance) computes what each seller is owed and writes `payoutRuns` /
  `payouts` records, then calls the swap-point adapter in
  `functions/src/payments/provider.ts`.
- **That provider is mock-only in this codebase.** Before a real payout
  provider (RazorpayX, Cashfree Payouts, or a manual NEFT/RTGS batch export)
  is integrated, "payout failure" in production means **the payout batch
  ran and recorded what's owed, but no money actually moved** — this is a
  known gap, not a bug, until that integration lands. Treat any pre-launch
  payout-failure report as "check whether the real provider is wired in
  yet" before debugging further.

## Once a real payout provider is integrated, triage like this

1. **Find the payout run.** Admin Console → Finance → payout runs, or query
   `payoutRuns/{runId}` and its per-seller `payouts` entries directly.
   Note the failure reason recorded against the specific seller's line.
2. **Common failure classes and where they come from:**
   - **Invalid/closed bank account** (`sellers/{id}.bankAccount` — IFSC,
     account number): the provider's API will return a specific rejection
     code. Cross-check against what the seller submitted during onboarding
     (`sellerApplications/{ownerUserId}.bank`) — if it's a genuine account
     change, that has to go through a proper re-verification flow, not a
     silent field edit (bank details are Cloud-Function-only writes for
     exactly this reason — see `firestore.rules`' `sellers/{sellerId}`
     section).
   - **Ledger balance went negative between computation and payout** (a
     refund or dispute-forced debit landed in the gap): re-run
     `getPayoutStatement` (`functions/src/payments/getPayoutStatement.ts`)
     for the seller to see the current ledger state before retrying —
     don't just re-submit the stale amount.
   - **Provider-side outage**: check the provider's own status page; retry
     once it recovers, don't work around it with a manual transfer unless
     the seller's payout is time-critical (SLA/legal reasons), in which
     case reconcile the ledger manually afterward so the next automated
     run doesn't double-pay.
3. **Never mark a payout `paid` in Firestore without confirming the money
   actually moved** on the provider side (a bank reference number / UTR).
   `payout_paid`/`payout_failed` notifications are queued directly from
   this status, so a false `paid` status actively misleads the seller.

## Seller-facing communication

- The seller's own view is Seller Dashboard → Payments
  (`SellerPaymentsPage`), reading `getPayoutStatement`. Point sellers there
  first — most "where's my payout" questions are answered by the ledger
  detail already surfaced.
- If a payout is delayed for a systemic reason (provider outage, a backlog),
  post a `config/app.bannerMessage` update so every seller sees it, rather
  than fielding the same support ticket repeatedly.

## After resolution

- File an incident note per [rollback.md](./rollback.md)'s convention,
  including which sellers/amounts were affected and whether any ledger
  correction was needed.
