# SnapSpare

Auto parts marketplace for India — quantity-slab pricing, buyer/seller/admin roles.
Phase 0: project scaffold. Phase 1: shared domain schemas. Phase 2: authentication & roles.

## Stack

- **apps/web** — React 18, Vite, TypeScript (strict), Tailwind, shadcn/ui, React Router v6,
  TanStack Query v5, Zustand, react-hook-form + zod, i18next (en/hi), Recharts.
- **functions** — Firebase Cloud Functions v2, TypeScript, Node 20.
- **packages/shared** — zod schemas and derived types shared by web and functions, built with tsup.
- **Firebase**: Auth (phone OTP), Firestore, Storage, FCM, App Check, Hosting. Region `asia-south1`.
- **Search**: Typesense Cloud (synced from Firestore in a later phase).
- **Payments**: Razorpay. **Shipping**: Shiprocket. **Messaging**: WhatsApp Cloud API + MSG91.

## Prerequisites

- Node.js 20.x
- pnpm 9.x (`corepack enable pnpm` or `npm i -g pnpm`)
- Firebase CLI (installed as a repo devDependency, available via `pnpm exec firebase`)
- A Firebase project (already provisioned: `snapspare-edcc1`, aliased as `dev` in `.firebaserc`)

## Setup

1. Install dependencies for every workspace package:

   ```bash
   pnpm install
   ```

2. Copy the web app env template and fill in Firebase web config (from Firebase console →
   Project settings → Your apps → SDK config):

   ```bash
   cp apps/web/.env.example apps/web/.env
   ```

   Set `VITE_USE_EMULATORS=true` while developing locally against the emulator suite.

3. Log in to Firebase and confirm the `dev` project alias resolves:

   ```bash
   pnpm exec firebase login
   pnpm exec firebase use dev
   ```

4. Build the shared package once so `apps/web` and `functions` can resolve
   `@snapspare/shared` (repeat after changing anything in `packages/shared`):

   ```bash
   pnpm --filter @snapspare/shared build
   ```

5. Start the emulator suite (Auth, Firestore, Functions, Storage, Hosting, Pub/Sub) in one
   terminal:

   ```bash
   pnpm dev:emulators
   ```

6. Start the web app in another terminal:

   ```bash
   pnpm dev
   ```

   Web app: http://localhost:5173 · Emulator UI: http://localhost:4000

## Scripts (run from repo root)

| Script                  | What it does                                              |
| ----------------------- | ---------------------------------------------------------- |
| `pnpm dev`               | Starts the Vite dev server for `apps/web`                  |
| `pnpm dev:emulators`     | Starts the full Firebase emulator suite                    |
| `pnpm build`             | Builds every workspace package (topological order)         |
| `pnpm lint`              | Lints every workspace package                               |
| `pnpm typecheck`         | Type-checks every workspace package                          |
| `pnpm test`              | Runs unit tests in every workspace package                    |
| `pnpm deploy:functions`  | Builds and deploys Cloud Functions to the active project    |
| `pnpm deploy:hosting`    | Builds and deploys `apps/web` to Firebase Hosting            |
| `pnpm test:rules`        | Runs Firestore security rules tests against a throwaway emulator |

## Repo layout

```
apps/web             Vite + React app (feature-folder layout under src/features)
functions            Cloud Functions v2 (TypeScript, Node 20)
packages/shared      Zod schemas + derived types, consumed via @snapspare/shared
packages/rules-tests Firestore security rules tests (@firebase/rules-unit-testing)
firebase.json        Hosting / Functions / Firestore / Storage / emulator config
firestore.rules      Firestore security rules — see "What's open" below
storage.rules        Storage security rules (still closed by default)
```

Inside `apps/web/src`, features live at
`features/{catalog,cart,checkout,orders,seller,admin,auth}/{components,hooks,api,types}`.

## Conventions

- All money is **integer paise**, never floats. See `packages/shared/src/types/money.ts`.
- Pricing/tax/discount/total math happens **server-side only**, in Cloud Functions.
- Every Firestore write path needs a matching security rule added in the same change.
- Every list screen needs a loading skeleton, an empty state with a next action, and an
  error state with retry — see `apps/web/src/components/states`.
- All user-facing strings go through i18next (`apps/web/src/locales/{en,hi}/common.json`).

## Auth setup (Phase 2)

- **Identity Platform blocking functions**: `functions/src/auth/onUserCreate.ts` uses
  `beforeUserCreated`, which requires Identity Platform's blocking-functions feature to be
  turned on in the Firebase console (Authentication → Settings → Blocking functions) — this
  can't be enabled from code. Without it, new sign-ups won't get a `users/{uid}` profile
  document or their initial `buyer` custom claim.
- **Google sign-in**: enable the Google provider in Firebase console → Authentication →
  Sign-in method.
- **Custom claims**: `role` (`buyer`/`seller`/`admin`) and `sellerId` live only in the Auth ID
  token, never trust the denormalized `users/{uid}.roles` Firestore field for authorization.
  `setUserRole` (admin-only callable) and `onSellerStatusChange` (Firestore trigger) are the
  only two places claims are set. The client must force-refresh its ID token
  (`AuthProvider`'s `refreshClaims()`) after either fires.
- **Pincode master data**: `lookupPincode` reads a `pincodes/{pincode}` master collection
  that isn't seeded — Phase 2 doesn't include a bulk import of India's ~19,000 pincodes, so
  address auto-fill will report "not found" until that collection is populated.

### What's open in `firestore.rules`

Phase 2 opens exactly what its own code depends on — everything else stays closed:

- `users/{uid}` — owner or admin can read; owner can update everything **except**
  `roles`/`primaryRole`/`status`/`createdAt` (role/status changes only happen server-side).
  Client can never `create` or `delete` a user doc directly.
- `users/{uid}/addresses/**`, `users/{uid}/vehicles/**` — owner-only read/write, admin
  read-only.
- `sellers/{id}` — read-only, and only by the matching seller (via the `sellerId` claim) or
  an admin. Used by the `/seller/*` route guard's active-status check.
- `listings/{id}` — public read (needed by the guest-cart merge), write closed.
- `carts/{uid}` — owner-only read/write.

Run `pnpm test:rules` to exercise these against a real (throwaway) Firestore emulator —
it proves cross-user reads/writes are denied and protected fields can't be self-granted.

## Tax compliance (Phase 11)

**Every GST rate and threshold in this codebase is configuration, not a constant, and must
be reviewed with a chartered accountant before go-live and before any production change.**
This includes (all in `packages/shared/src/pricing/tax.ts`'s `DEFAULT_TAX_CONFIG`,
overridable at `config/tax`, read via `functions/src/tax/taxConfig.ts`):

- `tcsRatePercent` — Section 52 TCS (currently 1%, split 0.5% CGST + 0.5% SGST intra-state
  or 1% IGST inter-state).
- `tdsRatePercent` — Section 194-O TDS on gross sales to resident sellers (currently 1%).
- `tdsIndividualHufExemptionThresholdPaise` — the cumulative FY gross-sales threshold below
  which an individual/HUF-equivalent seller (this codebase's `individual`/`proprietorship`
  seller `businessType`) is exempt from 194-O TDS (currently ₹5,00,000).
- `ewayBillThresholdPaise` — consignment value above which an e-way bill is required under
  CGST Rule 138 (currently ₹50,000).

Other judgment calls made in this phase that a CA should sign off on before go-live:

- **TDS base**: Section 194-O TDS is computed on the taxable value (goods value, excluding
  GST and shipping) per CBDT Circular 20/2021's guidance that GST shown separately isn't
  part of the TDS base — see `pricing/tax.ts`'s `computeTds` doc comment.
- **TCS base**: computed on the same taxable-value basis (net of platform discounts,
  excluding GST and shipping) as "net value of taxable supplies" under Section 52.
- **Credit-note TCS/TDS reversal** (`functions/src/tax/generateCreditNoteOnReturnRefunded.ts`)
  is a proportional reversal at the *current* configured rate, not a re-run of 194-O's
  cumulative threshold logic as it stood on the original sale date — flagged inline where
  this matters.
- **TCS/TDS "deducted at payout"**: no payout batch Cloud Function exists yet in this
  codebase (`payoutSchema` is defined but unused — see `cancelSubOrder.ts`'s doc comment).
  This phase posts TCS/TDS as debits directly to the seller's ledger
  (`functions/src/tax/ledger.ts`) at invoice-generation time, so a future payout function
  only ever needs to pay out `ledgers/{sellerId}.currentBalancePaise` — the deduction has
  already happened by the time payout runs.
- **Composition-scheme sellers** (`seller.gstComposition`) are zero-rated at the pricing
  source (`cart/priceCart.ts`) and issued a Bill of Supply instead of a Tax Invoice — but
  they're still subject to TCS (allowed under GST since the Oct 2023 relaxation), matching
  every other seller's treatment in `generateInvoiceOnShipped.ts`.
- **Platform legal name/role note** on every invoice PDF
  (`functions/src/tax/pdf/renderTaxDocumentPdf.ts`'s `PLATFORM_LEGAL_NAME` constant) is a
  placeholder — wire it to the operating company's actual registered name before go-live.
- **E-way bill**: no live NIC/GSP API integration exists (`ewayBill/manualExportProvider.ts`
  always throws) — a seller exports the JSON/CSV payload and files manually, then records
  the resulting number via `markEwayBillGenerated`. `ewayBill/provider.ts` is the swap point
  for a real integration later.

Run `pnpm test:rules` after any `firestore.rules` change to `invoices`/`creditNotes`/
`ewayBillTasks`/`ledgers` — Phase 11 didn't add new rules-tests coverage for these
collections (see "Deliberately left out" below).

## Discoverability & measurement (Phase 22)

**SEO — prerendering, not SSR.** Evaluated migrating the public shell to Vite SSR vs.
build-time prerendering for the top-N pages; chose prerendering. Rationale: this is a
mature SPA with dozens of features already built against client-only data fetching
(TanStack Query, Firebase client SDK, auth-gated routes) — an SSR migration means
re-deriving a server/client data-fetching boundary for the entire app, a multi-week
rewrite with real regression risk, to solve a problem (crawler visibility) that
prerendering solves for the pages that actually need it (public, unauthenticated,
SEO-relevant) without touching a single existing component's data-fetching code.
Firebase Hosting resolves a request against a literal static file *before* falling
through to the SPA catch-all rewrite (`firebase.json`), so a prerendered
`dist/parts/brake/index.html` is served as-is to both crawlers and users with zero
bot-detection logic — see `apps/web/scripts/prerender.mjs` and
`generate-prerender-urls.mjs`, wired via `pnpm --filter @snapspare/web build:prerender`.
Needs `npx playwright install chromium` once per machine/CI image; the script no-ops
(warns, doesn't fail the build) if Playwright's browser isn't installed or Firestore
credentials aren't configured, so `pnpm build` alone still always works.

**URL structure**: `/parts/:categorySlug[/:subCategorySlug]`, the new canonical
`/parts/p/:partSlug-:partId` (a static `p` segment, not the literal
`/parts/:partSlug-:partId` the design brief describes — that collides with
`/parts/:categorySlug` at the same path depth; see `router.tsx`'s comment),
`/vehicle/:makeSlug/:modelSlug/:year`, `/brand/:brandSlug`, `/store/:sellerSlug`
(pre-existing). The legacy nested product URL
(`/parts/:categorySlug/:subCategorySlug/p/:partId`) still resolves and redirects
client-side to the new canonical URL — old links/bookmarks aren't broken.

**Auto-generated long-tail landing pages**: `functions/src/marketing/generateSeoLandingPages.ts`
(weekly) writes `seoLandingPages/{categorySlug}__{subCategorySlug}__{vehicleSlug}` docs —
title/meta/H1/intro/FAQ — for every (subcategory × vehicle model) combo with at least 3
matching active parts (`catalogPart.fitmentSummary.modelIds`, no join needed). The
existing vehicle-scoped `CategoryPage` (`/parts/:cat/:sub/:vehicle`) reads this doc when
present for tailored copy + FAQPage JSON-LD, and falls back to generic (but still
indexable) copy when absent — a combo below the quality bar gets `noindex` rather than a
thin/duplicate page. Coverage is capped (60 models × subcategories, 400 pages/run) since
there's no real demand signal yet to prioritize which combos matter most — see that
file's header comment for the upgrade path once one exists (search-miss or order-volume
data).

**Sitemap**: `functions/src/seo/rollupSitemap.ts` (daily) precomputes the full URL list
into sharded `sitemapCache/*` docs; `sitemapXml.ts` (an `onRequest` function) serves
`/sitemap.xml` and `/sitemap-shard-NNN.xml` from that cache, wired via `firebase.json`
hosting rewrites (which must list these *before* the SPA catch-all — order matters).
`apps/web/public/robots.txt` references `https://snapspare.app/sitemap.xml` as a
placeholder — **update it to the real production domain before launch**, and set
`config/app.siteOrigin` in Firestore (used by every Cloud-Function-generated absolute
URL) to match.

**Analytics**: `packages/shared/src/analytics/events.ts` is the single typed event
catalog (GA4 ecommerce + this product's custom events); `apps/web/src/lib/analytics/track.ts`
is the one function product code calls, fanning out to gtag.js (GA4, only loaded when
`VITE_GA4_MEASUREMENT_ID` is set), Firebase Analytics, and — for the funnel-relevant
subset — a `logFunnelEvent` callable that increments `analyticsFunnelDaily` counters.
The `purchase` step is nightly-reconciled against the authoritative `orders` collection
(`reconcileFunnelPurchases.ts`) since client beacons can be lost; every other step is
beacon-only. Slab-effectiveness and cohort-retention are both derived from existing
authoritative order/subOrder data, not new tracking — see
`functions/src/analytics/rollupSlabEffectivenessDaily.ts` and `rollupCohortRetention.ts`.
All three feed one admin page, `/admin/analytics`.

**Monitoring**: `apps/web/src/lib/monitoring/sentry.ts` / `functions/src/monitoring/sentry.ts`
both no-op without `VITE_SENTRY_DSN` / `SENTRY_DSN` configured. Source maps upload via
`@sentry/vite-plugin`, gated on `SENTRY_AUTH_TOKEN` + `VITE_APP_VERSION` being set (a CI
release build) — a plain local `pnpm build` is unaffected. `withSentry` (functions) wraps
`createOrder` and `confirmPayment` only, the two functions where a silent failure is
costliest — every other callable needs the same one-line wrap, not done here. A
server-generated `correlationId` is stamped on every order (`order.correlationId`) and
threaded through those two functions' log lines; extending it through
shipping/invoicing/notifications for the same order is mechanical repetition of the same
pattern, not built here.

## Launch readiness (Phase 24)

**Legal pages**: the seven statutory/contractual pages (Terms of Use, Seller Agreement,
Privacy Policy, Return & Refund Policy, Shipping Policy, Cancellation Policy, Grievance
Redressal) are seeded as `cmsPages` docs (`packages/seed/src/seeders/seedLegalContent.ts`) —
reusing the Phase 19 CMS collection/schema rather than a separate legal-content system, so
the existing admin CMS panel (`AdminContentPage`) can already edit them. Rendered publicly at
`/legal/:slug` (`apps/web/src/pages/LegalPage.tsx`) via a small markdown-lite parser
(`CmsBody.tsx`) that never uses `dangerouslySetInnerHTML`. **This seeded content is a working
draft, not legal sign-off** — get it reviewed by a lawyer qualified in Indian consumer/IT/
data-protection law, and the Hindi text by a certified translator, before go-live; see
`seedLegalContent.ts`'s header comment for every placeholder (`companyLegalName`,
`companyRegisteredAddress`, the Grievance Officer's real name) that needs filling in at
`config/app` first.

**Consumer Protection (E-Commerce) Rules disclosures**: seller legal name + registered
address + GSTIN are denormalized onto `sellers/{sellerId}/settings/general` (the one
seller-scoped doc that's already publicly readable — see `sellerSettingsSchema`'s
`legalName`/`registeredAddress`/`gstin` fields) at approval time
(`reviewSellerApplication.ts`), and shown on every product page
(`SellerDisclosureCard.tsx`) and the store page — not hidden in a tab, since the disclosure
requirement is about visibility, not just data existing somewhere. `catalogPart.countryOfOrigin`
(defaults `'India'`) is shown alongside it; set per-part in the admin catalogue form
(`CatalogPartFormDialog.tsx`) for anything actually imported. The full price breakdown before
checkout already existed pre-Phase-24 (`CheckoutOrderSummary.tsx` — subtotal, discount,
shipping, taxable value, CGST/SGST/IGST, total, all server-priced) and needed no changes.

**Support**: a contact-form ticketing system modelled directly on Phase 18's disputes —
`supportTickets` (`packages/shared/src/schemas/supportTicket.ts`), `createSupportTicket`
(works signed-out too — a guest can file a ticket, e.g. "I can't log in"),
`respondToSupportTicket`/`resolveSupportTicket` (admin-only), and
`sendSupportTicketSlaBreachWarnings` (pages every admin ahead of
`config/app.supportTicketSlaHours`, same 6-hour-sweep pattern as `sendDisputeSlaBreachWarnings`).
Public UI at `/support` (contact form + WhatsApp `wa.me` deep link + business hours from
`config/app.supportBusinessHours` + phone/email) and `/help` (an FAQ accordion over
`cmsPages` type `faq`, seeded alongside the legal pages); admin queue at `/admin/support`,
same shape as `/admin/disputes`.

**Ops runbooks**: `docs/runbooks/` now covers site down, rollback (pre-existing), data
restore (pre-existing, `firestore-restore-drill.md`), payment stuck, webhook backlog, payout
failure, seller fraud, and spurious-part escalation — see `docs/runbooks/README.md` for the
index and the conventions shared across all of them.

**Monitoring & alerting**: `docs/ops/monitoring-alerting.md` plus `scripts/setup-monitoring.sh`
provision Cloud Monitoring uptime checks (Hosting root + the `ping` health-check function), a
Cloud Functions aggregate error-rate alert, a log-based payment-outcome metric fed by a new
structured log line in `razorpayWebhook.ts` (`payment_outcome: captured|failed`) plus its
alert policy, a Firestore read/write volume alert, and a Cloud Billing budget — run once per
environment (`dev`/`staging`/`prod`). Several pieces (Cost Anomaly Detection, quota
notification recipients) are Console-only and can't be scripted; see that doc for the full
list. This is GCP project configuration, not application code — nothing here is exercised by
`pnpm test`.

**Soft-launch plan**: `docs/launch/soft-launch-plan.md` — one city, 20–30 sellers recruited
through the real onboarding flow (no seeded fake sellers), invite-only buyers, a two-week
daily order/ticket/payment review with a logged go/no-go decision at the end, and an explicit
pre-launch checklist tying back to every placeholder/gap this section and README's
"Deliberately left out" list call out.

## Git

This directory is not yet a git repository. Run `git init` and commit before relying on the
Husky pre-commit hook (`pnpm lint && pnpm typecheck`) — Husky no-ops silently if `.git` is
missing (see the `prepare` script in the root `package.json`).

## Deliberately left out

- No business features: no catalog browsing, listings, checkout logic, seller/admin
  screens beyond placeholders, or Typesense/Razorpay/Shiprocket/WhatsApp integration code.
- **Phase 23**: CI (`.github/workflows/ci.yml`) now runs `pnpm test:rules` on every PR and on
  push to `main`, and there's a staged deploy pipeline (`deploy.yml`: functions → rules →
  hosting, staging auto-deploys after CI passes, prod is gated behind a GitHub Environment
  approval) plus a PR hosting-preview-channel workflow (`preview.yml`). None of these three
  can actually run yet, though — `staging`/`prod` Firebase project aliases in `.firebaserc`
  are still placeholders (`snapspare-staging`, `snapspare-prod`; create those projects and
  update the aliases), and none of `FIREBASE_SERVICE_ACCOUNT_DEV` /
  `FIREBASE_SERVICE_ACCOUNT_STAGING` / `FIREBASE_SERVICE_ACCOUNT_PROD` exist as repo secrets
  yet, nor has a repo admin configured required reviewers on the `production` GitHub
  Environment. See `docs/runbooks/rollback.md`'s last section for the exact list of what a
  human operator still has to do, and `docs/runbooks/firestore-restore-drill.md` for the
  scheduled-backup (`functions/src/admin/scheduledFirestoreBackup.ts`) restore procedure —
  that function's target GCS bucket (`gs://{projectId}-firestore-backups`) also needs to be
  created manually per environment before its first run succeeds.
- App Check is wired in `apps/web/src/lib/firebase.ts` and every callable now sets
  `enforceAppCheck: true` (Phase 23) — but the whole chain is inert until you set
  `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` and register the matching reCAPTCHA Enterprise key in
  Firebase Console → App Check; until then, App Check tokens are never attached client-side; note
  that once you *do* set it, every callable in the deployed environment will start rejecting
  requests with no App Check token, so set it before deploying, not after.
- GSTIN "verify" is a stub (`verifyGstin` Cloud Function only re-checks the checksum
  server-side) — no real GSTIN/KYC provider integration, and no `gstinVerified` flag is
  persisted anywhere.
- No account linking (a user who signs up via Google and later tries phone, or vice versa,
  gets two separate accounts rather than a merged one).
- **Phase 23 security hardening, scope notes**: per-uid/per-IP rate limiting
  (`functions/src/util/rateLimit.ts`) is applied to the ~11 highest-abuse-risk callables
  (order/payment/RFQ/dispute/report/return/bank-detail/credit/FCM-token endpoints), not all
  ~120 — extending it further is mechanical repetition of the same `enforceRateLimit(...)`
  call, not done here. The device fingerprint (`apps/web/src/lib/deviceFingerprint.ts`) is a
  lightweight hash of a few browser signals, not a forensic-grade fingerprint (no
  canvas/WebGL/audio entropy) — good enough to flag likely duplicate accounts for admin
  review, not to defeat a determined attacker. KYC-document and evidence-photo access logging
  (`writeAuditLog`) only covers reads that go through the app's own callables
  (`getSellerKycDocumentUrls`, `getReturnEvidenceUrls`, etc.) — a human with direct GCP
  Console/`gcloud` access to Storage bypasses the app layer entirely and needs a
  project-level Cloud Audit Logs Data Access config to be covered too, which isn't set up
  here (it's a GCP Console setting, not something in this repo).
- SMS/WhatsApp notifications (MSG91, WhatsApp Cloud API) aren't wired to any auth event yet.
- **Phase 11 (GST invoicing)**: no payout batch Cloud Function exists yet to actually pay
  sellers out and consume the TCS/TDS-netted ledger balance (see "Tax compliance" above) —
  TCS/TDS are posted to the ledger, nothing reads it back out yet. No live e-way-bill
  API integration (manual export/file only). (Phase 23 added `packages/rules-tests` coverage
  for `invoices`/`creditNotes`/`invoiceCounters`/`creditNoteCounters`/`ewayBillTasks`/
  `sellerFyGrossSales` — see `packages/rules-tests/src/invoicing.test.ts` — but the `ledgers`
  entry-type-level coverage this bullet originally flagged is still just the general
  `ledgers`/`entries` rules test, not one per entry type.) Invoice PDFs use
  pdfkit's built-in Helvetica font, not the product's brand fonts (Saira
  Condensed/Inter/IBM Plex Mono) — those aren't embeddable without bundling font files. The
  admin GST reports page has no per-seller filter UI (the callables support one, the page
  doesn't expose it) and no on-screen table for GSTR-1/TCS/TDS rows — CSV download only.
- **Phase 22 (discoverability & measurement)**: no `catalogPart.slug` backfill migration
  for parts created before this phase — they fall back to a client-derived slug
  (`slugify(name)`) until re-saved through the admin catalogue tool. `BrandPage` queries
  `catalogParts` directly (master-part cards, no live price/stock) rather than through
  Typesense — no brand facet exists in the listings search index yet. `robots.txt`'s
  sitemap URL and `config/app.siteOrigin` are placeholder domains — set both before
  launch. The auto-generated landing-page and sitemap-vehicle coverage is capped
  (deterministic ordering, not demand-ranked — see the Phase 22 section above). GA4↔BigQuery
  export isn't configured (a console-level step, not code) — the admin funnel/cohort/slab
  dashboards read this app's own Firestore rollups instead, which is why they're limited to
  the events this app explicitly tracks rather than full GA4 exploration. Not every
  ecommerce/custom event in the catalog has a wired call site yet — `remove_from_cart`,
  `view_cart`, `add_payment_info`, `refund`, `fitment_mismatch_shown`, `tier_nudge_shown`/
  `tier_nudge_accepted`, `quantity_tier_reached`, `gst_toggle_used`, `rfq_created`,
  `quote_accepted`, `bulk_pad_used`, `search_zero_results`, and `seller_compare_switched`
  are all defined and fully typed but not yet called from their obvious UI sites (cart page,
  checkout steps, RFQ flow, tier-nudge UI, seller comparison strip) — wiring each is a
  one-line `track()` call once you're in that file. `withSentry` and correlationId
  threading cover only `createOrder`/`confirmPayment`, not the rest of the order lifecycle.
  No Sentry session replay, and no admin UI to browse `auditLogs`-style raw analytics
  events (only the aggregated rollups are surfaced).
- **Phase 24 (launch readiness)**: the seeded legal pages and their placeholders
  (`companyLegalName`, `companyRegisteredAddress`, `companyRegistrationNumber`, the
  Grievance Officer's real name) are not legal sign-off — get them reviewed before go-live
  (see the "Launch readiness" section above). The Hindi legal/FAQ text is a working
  translation, not a certified one. No post-onboarding "edit registered address/legal name"
  flow exists for an approved seller — the Consumer Protection disclosure denormalized onto
  `sellers/{id}/settings/general` is set once at approval and would go stale if a seller's
  legal identity changed afterward; a correction today needs a manual admin-side Firestore
  edit, not a self-service seller flow. Support tickets have no "support staff" role distinct
  from admin — every reply is admin-only. `respondToSupportTicket`/`resolveSupportTicket`
  don't notify a guest (not-signed-in) ticket filer in-app since they have no account/inbox —
  the agent has to reply via their `contactEmail`/`contactPhone` directly, outside the app,
  which isn't wired up as an outbound channel here (no email/SMS send from the support flow
  itself, only the in-app notification for signed-in filers). The Help Centre has no search,
  just an accordion over every published FAQ article — fine at the current article count, not
  built to scale to hundreds. `scripts/setup-monitoring.sh`'s payment-failure alert threshold
  is a volume-based proxy (a true failed/total ratio isn't expressible in one declarative
  Cloud Monitoring policy — see that script's inline note) and, like the Firestore
  volume-alert threshold, is an unvalidated starting guess until real traffic exists to tune
  against; Cost Anomaly Detection and quota-notification recipients are Console-only steps
  the script can't perform. No payout provider is actually wired in yet (see
  `docs/runbooks/payout-failure.md`), which the soft-launch plan explicitly gates on — don't
  run the soft-launch against payouts that can't really settle.
