# Seller fraud runbook

What to do when a seller is suspected of fraud: fake/never-shipped orders,
manipulated reviews, bank-detail fraud, or abusing the COD/RTO flow to
extract payouts on goods never actually sent. (For counterfeit/spurious
*parts* specifically — as opposed to fraud in how the seller operates —
see the [spurious-part escalation runbook](./spurious-part-escalation.md);
the two often overlap and can be investigated together.)

## Signals that should trigger a look

- A spike in `subOrders` for one seller stuck at `packed`/`shipped` with no
  real courier movement (AWB never scans past label-created).
- Admin Console → Sellers shows an unusually high
  `spuriousReportsCount`/`warningsCount`, or `trustScore.breakdown` shows a
  sharply dropping `slaComponent`/`cancellationComponent`
  (`functions/src/trust/computeSellerTrustScores.ts`).
- A buyer-side report via the [support ticket queue](../../apps/web/src/pages/admin/AdminSupportTicketsPage.tsx)
  (category `seller_conduct`) or a dispute
  (`functions/src/disputes/openDispute.ts`) alleging the seller never
  shipped, shipped an empty/wrong box, or pressured the buyer to cancel a
  legitimate return.
- A cluster of reviews for one seller that read as fabricated (same
  phrasing, posted in a tight time window, all 5-star with no verified
  purchase pattern) — `onReviewWrite.ts`'s auto-screening catches
  profanity/contact-info/PII, not this kind of coordinated pattern, so it's
  a manual review call.
- Bank account changed shortly before a large payout is due (see the
  [payout failure runbook](./payout-failure.md) for the mechanics of
  bank-detail verification).

## Investigation

1. **Freeze first, investigate second, if the exposure is live and
   growing.** `adminUpdateSeller` (`functions/src/seller/adminUpdateSeller.ts`)
   → `suspend` immediately revokes the seller's `sellerId` custom claim
   (via `onSellerStatusChange.ts`), which blocks them from accepting new
   orders or accessing the seller dashboard, without deleting any data.
   This is reversible (`reinstate`) if the investigation clears them — bias
   toward freezing when live orders/payouts are at risk, since the cost of
   a wrongful pause is much lower than the cost of a payout that can't be
   clawed back.
2. **Pull the evidence trail**: `auditLogs` (every admin mutating action is
   logged — `functions/src/util/auditLog.ts`), the seller's `subOrders`
   history, `disputes`/`spuriousReports` against them, and — if bank fraud
   is suspected — the KYC documents via `getSellerKycDocumentUrls.ts`
   (audit-logged read, per the README's Phase 23 note on KYC-document
   access logging).
3. **Cross-check the onboarding application** (`sellerApplications/{ownerUserId}`)
   against what's now on the live `sellers/{id}` doc — a legal-name/GSTIN/
   bank mismatch that crept in after approval (there's no post-onboarding
   "edit registered address" flow — see README's Phase 24 notes) is itself
   a red flag worth investigating, not just a data-quality issue.
4. **For COD/RTO abuse specifically**: `flagReturnAbuseBuyers.ts` and the
   `codAbuseFlag`/RTO-threshold logic in `config/returns` are built for
   *buyer*-side abuse, not seller-side — a seller inflating RTO rates to
   game payouts needs a manual trend check (RTO rate over time, per
   seller) since there's no automated seller-side equivalent yet.

## Enforcement

Reuse the existing anti-counterfeit penalty ladder
(`functions/src/trust/resolveSpuriousReport.ts`) as the enforcement
vocabulary even for non-counterfeit fraud, since it already has the right
shape and admin UI (Admin Console → Spurious Reports):

1. **Warning** — first substantiated issue, low severity.
2. **Listing removal** — the specific fraudulent listing(s).
3. **Category ban** (`bannedCategorySlugs`) — repeated issues in one
   category.
4. **Payout hold** (`payoutHold`/`payoutHoldReason`) — freezes settlement
   without suspending the account, useful mid-investigation when you want
   evidence to keep flowing (orders still visible) but no money to move.
5. **Delisting** (`status: 'suspended'`, same mechanism as step 1's manual
   freeze) — confirmed fraud.

For anything that looks like actual financial crime (fabricated bank
details, identity fraud on KYC documents), escalate outside the app: file
with the nearest cyber crime cell (cybercrime.gov.in) and preserve the
audit trail — don't let a later data-restore or cleanup job touch the
affected `auditLogs`/`sellerApplications` records.

## After resolution

- File an incident note per [rollback.md](./rollback.md)'s convention.
- If the fraud pattern reveals a systemic gap (e.g. bank-detail changes
  should require re-KYC, or COD abuse detection should extend to sellers),
  open it as a follow-up — this runbook documents the response, not a
  commitment that every gap found this way gets fixed immediately.
