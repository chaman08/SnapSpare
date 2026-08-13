# E2E tests (Playwright)

Two specs (Phase 23): `buyer-purchase-journey.spec.ts` and
`seller-listing-journey.spec.ts`, run on a mobile viewport
(`playwright.config.ts`'s `mobile-chrome` project, Pixel 5).

## Running locally

1. In one terminal, start the **full** Firebase emulator suite (not just
   `--only firestore` like the vitest emulator tests use — these specs sign
   in for real and call real `onCall` functions through the actual UI, both
   of which need the auth and functions emulators too):
   ```bash
   firebase emulators:start --project demo-snapspare
   ```
2. In another terminal:
   ```bash
   pnpm --filter @snapspare/web test:e2e
   ```
   This starts the Vite dev server itself (`playwright.config.ts`'s
   `webServer`, pinned to `VITE_USE_EMULATORS=true` and a demo Firebase
   config) if one isn't already running on `127.0.0.1:5173`, then runs both
   specs against it.

Each spec seeds its own fixture data directly via `firebase-admin`
(`e2e/utils/adminSeed.ts`) against the Auth/Firestore emulators — no
dependency on `pnpm seed` (`packages/seed`) or any persisted
`.emulator-data` snapshot. Every seeded id is randomized per run, so specs
can run repeatedly against the same live emulator without colliding.

## Signing in without the OTP UI

Real sign-in is phone OTP or Google (`AuthProvider.tsx`) — neither is
practical to drive from a script. These specs instead use a **test-only**
hook, `window.__snapspareTestSignIn(customToken)`, added in
`apps/web/src/lib/firebase.ts` and wired to `signInWithCustomToken`. It's
guarded behind `import.meta.env.DEV` *and* already nested inside the
`useEmulators` branch, so Vite dead-code-eliminates it from any production
build (`VITE_USE_EMULATORS` is never `'true'` in a real deploy) — it can't
reach a real user's browser. `adminSeed.ts` mints the matching custom token
via `admin.auth().createCustomToken(uid)` right after creating each fixture
user.

## What this deliberately does not cover, and why

**Search.** Both a buyer searching for a part and a seller's "Add listing"
catalog-part typeahead go through Typesense Cloud
(`features/search/api/searchClient.ts`,
`features/seller-listings/api/searchCatalogParts.ts`) — an external service
the local Firebase emulator suite doesn't provide. Neither spec drives
search:

- The buyer journey seeds a catalog part + listing directly via
  `firebase-admin` and navigates straight to its product detail page by id
  (`/parts/:categorySlug/:subcategorySlug/p/:partId` — confirmed in
  `pages/shop/ProductDetailPage.tsx` to read `partId` straight off the URL,
  no slug resolution needed), skipping the search bar entirely.
- The seller journey edits an already-seeded listing
  (`/seller/listings/:listingId/edit`, which reads straight from Firestore —
  `features/seller-listings/api/useSellerListings.ts` — no Typesense
  involved) instead of exercising the "Add listing" wizard's first step.

To actually cover search, either point `apps/web`'s Typesense env vars at a
real (test) Typesense Cloud cluster seeded with matching fixture data, or
intercept the Typesense HTTP client's requests with `page.route()` and
return a canned response shaped like its multi-search API — neither is set
up here.

**Razorpay checkout.** Both specs use Cash on Delivery, the one payment
method that never touches an external gateway. A `razorpay` checkout would
need `checkout.razorpay.com`'s real widget (loaded at runtime, see
`features/checkout/lib/razorpay.ts`) mocked at the network layer too.

## Known risk

These specs were written against the actual route table
(`apps/web/src/app/router.tsx`), component structure, and i18n copy
(`apps/web/src/locales/en/common.json`) at the time they were written, and
each schema-backed seed fixture in `adminSeed.ts` is built through the same
real zod schemas the app itself uses — but they have not been executed
against a live emulator run in the environment this was authored in (no
persistent multi-process browser/emulator session was available there). If
a selector doesn't match on first real run, it's most likely a `getByRole`/
`getByText` string that drifted from the current UI copy — check the
component/locale file referenced in the failing line first.
