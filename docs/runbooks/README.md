# Ops runbooks

Index of every operational runbook in this repo. Each one assumes you're
already an admin/on-call operator with Firebase Console access — none of
these are buyer/seller-facing documents (those live in the seeded legal
pages and Help Centre content, see
`packages/seed/src/seeders/seedLegalContent.ts`).

| Runbook | Use it when |
| --- | --- |
| [Site down](./site-down.md) | The whole app is unreachable or broadly broken, not a single feature. |
| [Rollback](./rollback.md) | A deploy needs to be reverted (hosting, functions, or both). |
| [Data restore](./firestore-restore-drill.md) | Firestore data was corrupted/lost and needs restoring from a scheduled export. |
| [Payment stuck](./payment-stuck.md) | An order is stuck mid-payment, or a buyer reports a double charge. |
| [Webhook backlog](./webhook-backlog.md) | Razorpay/Shiprocket webhooks are piling up unprocessed. |
| [Payout failure](./payout-failure.md) | A seller's payout failed or never landed. |
| [Seller fraud](./seller-fraud.md) | A seller is suspected of fraud (fake shipments, bank fraud, review manipulation, COD/RTO abuse). |
| [Spurious part escalation](./spurious-part-escalation.md) | A buyer reports a counterfeit/spurious part. |

## Conventions shared across these runbooks

- **Triage before you act.** Every runbook here starts with "how do I know
  which situation I'm actually in" before jumping to remediation — the same
  failure symptom (e.g. "buyer says payment didn't go through") can have
  several different real causes with different fixes.
- **File an incident note afterward.** None of these runbooks prescribe a
  specific incident-tracking tool (none is wired into this repo yet — see
  README's Phase 24 notes); at minimum, record what broke, when, what was
  done, and whether follow-up work is needed, somewhere your team can find
  it later.
- **`auditLogs` is your friend.** Every admin mutating action in this app
  writes to `auditLogs` (`functions/src/util/auditLog.ts`) — it's usually
  the fastest way to answer "what changed and who changed it" during an
  investigation, browsable at Admin Console → Audit Log.
- **These runbooks describe the code as it exists today.** Where a runbook
  says something is a "known gap" (e.g. payouts having no live provider
  yet), that's calling out a real limitation, not a mistake in the runbook
  — check the README's phase notes for the current state before assuming a
  described capability exists in production.
