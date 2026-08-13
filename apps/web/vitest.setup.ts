import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import '@/lib/i18n'

// `globals: false` in vite.config.ts (explicit imports everywhere else) means
// @testing-library/react can't auto-detect a global `afterEach` to register
// its own cleanup — without this, unmounted components from a previous test
// stay in the DOM and the next test's queries see duplicates.
afterEach(() => {
  cleanup()
})
