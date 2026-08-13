import { defineConfig } from 'vitest/config'

// Targets only the emulator-backed suite — run via `pnpm test:emulator`,
// which needs a live Firestore emulator (see that script's doc comment in
// package.json). The plain `vitest.config.ts` used by `pnpm test` excludes
// these files, so they never run without the emulator present.
export default defineConfig({
  test: {
    include: ['**/*.emulator.test.ts'],
    exclude: ['**/node_modules/**', '**/lib/**'],
    // Real transaction contention + retries against the emulator (plus its
    // own cold-start on the very first request) run well past vitest's
    // default 5s per-test timeout.
    testTimeout: 20_000,
  },
})
