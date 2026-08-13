// Fails (exit 1) if any src/locales/<code>/common.json is missing a key that
// English has, or has a key English doesn't (typos, dead keys). English is
// the reference locale; every other locale registered in src/i18n/locales.ts
// must have exactly the same key set. Run via `pnpm i18n:check` — wired into
// CI so a translation can never silently fall back to English in prod.
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const webRoot = fileURLToPath(new URL('..', import.meta.url))
const localesDir = `${webRoot}/src/locales`
const REFERENCE_LOCALE = 'en'

function flattenKeys(obj, prefix = '') {
  const keys = []
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...flattenKeys(value, path))
    } else {
      keys.push(path)
    }
  }
  return keys
}

function loadKeySet(locale) {
  const raw = readFileSync(`${localesDir}/${locale}/common.json`, 'utf8')
  return new Set(flattenKeys(JSON.parse(raw)))
}

const localeCodes = readdirSync(localesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)

if (!localeCodes.includes(REFERENCE_LOCALE)) {
  console.error(`i18n:check — reference locale "${REFERENCE_LOCALE}" not found under ${localesDir}`)
  process.exit(1)
}

const referenceKeys = loadKeySet(REFERENCE_LOCALE)
let hasError = false

for (const locale of localeCodes) {
  if (locale === REFERENCE_LOCALE) continue

  const keys = loadKeySet(locale)
  const missing = [...referenceKeys].filter((key) => !keys.has(key))
  const extra = [...keys].filter((key) => !referenceKeys.has(key))

  if (missing.length > 0) {
    hasError = true
    console.error(`\n✗ ${locale}/common.json is missing ${missing.length} key(s) present in ${REFERENCE_LOCALE}:`)
    for (const key of missing) console.error(`  - ${key}`)
  }
  if (extra.length > 0) {
    hasError = true
    console.error(`\n✗ ${locale}/common.json has ${extra.length} key(s) not present in ${REFERENCE_LOCALE}:`)
    for (const key of extra) console.error(`  - ${key}`)
  }
  if (missing.length === 0 && extra.length === 0) {
    console.log(`✓ ${locale}/common.json — ${keys.size} keys, in sync with ${REFERENCE_LOCALE}`)
  }
}

if (hasError) {
  console.error('\ni18n:check failed — fix the key mismatches above.')
  process.exit(1)
}

console.log(`\ni18n:check passed — ${localeCodes.length} locale(s), ${referenceKeys.size} keys each.`)
