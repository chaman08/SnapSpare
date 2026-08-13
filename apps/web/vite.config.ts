import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'
// vitest/config re-exports Vite's defineConfig with the `test` field typed in,
// so this one file can configure both the dev/build server and the test runner.
import { defineConfig } from 'vitest/config'

// Sentry source-map upload (Phase 22 requirement 3) — only runs when
// SENTRY_AUTH_TOKEN is present (a CI/release build), so a local `pnpm build`
// without Sentry credentials configured still succeeds unchanged; the
// uploaded release is tagged with VITE_APP_VERSION, the same value
// lib/monitoring/sentry.ts's `Sentry.init({ release })` reads at runtime, so
// a captured error always resolves against the exact source that produced
// it. sourcemaps.filesToDeleteAfterUpload strips the maps from the dist/
// folder Firebase Hosting actually serves — they're uploaded to Sentry, not
// shipped to end users.
const sentryPlugin =
  process.env.SENTRY_AUTH_TOKEN && process.env.VITE_APP_VERSION
    ? sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
        release: { name: process.env.VITE_APP_VERSION },
        sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
      })
    : undefined

export default defineConfig({
  plugins: [react(), sentryPlugin].filter(Boolean),
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // e2e/ holds Playwright specs (run via `pnpm test:e2e`, see
    // playwright.config.ts) — they use Playwright's own `test()`/`expect()`,
    // which vitest's default include pattern would otherwise also try to
    // pick up and execute as vitest tests. Setting `exclude` replaces
    // vitest's own defaults rather than extending them, so those are
    // repeated here alongside `e2e/**`.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
      'e2e/**',
    ],
  },
  build: {
    sourcemap: Boolean(sentryPlugin),
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: [
            'firebase/app',
            'firebase/app-check',
            'firebase/auth',
            'firebase/firestore',
            'firebase/functions',
            'firebase/storage',
          ],
        },
      },
    },
  },
})
