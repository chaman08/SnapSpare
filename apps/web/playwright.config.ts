import { defineConfig, devices } from '@playwright/test'

/**
 * E2E config (Phase 23) — targets the Firebase emulator suite, never a real
 * project. Run `firebase emulators:start` (full suite: auth, firestore,
 * functions, storage — not just `--only firestore` like the vitest emulator
 * tests use, since these specs drive real sign-in and real onCall functions
 * through the actual UI) in one terminal, then `pnpm --filter @snapspare/web
 * test:e2e` in another — see e2e/README.md for the full local setup and the
 * one thing this suite deliberately doesn't cover (Typesense-backed search).
 *
 * Mobile-only project: this product is mobile-first (360px minimum
 * viewport, see the design-system brief), so that's the one viewport these
 * specs run against, matching "run on mobile viewport in CI".
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false, // each spec seeds/mutates its own emulator-backed Firestore data via unique ids, but they share one dev server/browser — keep runs simple and easy to debug rather than racing them
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'pnpm --filter @snapspare/web dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 60_000,
    env: {
      VITE_USE_EMULATORS: 'true',
      VITE_FIREBASE_API_KEY: 'demo-api-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'demo-snapspare.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'demo-snapspare',
      VITE_FIREBASE_STORAGE_BUCKET: 'demo-snapspare.appspot.com',
      VITE_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
      VITE_FIREBASE_APP_ID: '1:000000000000:web:0000000000000000000000',
    },
  },
})
