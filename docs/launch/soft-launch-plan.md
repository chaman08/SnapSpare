# Soft-launch plan

One city, 20–30 sellers, invite-only buyers, two weeks of daily order
review before opening up. This document is the operating plan; it assumes
everything in this Phase 24 change (legal pages, support ticketing,
runbooks, monitoring) is live in the target environment before day 1.

## Goal

Prove the full order lifecycle — discovery, quantity-slab pricing,
checkout, seller fulfilment, shipping, returns, payouts, tax invoicing —
works end-to-end against real sellers and real (but small, trusted) buyer
demand, with a human reviewing every order daily, before removing the
invite gate and opening the marketplace broadly.

## Why one city first

Concentrating sellers and buyers in a single serviceable area:

- Makes shipping/serviceability issues (pincode coverage, courier
  reliability) visible fast instead of thin across the whole country.
- Lets the ops team physically visit a seller if something looks wrong
  (a fraud signal, a fulfilment problem) — not realistic at national scale
  on day 1.
- Keeps support ticket volume small enough that every ticket gets a fast,
  high-quality reply from a small team, rather than testing the SLA
  machinery under real load before the product itself is proven.

## Pre-launch checklist

Everything below must be true before inviting the first real seller —
treat this as a gate, not a suggestion:

- [ ] **Legal pages reviewed by a lawyer** qualified in Indian consumer/IT/
      data-protection law — the seeded content
      (`packages/seed/src/seeders/seedLegalContent.ts`) is a working draft,
      not sign-off-ready as shipped. See that file's header comment.
- [ ] **Company legal name, registered address, CIN/registration number,
      and Grievance Officer's real name/contact** filled in, replacing every
      `[... — to be filled in before go-live]` placeholder in
      `config/app` (`companyLegalName`, `companyRegisteredAddress`,
      `companyRegistrationNumber`, `grievanceOfficer`) and in the seeded
      Grievance Redressal / Terms of Use / Privacy Policy pages.
- [ ] **Hindi legal text reviewed by a certified translator** — see
      `seedLegalContent.ts`'s header comment; the seeded `hi` text is a
      working translation.
- [ ] **`config/app.supportPhone`/`supportEmail`/`supportWhatsappNumber`/
      `supportBusinessHours`** point at real, staffed channels — not the
      seeded placeholders.
- [ ] **`config/app.siteOrigin` and `robots.txt`** point at the real
      production domain (see README's Phase 22 notes — still placeholders
      as of Phase 22).
- [ ] **Every item in README's "Deliberately left out" list that blocks
      real money movement** is resolved for this environment specifically:
      a real payout provider (see
      [payout-failure.md](../runbooks/payout-failure.md) — mock-only as of
      this phase), `staging`/`prod` Firebase projects actually provisioned
      (Phase 23 note), and GST rates in `config/tax` reviewed by a
      chartered accountant (README's "Tax compliance" section).
- [ ] **Monitoring & alerting live** — run
      `scripts/setup-monitoring.sh` against the target environment and
      confirm each alert's test-fire actually reaches the on-call channel
      (see [monitoring-alerting.md](../ops/monitoring-alerting.md)'s
      "Verifying it worked" section).
- [ ] **Runbooks read by whoever is on call** — at minimum
      [site-down.md](../runbooks/site-down.md),
      [payment-stuck.md](../runbooks/payment-stuck.md), and
      [rollback.md](../runbooks/rollback.md).
- [ ] **App Check enforced** with a real `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`
      (README's Phase 23 note — every callable already enforces it once
      this is set; it must be set *before* this deploy, not after).
- [ ] **Seller and buyer invite lists prepared** (see below) — don't start
      recruiting sellers the same week you intend to launch; onboarding
      review (KYC, GSTIN) takes real turnaround time per applicant.

## City and seller selection

- Pick a city with: existing team/founder presence or a local ops contact,
  a Shiprocket-serviceable pincode set with good courier density, and a
  known cluster of auto-parts sellers (an existing market/bazaar area is
  ideal — easier to recruit sellers who already know and trust each
  other, and word-of-mouth does real work here).
- Target **20–30 sellers**, weighted toward a mix of part categories
  (not all-brake-pads) so the catalogue has enough breadth for the
  quantity-slab pricing differentiator to actually matter to buyers placing
  varied orders.
- Every seller goes through the real onboarding flow
  (`/sell/apply` → admin review → approval) — no shortcuts or seeded
  fake sellers in this environment. This is the first real test of that
  pipeline under non-synthetic conditions.
- Prioritize sellers willing to respond fast during the two-week window —
  slow SLA acceptance during soft-launch skews the buyer experience and
  the trust-score data this cohort seeds.

## Buyer invite approach

- **Invite-only**: no public sign-up promotion, no paid acquisition, no
  SEO/discoverability push (the Phase 22 sitemap/landing-page machinery
  should stay live but isn't the acquisition channel here).
- Recruit from: mechanics/garages/fleet operators already known to the
  local ops contact, plus a small number of retail vehicle owners for
  breadth across the `buyerType` groups the product targets.
- Target a buyer:seller ratio that guarantees every seller gets real order
  volume — an idle seller during a two-week evaluation window teaches you
  nothing and risks losing that seller's confidence in the platform.
- Send invites in a staggered ramp (a handful on day 1, more through the
  first week) rather than all at once — an order-volume spike before the
  team has validated the fulfilment loop on day 1 orders is a bad way to
  discover a bug.

## The two-week daily order review

For every calendar day of the two weeks, someone on the team reviews,
by hand:

1. **Every order placed that day** — status, whether it reached the
   expected next state on schedule (accepted within SLA, packed, shipped),
   and whether pricing/tax/shipping figures look sane (spot-check a few
   against manual calculation, don't just trust the UI rendered them
   correctly).
2. **Every support ticket and dispute opened that day** — read the actual
   content, not just the count; look for a pattern across tickets (the
   same confusing UI step, the same seller, the same category) more than
   any single ticket in isolation.
3. **Payment success rate and any stuck-payment reports** (see
   [payment-stuck.md](../runbooks/payment-stuck.md)) — this is the metric
   the automated alert (see monitoring doc) will eventually watch
   unattended; during soft-launch, a human reviewing it daily is the real
   safety net given the low volume makes the automated percentage-based
   alert unreliable.
4. **Any seller SLA breach or auto-cancellation** — was it a seller
   problem (slow to respond) or a product problem (confusing dashboard,
   missing notification)?
5. **Anything that required manual intervention** (a runbook was used, an
   admin force-action was taken) — log it, and ask whether it's a one-off
   or something that needs a product fix before opening up.

Keep a running log (a shared doc/sheet is fine — no tooling requirement
here) of each day's review with a one-line summary and any action items.
At the end of the two weeks, this log **is** the go/no-go evidence for
opening up.

## Go/no-go criteria at the end of two weeks

Move to the next phase (removing the invite gate, or a second-city
soft-launch — team's call) only if, over the two-week window:

- No unresolved data-integrity incident (a wrong charge, a lost order, a
  payout mismatch) that hasn't been fully understood and fixed.
- Payment success rate, seller SLA-acceptance rate, and return rate are
  each in a range the team judges healthy relative to this order volume
  (there's no universal "correct" number here at this stage — the daily
  log is what calibrates the team's judgment).
- No open critical/high-severity bug found during the window is still
  unfixed.
- Support ticket volume and content suggest the product is understandable
  without hand-holding, not that every buyer needed a human to complete an
  order.

If the criteria aren't met, extend the soft-launch window rather than
opening up on a fixed calendar date regardless of what the daily reviews
found — the two weeks is a minimum evaluation period, not a deadline to
hit no matter what.
