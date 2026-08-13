# Firestore restore drill

How to actually test restoring from one of the scheduled exports produced by
`functions/src/admin/scheduledFirestoreBackup.ts` (runs weekly, Sunday 04:00
UTC, exporting every collection to
`gs://{projectId}-firestore-backups/scheduled/<ISO timestamp>/`). A backup
nobody has ever restored from is not a backup you can trust — this drill
exists to prove the export → import path actually works, on a schedule, not
just at incident time.

**Never import into `staging` or `prod` for a drill.** A Firestore import
overwrites documents by id — running one against a live project can clobber
real data. Always import into a disposable scratch project.

## Prerequisites

- The `gcloud` CLI, authenticated (`gcloud auth login`) with a user/service
  account that has `roles/datastore.importExportAdmin` on both the source
  project (to list/read the export) and the scratch project (to import into
  it).
- A scratch Firebase/GCP project to import into — either a dedicated
  `snapspare-restore-drill` project kept around for this purpose, or a
  throwaway project created fresh each drill (`gcloud projects create
  snapspare-drill-<date>`) and deleted afterward. Either way it must have
  Firestore initialized (same mode/region as the source project) before the
  import.

## Steps

1. **Find the export to restore from.**
   ```bash
   gsutil ls gs://<projectId>-firestore-backups/scheduled/
   ```
   Pick the most recent one for a routine drill, or a specific older one if
   the drill is deliberately testing "how far back can we go."

2. **Import it into the scratch project.**
   ```bash
   gcloud firestore import gs://<projectId>-firestore-backups/scheduled/<timestamp>/ \
     --project=<scratch-project-id>
   ```
   This is a long-running operation — `gcloud` returns immediately with an
   operation name; poll it with:
   ```bash
   gcloud firestore operations describe <operation-name> --project=<scratch-project-id>
   ```

3. **Verify the restore, don't just trust that the command exited 0.**
   Point a throwaway script or the Firebase Console (Console → Firestore →
   scratch project) at the scratch project and check:
   - **Document counts on a few key collections** — `orders`, `subOrders`,
     `users`, `listings` at minimum — are in the right ballpark for the
     export's timestamp (compare against Cloud Logging/Monitoring metrics
     from around that time, or against the source project's current counts
     minus expected growth since the export).
   - **Spot-check a specific recent order.** Pick an order id known to have
     existed before the export timestamp (from support/Sentry/logs), fetch
     it from the scratch project, and confirm it looks intact — `subOrders`,
     `totalPaise`, `status`, `timeline` all present and consistent.
   - **Spot-check one invoice.** Fetch an `invoices` doc and confirm its
     `invoiceNumber` and line items are intact — this collection is the
     GST-compliance-critical one, so it's worth checking specifically rather
     than assuming "orders looked fine so everything did."
   - **Confirm Firestore rules/indexes are irrelevant here** — an import
     writes raw documents directly, bypassing `firestore.rules` entirely,
     so a successful import proves nothing about rules; that's what
     `pnpm test:rules` is for, separately.

4. **Tear down the scratch project's data** (or delete the whole scratch
   project, if it was created fresh for this drill) once verification is
   done — don't leave a live copy of production-shaped data sitting in an
   under-monitored scratch project.

5. **Log the drill** in the table below — every drill, pass or fail, gets a
   row. A failed drill is exactly the kind of finding this exists to catch;
   log it and open a fix, don't just re-run until it passes.

## Recommended cadence

**Quarterly**, plus once immediately after any change to
`scheduledFirestoreBackup.ts` or the export bucket's IAM/lifecycle
configuration — a config change is exactly when a backup silently starts
failing.

## Drill log

| Date | Export tested | Result | Notes |
|------|----------------|--------|-------|
| _(none yet — this pipeline hasn't been live long enough for a first drill)_ | | | |
