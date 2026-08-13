# Spurious (counterfeit) part escalation runbook

What to do when a buyer reports receiving a fake/counterfeit part, via
"Report spurious part" on an order or listing.

## How the flow already works (this is largely built — see Phase 17)

1. **Buyer report**: `reportSpuriousPart`
   (`functions/src/trust/reportSpuriousPart.ts`) opens a `spuriousReports`
   doc, tied to the order/listing/seller.
2. **Seller response window**: `respondToSpuriousReport.ts` lets the seller
   reply with their side (e.g. proof of authorized-distributor sourcing)
   before an admin decides.
3. **Admin investigation queue**: Admin Console → Spurious Reports
   (`AdminSpuriousReportsQueuePage` / `AdminSpuriousReportDetailPage`) is
   where this runbook's manual work happens — evidence photos via
   `getSpuriousReportEvidenceUrls.ts` (audit-logged read).
4. **Resolution**: `resolveSpuriousReport.ts` applies the penalty ladder
   (warning → listing_removal → category_ban → payout_hold → delisting,
   tracked on the seller doc's `warningsCount`/`spuriousReportsCount`/
   `bannedCategorySlugs`/`payoutHold`/`status`) and closes the report.
5. Separately, `verifyPartAuthenticity`
   (`functions/src/trust/verifyPartAuthenticity.ts`) is a mock-only
   QR/hologram verification adapter (`functions/src/trust/authenticityProvider.ts`
   is the real-integration swap point) — don't confuse a buyer-initiated
   report (this runbook) with that separate, not-yet-real verification
   check.
6. The "Genuine Part" badge (`submitBrandAuthorization.ts` /
   `reviewBrandAuthorization.ts`) is evidence *for* a seller's defense, not
   proof against a report — a badge only means a verified brand-authorization
   document was on file, not that every unit that seller ships is
   guaranteed genuine.

## What this runbook adds: the human investigation checklist

The code above builds and tracks the case; it doesn't tell you how to
*judge* one. When a report lands in the admin queue:

1. **Compare the buyer's photos against the listing's own images and the
   catalogue part's reference images/OEM number.** Look for: incorrect
   branding/logo placement, missing or mismatched hologram/QR (if the
   brand uses one), packaging quality inconsistent with the genuine
   product, or a part number that doesn't match what was ordered.
2. **Check the seller's sourcing evidence** from their response
   (`respondToSpuriousReport.ts`) — an invoice from an authorized
   distributor is meaningful evidence; a generic claim of "we source from
   a reliable vendor" is not.
3. **Check for a pattern**: has this seller had prior spurious reports
   (`spuriousReportsCount`, and the report history in the admin detail
   view)? A first-ever report against an otherwise-clean seller with weak
   evidence might genuinely be a buyer mistake (wrong expectations, a
   legitimate but unfamiliar-looking OEM variant) rather than fraud — don't
   default to the harshest penalty on a single ambiguous report.
4. **When in doubt, and the brand is known/reachable**, it's reasonable to
   pause on a listing (informal hold, not yet a penalty-ladder action)
   while seeking more evidence rather than resolving under time pressure —
   there's no strict SLA enforced on `spuriousReports` the way there is on
   `disputes`, so taking the extra day to get it right is available to you.
5. **Apply the penalty proportionate to severity and pattern**, not just
   "one report = one warning": a single credible report from a seller with
   prior warnings should escalate faster than the ladder's default
   next-step, using `resolveSpuriousReport.ts`'s ability to jump straight
   to a harsher action when the evidence warrants it.

## Buyer-facing outcome

The buyer's own order still goes through the ordinary return/refund flow
(see the [Return & Refund Policy](../../packages/seed/src/seeders/seedLegalContent.ts))
regardless of how the spurious investigation resolves — don't make the
buyer's refund contingent on the seller-side investigation finishing first.

## Escalation beyond the platform

For a confirmed counterfeit of a registered trademark, the brand owner may
have independent legal remedies (a trademark infringement complaint) —
this is out of scope for the platform to pursue on the brand's behalf, but
worth mentioning to the brand's authorized-authorization contact if one
exists on file (`brandAuthorizations`).

## After resolution

File an incident note per [rollback.md](./rollback.md)'s convention if the
report resulted in delisting or a payout hold — those are consequential
enough to warrant a record beyond the `auditLogs` entry `resolveSpuriousReport.ts`
already writes.
