# Site down runbook

What to do when the storefront is unreachable or broadly broken (not a
single feature — the whole app is down or erroring for most users).

## First 5 minutes: establish scope

1. **Check the uptime checks** (see
   [monitoring & alerting](../ops/monitoring-alerting.md)) — which URL(s)
   are failing? Hosting root (`/`), a specific API/callable, or Firestore
   itself?
2. **Try it yourself** from a browser and from `curl -I` — distinguish a
   true outage from a DNS/local-network problem, and note whether it's a
   blank page (hosting/bundle issue), a stuck loading state (functions/API
   issue), or a Firestore permission error banner (rules or App Check
   issue).
3. **Check Firebase's own status page**
   ([status.firebase.google.com](https://status.firebase.google.com)) and
   Google Cloud's ([status.cloud.google.com](https://status.cloud.google.com))
   for `asia-south1`/Firestore/Hosting incidents — if Google is down, there
   is no local fix; monitor and post a status update, don't burn time
   debugging your own code.
4. **Check `config/app.maintenanceMode`** — if it's unexpectedly `true`,
   someone (or a bad script) flipped it; that alone would explain a
   universal outage and has a one-field fix.

## Narrow down: hosting vs. functions vs. Firestore vs. third-party

- **Hosting down / blank page / 404 on every route**: check Firebase
  Console → Hosting → recent releases for a bad deploy, and Cloud Logging
  for the Hosting layer. This is a hosting rollback — see
  [rollback.md](./rollback.md#rolling-back-a-bad-hosting-deploy).
- **App loads but every API call fails**: check Cloud Functions error rate
  (the function error-rate alert should already be firing — see
  [monitoring & alerting](../ops/monitoring-alerting.md)) and Cloud Logging
  for the specific failing function(s). If it's isolated to functions
  introduced/changed in the most recent deploy, this is a functions
  rollback — see
  [rollback.md](./rollback.md#rolling-back-a-bad-functions-deploy).
- **Firestore-specific errors** (`PERMISSION_DENIED` on reads/writes that
  should work, or `RESOURCE_EXHAUSTED`): check the
  [Firestore quota alert](../ops/monitoring-alerting.md#firestore-quota-alerts)
  — a quota exhaustion looks exactly like an outage to users. Also check
  whether a recent `firestore.rules` deploy introduced a regression
  (`pnpm test:rules` should have caught this in CI, but confirm which rules
  version is actually live via Firebase Console → Firestore → Rules →
  history).
- **App Check rejecting all requests**: if
  `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` was set/rotated without the matching
  reCAPTCHA Enterprise key being live in Firebase Console → App Check (see
  README's Phase 23 note — every callable enforces App Check once this is
  configured), every request fails closed. Check whether this was a recent
  config change.
- **Third-party dependency down** (Razorpay, Shiprocket, Typesense Cloud,
  WhatsApp Cloud API/MSG91): the app itself may be fine but a specific flow
  (checkout, search, notifications) is broken. This is usually not a "site
  down" situation but can feel like one if it's checkout — check the
  provider's status page and, if it's prolonged, consider a
  `config/app.bannerMessage` warning buyers (e.g. "Payments are temporarily
  delayed").

## Mitigate while you investigate

- If the cause is a bad deploy and the fix isn't immediately obvious, roll
  back first (see [rollback.md](./rollback.md)) — restoring service takes
  priority over root-causing while users are actively affected.
- If the cause is external (Google Cloud outage, a third-party gateway
  down) and there's no code fix available, set
  `config/app.bannerMessage` to something honest and specific ("We're
  experiencing a temporary outage with our payment provider — please try
  again shortly") rather than leaving users to guess.
- `config/app.maintenanceMode` exists as a last-resort circuit breaker if
  the app is actively making things worse (e.g. corrupting data on every
  request) — flipping it stops new traffic from hitting the broken path
  while you fix it. Don't reach for it reflexively; most outages resolve
  faster by fixing/rolling back than by shutting the whole app down.

## After the site is back up

- Confirm the uptime checks and error-rate alerts have actually cleared,
  not just that the page loads once for you.
- Run through the golden path manually (browse → add to cart → checkout)
  to confirm the fix, per this project's UI-change testing convention.
- File an incident note per [rollback.md](./rollback.md)'s convention:
  what broke, how long it was down, what the fix was, and whether any data
  needs the [data restore runbook](./firestore-restore-drill.md).
