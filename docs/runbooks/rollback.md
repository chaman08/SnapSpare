# Rollback runbook

What to do when a deploy to `staging` or `prod` (see
`.github/workflows/deploy.yml`) turns out to be bad — a regression, an
outage, or unexpected data mutation. This document is CLI/Console
procedure only; it doesn't replace judgment about *whether* to roll back.

For the once-a-quarter drill that proves the Firestore-export side of this
actually works, see [`firestore-restore-drill.md`](./firestore-restore-drill.md).

## Pre-rollback checklist

Do these **before** touching any deploy, in order:

1. **Confirm there's actually a regression, and which deploy caused it.**
   Check Sentry (`@sentry/node` is wired into `createOrder` and
   `confirmPayment` — see `functions/src/monitoring/`) and Cloud Logging
   for an error-rate spike. Correlate the spike's start time against the
   deploy pipeline history in the GitHub Actions run list
   (`.github/workflows/deploy.yml` runs) and Firebase Hosting's release
   history (Console → Hosting → Release history) to find the exact commit
   that shipped it. Don't roll back on a hunch — a rollback is itself a
   deploy and carries its own risk.
2. **Decide whether this is a hosting problem, a functions problem, or
   both.** A bad web bundle (broken UI, a client-side crash) is a hosting
   rollback. A bad Cloud Function (a callable throwing, a webhook silently
   failing, a scheduled job misbehaving) is a functions rollback. If the
   bad deploy touched both — e.g. a client now calls a renamed/removed
   function — you need to reason about ordering (see "Rolling back both"
   below).
3. **Check whether Firestore data was already mutated in a way rollback
   alone can't fix.** Rolling back hosting/functions restores *code*, not
   *data*. If the bad deploy wrote bad orders, double-charged a payment,
   corrupted a ledger entry, or ran a buggy scheduled job that mutated
   many documents before anyone noticed, reverting the code stops it from
   happening again but does **not** un-write what already happened. In
   that case:
   - Identify the blast radius (which collections/documents, what time
     window — Cloud Logging structured logs and `auditLogs` docs written
     by `functions/src/util/auditLog.ts` are the first place to look).
   - Decide whether a targeted manual fix (a script or Console edit
     correcting the specific bad writes) is needed in addition to the code
     rollback.
   - If the damage is large/unclear, restoring the affected collections
     from a scheduled export (see `firestore-restore-drill.md`) is the
     fallback of last resort — it's a point-in-time restore, so anything
     written *after* the export you restore from is lost for that
     collection. Weigh that loss against the damage before doing it.

## Rolling back a bad hosting deploy

Firebase Hosting keeps every previous release; rolling back doesn't require
a rebuild or a new deploy pipeline run.

### Console path (fastest, no local setup needed)

1. Firebase Console → your project → Hosting.
2. Under "Release history", find the last known-good release (the one
   before the bad deploy).
3. Click the **⋮** menu on that release → **Rollback**. This makes that
   release live again immediately.

### CLI path

```bash
# List recent releases for the site to find the version ID to roll back to.
firebase hosting:releases:list --project staging   # or --project prod

# Clone a specific prior version onto the live channel — this is the
# documented CLI equivalent of the Console's rollback button.
firebase hosting:clone SOURCE_SITE_ID:SOURCE_VERSION_ID TARGET_SITE_ID:live --project staging
```

`firebase hosting:clone` needs the exact version ID (from
`hosting:releases:list`) of the release you want back — for a same-project
rollback, `SOURCE_SITE_ID` and `TARGET_SITE_ID` are the same site.

Either path takes effect in seconds — Hosting rollback doesn't rebuild
anything, it just repoints the live release.

## Rolling back a bad functions deploy

Cloud Functions has **no** one-click rollback equivalent to Hosting's.
"Rolling back" a function means **redeploying the previous known-good
version's code**:

1. Find the last known-good commit/tag on `main` (the one before the bad
   deploy merged) — `git log --oneline` against the deploy history you
   established in the pre-rollback checklist.
2. Deploy functions from that commit:
   ```bash
   git checkout <known-good-sha>   # or a tag, in a clean checkout/worktree
   pnpm install --frozen-lockfile
   pnpm --filter @snapspare/functions build
   firebase deploy --only functions --project staging   # or prod
   ```
   This is the same `deploy:functions` path
   (`pnpm --filter @snapspare/functions build && firebase deploy --only
   functions`) the root `package.json` script and `deploy.yml` both use —
   there's no special rollback command, it's an ordinary deploy of older
   code.
3. Once verified, open a revert PR on `main` so the repo's HEAD matches
   what's actually running — otherwise the next ordinary deploy from `main`
   silently re-introduces the bad version.

### Rolling back both together

If both hosting and functions need to revert, **roll back functions
first, hosting second** — the mirror image of the forward deploy order
(`deploy.yml` deploys functions → rules → hosting for exactly this reason:
"a client calling a function that doesn't exist yet"). Rolling back hosting
first would put the *old* client bundle in front of the *new* (bad)
functions for however long the gap is; rolling back functions first means
the brief window where they're mismatched has the *new* client bundle
talking to *old* (good) functions, which is the safer direction if the
client is reasonably tolerant of an unfamiliar-but-working backend
response shape. If rules also changed as part of the bad deploy, roll them
back in the same step as functions (`firebase deploy --only
firestore:rules,storage --project <env>` from the known-good commit)
before touching hosting.

## After any rollback

- Re-run the pre-rollback checklist's Sentry/Cloud Logging check to confirm
  the error signal actually stopped.
- File/update an incident note: what broke, when, what was rolled back,
  whether any data needed manual correction.
- Fix forward on `main` before merging anything else that depends on the
  reverted change.

## Secrets and manual setup this pipeline still needs

These don't exist yet in this repo/GitHub project — a human operator has
to create them before `preview.yml`/`deploy.yml` can run for real:

- **`FIREBASE_SERVICE_ACCOUNT_DEV`** (repo secret) — JSON key for a service
  account on `snapspare-edcc1` with Firebase Hosting Admin, used by
  `preview.yml`. Create via Firebase Console → Project Settings → Service
  Accounts → Generate new private key, or run `firebase init
  hosting:github` locally against the `dev` project.
- **`FIREBASE_SERVICE_ACCOUNT_STAGING`** / **`FIREBASE_SERVICE_ACCOUNT_PROD`**
  (repo secrets) — same idea, scoped to the `staging`/`prod` projects, with
  Firebase Admin (or the narrower Hosting Admin + Cloud Functions Admin +
  Cloud Datastore Index Admin roles), used by `deploy.yml`.
- **Real `staging`/`prod` GCP/Firebase projects.** `.firebaserc`'s
  `staging` (`snapspare-staging`) and `prod` (`snapspare-prod`) aliases are
  still placeholder project ids — nothing has been provisioned at Google
  Cloud. `deploy.yml` will fail at the "Authenticate" step until real
  projects exist at those ids (or the aliases are updated to point at
  whatever real ids get provisioned) and Firestore/Storage/Hosting are
  enabled on each with `firebase deploy` run at least once manually to
  establish them.
- **GitHub Environment `production` protection rules.** `deploy.yml`'s
  `deploy-prod` job sets `environment: production`, but GitHub Environments
  don't gate anything until a repo admin configures required reviewers:
  repo Settings → Environments → `production` → add required reviewers (and
  optionally a wait timer / restrict to `main`). This can't be done from a
  workflow file — someone with admin access on the GitHub repo has to do it
  once.
- **The Firestore backup GCS bucket(s).** `gs://{projectId}-firestore-backups`
  for each environment needs to be created manually (`gsutil mb` or GCS
  Console) — see `functions/src/admin/scheduledFirestoreBackup.ts`'s header
  comment and `firestore-restore-drill.md`.
