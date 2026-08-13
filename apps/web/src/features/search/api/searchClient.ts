import { type CreateSearchKeyResponse, SEARCH_COLLECTION_NAME } from '@snapspare/shared'
import { httpsCallable } from 'firebase/functions'
import Typesense from 'typesense'
import { functions } from '@/lib/firebase'

// See the identical comment in functions/src/search/typesenseClient.ts —
// `Typesense.Client` only resolves as a type under some moduleResolution
// settings; `InstanceType<typeof Typesense.Client>` always works.
type TypesenseClient = InstanceType<typeof Typesense.Client>

const createSearchKeyCallable = httpsCallable<Record<string, never>, CreateSearchKeyResponse>(
  functions,
  'createSearchKey',
)

// Refetch a bit before the key actually expires so an in-flight search never
// races a key that just went stale.
const REFRESH_BUFFER_MS = 5 * 60 * 1000

let cached: { client: TypesenseClient; expiresAt: number } | undefined
let inFlight: Promise<TypesenseClient> | undefined

async function fetchScopedClient(): Promise<TypesenseClient> {
  const result = await createSearchKeyCallable({})
  const { searchOnlyApiKey, host, port, protocol, expiresAt } = result.data
  const client = new Typesense.Client({
    nodes: [{ host, port, protocol }],
    apiKey: searchOnlyApiKey,
    connectionTimeoutSeconds: 5,
  })
  cached = { client, expiresAt }
  return client
}

/**
 * Returns a Typesense client scoped to a short-lived search-only key (see
 * functions/src/search/createSearchKey.ts) — never the admin key, and never
 * a key that outlives this browser tab's need for it. Concurrent callers
 * during a refetch share one in-flight request instead of each minting
 * their own key.
 */
export async function getSearchClient(): Promise<TypesenseClient> {
  if (cached && cached.expiresAt - REFRESH_BUFFER_MS > Date.now()) {
    return cached.client
  }
  if (!inFlight) {
    inFlight = fetchScopedClient().finally(() => {
      inFlight = undefined
    })
  }
  return inFlight
}

export { SEARCH_COLLECTION_NAME }
