import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import { baseConfig } from '../../eslint.base.mjs'

export default [
  ...baseConfig,
  {
    // public/firebase-messaging-sw.js is generated (never hand-edited — see
    // scripts/generate-fcm-sw.mjs) and scripts/ are plain Node, neither
    // covered by tsconfig.app.json's `include`, so typed linting can't run
    // on them. e2e/ has its own tsconfig (below) instead of being ignored.
    ignores: ['public/**', 'scripts/**'],
  },
  {
    files: ['src/**/*.{ts,tsx}', 'vitest.setup.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.app.json',
        tsconfigRootDir: import.meta.dirname,
      },
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // Playwright specs: plain Node scripts that also reference browser
    // globals inside page.evaluate() closures (those run in-page, not in
    // this process, but still need to parse) — own tsconfig since they're
    // deliberately outside tsconfig.app.json's `include` (see e2e/README.md).
    files: ['e2e/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './e2e/tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.node, ...globals.browser },
    },
  },
]
