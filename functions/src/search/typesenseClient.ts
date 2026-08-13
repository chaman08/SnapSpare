import { defineSecret, defineString } from 'firebase-functions/params'
import Typesense from 'typesense'

// Non-secret connection details — set via `firebase functions:config` env
// vars / .env.<project> files (see functions/.env.example). Defaults point
// at the local Typesense dev container used by `pnpm dev:emulators`.
export const typesenseHost = defineString('TYPESENSE_HOST', { default: 'localhost' })
export const typesensePort = defineString('TYPESENSE_PORT', { default: '8108' })
export const typesenseProtocol = defineString('TYPESENSE_PROTOCOL', { default: 'http' })

// Secrets — set with `firebase functions:secrets:set TYPESENSE_ADMIN_API_KEY`
// etc. Never committed. The admin key can write to the collection; the
// search-only key is the *parent* key createSearchKey.ts derives short-lived
// scoped keys from (see that file) and itself never reaches the browser.
export const typesenseAdminApiKey = defineSecret('TYPESENSE_ADMIN_API_KEY')
export const typesenseSearchOnlyApiKey = defineSecret('TYPESENSE_SEARCH_ONLY_API_KEY')

// `typesense`'s default export is a plain object (`{ Client, SearchClient,
// Errors }`), not a namespace, so `Typesense.Client` only resolves as a
// *type* under some module-resolution settings. `InstanceType<typeof
// Typesense.Client>` instead uses it purely as a value (`typeof` operator),
// which resolves identically everywhere.
type TypesenseClient = InstanceType<typeof Typesense.Client>

let cachedAdminClient: TypesenseClient | undefined

/** Server-side client authenticated with the admin key — indexing writes only, never sent to the browser. */
export function getTypesenseAdminClient(): TypesenseClient {
  if (!cachedAdminClient) {
    cachedAdminClient = new Typesense.Client({
      nodes: [
        {
          host: typesenseHost.value(),
          port: Number(typesensePort.value()),
          protocol: typesenseProtocol.value() as 'http' | 'https',
        },
      ],
      apiKey: typesenseAdminApiKey.value(),
      connectionTimeoutSeconds: 8,
    })
  }
  return cachedAdminClient
}
