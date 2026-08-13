// Shared ESLint flat-config base, extended by apps/web, functions and packages/shared.
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'

export const baseConfig = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'warn',
    },
  },
  {
    ignores: [
      'dist/**',
      'lib/**',
      'node_modules/**',
      '**/*.config.{js,cjs,mjs,ts}',
      '**/*.config.d.ts',
    ],
  },
]

export default baseConfig
