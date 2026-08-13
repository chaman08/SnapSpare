# Monitoring & alerting

Phase 24 (launch readiness). This is Google Cloud/Firebase project
configuration, not application code — none of it can be expressed as a
Cloud Function or a Firestore document. `scripts/setup-monitoring.sh`
automates the parts `gcloud`/`gcloud beta` can create directly; the
sections marked **Console-only** below can't be scripted and need a human
operator, once per environment (`dev`/`staging`/`prod`).

Run the script against each environment before its go-live:

```bash
# from repo root
GOOGLE_PROJECT=snapspare-staging NOTIFICATION_EMAIL=oncall@snapspare.in ./scripts/setup-monitoring.sh
```

It is idempotent-ish (uses `gcloud ... create`, which fails loudly with
"already exists" rather than silently duplicating) — safe to re-run, just
ignore the "already exists" errors on a second pass.

## 1. Uptime checks

**What**: a Cloud Monitoring uptime check hitting the Hosting root (`/`)
and the `ping` health-check function
(`functions/src/index.ts`'s `export const ping`) every 60 seconds from
multiple regions, alerting if either goes unreachable for 3 consecutive
checks (~3 minutes).

**Why `ping` specifically**: it's a scaffold-only, dependency-free
`onRequest` function (no Firestore/auth calls) — see its comment in
`functions/src/index.ts` — so a failed check on it isolates "Cloud
Functions infra itself is unreachable" from "a specific function has a
bug," which the Hosting-root check alone can't distinguish.

**Alerting threshold**: fires on **any** failed check location out of the
configured regions being down for 3 consecutive checks — deliberately
sensitive, since an uptime failure is unambiguous and cheap to
false-positive on (see [site-down.md](../runbooks/site-down.md)).

Created by the script (`create_uptime_check` function) via
`gcloud monitoring uptime create`.

## 2. Cloud Functions error-rate alert

**What**: an alert policy on the `cloudfunctions.googleapis.com/function/execution_count`
metric, filtered to `status != "ok"`, alerting when the error count across
all functions exceeds **10 errors in 5 minutes** (tune per traffic volume
— this is a starting point, not a permanent constant).

**Why not per-function**: this codebase has ~120 callables (see
functions/src/index.ts) — a per-function policy for each isn't
maintainable by hand. One aggregate policy catches a systemic problem (bad
deploy, a shared dependency down) immediately; `withSentry`
(`functions/src/monitoring/withSentry.ts`, currently wrapping
`createOrder`/`confirmPayment`) is the finer-grained per-function signal
for the highest-value functions specifically, and shows up as a **separate**
Sentry alert (see "Sentry" below), not this Cloud Monitoring policy.

Created by the script (`create_function_error_rate_alert`).

## 3. Payment success-rate alert

**What**: no built-in GCP metric answers "what fraction of payment attempts
succeeded" — this needs a custom log-based metric derived from
`razorpayWebhook`'s structured logs (`functions/src/checkout/razorpayWebhook.ts`).
The script creates a log-based counter metric,
`snapspare_payment_outcome`, labeled by `outcome` (`captured`/`failed`),
extracted from the structured log line that function already emits per
event. An alerting policy then fires when the ratio of `failed`/`total`
over a rolling 15-minute window exceeds **15%** — tune based on observed
baseline once real traffic exists; a brand-new soft-launch environment
has too little volume for a percentage threshold to be meaningful (see
`docs/launch/soft-launch-plan.md`'s manual daily order review, which
covers this signal by hand during the soft-launch window instead).

`razorpayWebhook.ts` already logs a structured `razorpayWebhook: payment_outcome`
entry with `jsonPayload.outcome` (`"captured"` or `"failed"`) on every
`payment.captured`/`payment.failed` event (excluding Khata credit-repayment
payments, which aren't order checkouts and would skew the ratio) — the
log-based metric's filter keys off exactly this line. If the alert shows
zero data, check Cloud Logging for that line directly before assuming
payments are fine; it usually means the metric's filter and the log line's
actual field names have drifted apart (e.g. after a refactor), not that
there's no traffic.

Created by the script (`create_payment_success_rate_metric` and
`create_payment_success_rate_alert`).

## 4. Firestore quota alerts

**What**: two layers —

1. **GCP's default quota notifications** — Google automatically emails
   project owners/editors at 50/90/100% of most quotas (reads/writes/
   deletes per day, index entries, etc.). **Console-only**: confirm the
   right people receive these at Console → IAM & Admin → Quotas → (bell
   icon) notification preferences, since the default recipient list is
   "project IAM members with the right role," not necessarily the on-call
   channel.
2. **A custom alert policy** on `firestore.googleapis.com/document/read_count`
   and `.../write_count` approaching the project's configured daily quota
   (script parameterizes the threshold — default 80% of the Blaze-plan
   soft quota, which is effectively uncapped by default but still worth
   alerting on for **cost** reasons, not just hard quota exhaustion — see
   the cost anomaly alert below, which is the more likely real-world
   trigger for a runaway read loop).

Created by the script (`create_firestore_quota_alert`).

## 5. Cost anomaly alert

**What**: a Cloud Billing budget with threshold rules at 50/90/100% of a
configured monthly amount, **plus** enabling Cloud Billing's built-in
anomaly detection (flags an unusual day-over-day spend spike even under
the monthly budget threshold — the more useful signal for "a runaway
Firestore read loop tripled today's cost" versus "we're approaching the
monthly cap").

**Console-only for anomaly detection**: as of this writing, Cloud Billing
Cost Anomaly Detection is enabled via Console → Billing → Cost Management
→ Anomaly Detection (no stable `gcloud` command for the anomaly-detection
toggle itself) — the script creates the **budget** (which does have a
stable `gcloud billing budgets create` command), but anomaly detection
itself needs one manual click per billing account.

Created by the script (`create_cost_budget`) for the budget; anomaly
detection is a manual step (see script's printed reminder at the end).

## Sentry (separate from the above)

`apps/web/src/lib/monitoring/sentry.ts` / `functions/src/monitoring/sentry.ts`
are wired but no-op without `VITE_SENTRY_DSN` / `SENTRY_DSN` configured
(see README's Phase 22 section). This is a **separate** alerting surface
from everything above — Sentry catches application-level exceptions with
stack traces and `correlationId` threading (currently only on
`createOrder`/`confirmPayment`); Cloud Monitoring catches infrastructure-
level signals (uptime, aggregate error rate, quota, cost). Both matter;
neither substitutes for the other. Setting up a Sentry project/DSN and
its own alert rules is a Sentry-dashboard task, out of scope for
`setup-monitoring.sh`.

## Where alerts go

All policies the script creates notify the email address passed as
`NOTIFICATION_EMAIL` via a Cloud Monitoring notification channel it
creates first. For a real on-call rotation, replace this with a
PagerDuty/Opsgenie/Slack notification channel (`gcloud alpha monitoring
channels create --type=pagerduty|slack|...`) — email is the lowest-common-
denominator default this script ships with, not a recommendation to stay
on email-only alerting once real users are live.

## Verifying it worked

```bash
gcloud monitoring uptime-checks list --project=$GOOGLE_PROJECT
gcloud alpha monitoring policies list --project=$GOOGLE_PROJECT
gcloud logging metrics list --project=$GOOGLE_PROJECT
gcloud billing budgets list --billing-account=<your-billing-account-id>
```

Then trigger a harmless test (e.g. temporarily point the uptime check at a
URL that 404s) to confirm the notification email actually arrives before
trusting the alert in production.
