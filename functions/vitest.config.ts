import { defineConfig } from 'vitest/config'

// Emulator-backed tests (functions/src/orders/__tests__/*.emulator.test.ts)
// need a live Firestore emulator on FIRESTORE_EMULATOR_HOST and are run
// separately via `pnpm test:emulator` (see package.json), the same way
// packages/rules-tests' security-rules tests are opt-in via `pnpm
// test:rules` rather than part of the plain `pnpm test` CI step.
export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/lib/**', '**/*.emulator.test.ts'],
  },
})
