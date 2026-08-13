import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 20_000,
    hookTimeout: 20_000,
    // All test files share one Firestore emulator instance/project, and each
    // file's beforeEach calls testEnv.clearFirestore() — running files in
    // parallel would let one file wipe another's fixtures mid-run.
    fileParallelism: false,
  },
})
