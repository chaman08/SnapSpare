#!/usr/bin/env bash
#
# Phase 24 (launch readiness): provisions Cloud Monitoring uptime checks,
# alert policies, a log-based payment-outcome metric, and a Cloud Billing
# budget for one Firebase/GCP project. See docs/ops/monitoring-alerting.md
# for the rationale behind each threshold and for the steps this script
# can't do (marked Console-only there).
#
# Usage:
#   GOOGLE_PROJECT=snapspare-staging NOTIFICATION_EMAIL=oncall@snapspare.in \
#     BILLING_ACCOUNT_ID=XXXXXX-XXXXXX-XXXXXX MONTHLY_BUDGET_INR=15000 \
#     ./scripts/setup-monitoring.sh
#
# Requires: gcloud CLI, authenticated (`gcloud auth login`) with an account
# that has Monitoring Editor + Logging Admin + Billing Account Costs Manager
# roles on the target project/billing account. Safe to re-run — `gcloud ...
# create` fails loudly on "already exists" rather than silently duplicating;
# ignore those errors on a second pass.

set -euo pipefail

: "${GOOGLE_PROJECT:?Set GOOGLE_PROJECT to the target Firebase/GCP project id (e.g. snapspare-staging)}"
: "${NOTIFICATION_EMAIL:?Set NOTIFICATION_EMAIL to the address/alias that should receive alerts}"
HOSTING_URL="${HOSTING_URL:-https://${GOOGLE_PROJECT}.web.app}"
FUNCTIONS_REGION="${FUNCTIONS_REGION:-asia-south1}"
BILLING_ACCOUNT_ID="${BILLING_ACCOUNT_ID:-}"
MONTHLY_BUDGET_INR="${MONTHLY_BUDGET_INR:-15000}"

echo "== Setting up monitoring for project: ${GOOGLE_PROJECT} =="

echo "-- Creating notification channel (${NOTIFICATION_EMAIL}) --"
CHANNEL_ID=$(gcloud beta monitoring channels list \
  --project="${GOOGLE_PROJECT}" \
  --filter="labels.email_address=${NOTIFICATION_EMAIL}" \
  --format="value(name)" | head -n1)

if [ -z "${CHANNEL_ID}" ]; then
  CHANNEL_ID=$(gcloud beta monitoring channels create \
    --project="${GOOGLE_PROJECT}" \
    --display-name="SnapSpare on-call (${GOOGLE_PROJECT})" \
    --type=email \
    --channel-labels=email_address="${NOTIFICATION_EMAIL}" \
    --format="value(name)")
fi
echo "   Notification channel: ${CHANNEL_ID}"

create_uptime_check() {
  local display_name="$1"
  local host="$2"
  local path="$3"
  echo "-- Creating uptime check: ${display_name} --"
  gcloud monitoring uptime create "${display_name}" \
    --project="${GOOGLE_PROJECT}" \
    --resource-type=uptime-url \
    --protocol=https \
    --host="${host}" \
    --path="${path}" \
    --period=1 \
    --timeout=10 \
    || echo "   (already exists — skipping)"
}

create_function_error_rate_alert() {
  echo "-- Creating Cloud Functions error-rate alert policy --"
  local policy_file
  policy_file="$(mktemp)"
  cat > "${policy_file}" <<EOF
displayName: "SnapSpare — Cloud Functions error rate (${GOOGLE_PROJECT})"
combiner: OR
conditions:
  - displayName: "Function errors > 10 in 5m"
    conditionThreshold:
      filter: >-
        resource.type="cloud_function" AND
        metric.type="cloudfunctions.googleapis.com/function/execution_count" AND
        metric.label."status"!="ok"
      comparison: COMPARISON_GT
      thresholdValue: 10
      duration: 0s
      aggregations:
        - alignmentPeriod: 300s
          perSeriesAligner: ALIGN_RATE
          crossSeriesReducer: REDUCE_SUM
notificationChannels:
  - "${CHANNEL_ID}"
alertStrategy:
  autoClose: 604800s
EOF
  gcloud alpha monitoring policies create \
    --project="${GOOGLE_PROJECT}" \
    --policy-from-file="${policy_file}" \
    || echo "   (already exists or needs manual review — check Console)"
  rm -f "${policy_file}"
}

create_payment_success_rate_metric() {
  echo "-- Creating log-based metric: snapspare_payment_outcome --"
  gcloud logging metrics create snapspare_payment_outcome \
    --project="${GOOGLE_PROJECT}" \
    --description="Razorpay payment.captured/payment.failed events from razorpayWebhook (Phase 24)" \
    --log-filter='resource.type="cloud_function" AND resource.labels.function_name="razorpayWebhook" AND jsonPayload.message="razorpayWebhook: payment_outcome"' \
    --label-extractors="outcome=EXTRACT(jsonPayload.outcome)" \
    || echo "   (already exists — skipping)"
}

create_payment_success_rate_alert() {
  echo "-- Creating payment failure-rate alert policy --"
  local policy_file
  policy_file="$(mktemp)"
  cat > "${policy_file}" <<EOF
displayName: "SnapSpare — payment failure rate > 15% (${GOOGLE_PROJECT})"
combiner: OR
conditions:
  - displayName: "Failed payment outcomes > 15% over 15m"
    conditionThreshold:
      filter: >-
        resource.type="cloud_function" AND
        metric.type="logging.googleapis.com/user/snapspare_payment_outcome" AND
        metric.label."outcome"="failed"
      comparison: COMPARISON_GT
      thresholdValue: 0.15
      duration: 0s
      aggregations:
        - alignmentPeriod: 900s
          perSeriesAligner: ALIGN_RATE
          crossSeriesReducer: REDUCE_SUM
notificationChannels:
  - "${CHANNEL_ID}"
alertStrategy:
  autoClose: 604800s
EOF
  echo "   NOTE: this policy alerts on the raw failed-event rate, not a true"
  echo "   failed/total ratio (Cloud Monitoring alert policies can't easily"
  echo "   express a ratio-of-two-metrics threshold in a single declarative"
  echo "   policy) — treat it as a volume-based proxy and tune thresholdValue"
  echo "   once real traffic establishes a baseline. For a true ratio, build"
  echo "   a custom dashboard chart (captured vs failed) and eyeball it"
  echo "   during the soft-launch daily review instead — see"
  echo "   docs/launch/soft-launch-plan.md."
  gcloud alpha monitoring policies create \
    --project="${GOOGLE_PROJECT}" \
    --policy-from-file="${policy_file}" \
    || echo "   (already exists or needs manual review — check Console)"
  rm -f "${policy_file}"
}

create_firestore_quota_alert() {
  echo "-- Creating Firestore read/write volume alert policy --"
  local policy_file
  policy_file="$(mktemp)"
  cat > "${policy_file}" <<EOF
displayName: "SnapSpare — Firestore read/write volume spike (${GOOGLE_PROJECT})"
combiner: OR
conditions:
  - displayName: "Firestore document reads spike"
    conditionThreshold:
      filter: >-
        resource.type="firestore.googleapis.com/Database" AND
        metric.type="firestore.googleapis.com/document/read_count"
      comparison: COMPARISON_GT
      thresholdValue: 1000000
      duration: 0s
      aggregations:
        - alignmentPeriod: 3600s
          perSeriesAligner: ALIGN_RATE
          crossSeriesReducer: REDUCE_SUM
notificationChannels:
  - "${CHANNEL_ID}"
alertStrategy:
  autoClose: 604800s
EOF
  echo "   NOTE: thresholdValue (1,000,000 reads/hour) is a starting guess,"
  echo "   not a derived number — this is a cost/runaway-loop tripwire, not"
  echo "   the Firestore free-tier daily cap (50k reads/day), which the"
  echo "   default GCP quota notifications already cover automatically."
  echo "   Tune after observing a real traffic baseline."
  gcloud alpha monitoring policies create \
    --project="${GOOGLE_PROJECT}" \
    --policy-from-file="${policy_file}" \
    || echo "   (already exists or needs manual review — check Console)"
  rm -f "${policy_file}"
}

create_cost_budget() {
  if [ -z "${BILLING_ACCOUNT_ID}" ]; then
    echo "-- Skipping billing budget: BILLING_ACCOUNT_ID not set --"
    echo "   Set BILLING_ACCOUNT_ID (find via: gcloud billing accounts list)"
    echo "   and re-run to create the monthly cost budget/alert."
    return
  fi
  echo "-- Creating Cloud Billing budget (₹${MONTHLY_BUDGET_INR}/month) --"
  gcloud billing budgets create \
    --billing-account="${BILLING_ACCOUNT_ID}" \
    --display-name="SnapSpare ${GOOGLE_PROJECT} monthly budget" \
    --budget-amount="${MONTHLY_BUDGET_INR}INR" \
    --threshold-rule=percent=0.5 \
    --threshold-rule=percent=0.9 \
    --threshold-rule=percent=1.0 \
    --filter-projects="projects/${GOOGLE_PROJECT}" \
    --notifications-rule-monitoring-notification-channels="${CHANNEL_ID}" \
    || echo "   (already exists — skipping)"
}

create_uptime_check "SnapSpare hosting root (${GOOGLE_PROJECT})" "${HOSTING_URL#https://}" "/"
create_uptime_check "SnapSpare functions health check (${GOOGLE_PROJECT})" \
  "${FUNCTIONS_REGION}-${GOOGLE_PROJECT}.cloudfunctions.net" "/ping"
create_function_error_rate_alert
create_payment_success_rate_metric
create_payment_success_rate_alert
create_firestore_quota_alert
create_cost_budget

echo ""
echo "== Done. Remaining manual (Console-only) steps: =="
echo "1. Confirm quota-notification recipients: Console -> IAM & Admin ->"
echo "   Quotas -> notification preferences."
echo "2. Enable Cost Anomaly Detection: Console -> Billing -> Cost Management"
echo "   -> Anomaly Detection (no gcloud command for this toggle yet)."
echo "3. Set up a Sentry project + VITE_SENTRY_DSN/SENTRY_DSN if not already"
echo "   done — see docs/ops/monitoring-alerting.md's Sentry section."
echo "4. Trigger a harmless test failure on each alert to confirm the"
echo "   notification email actually arrives before relying on it in prod."
