import { CATALOG_PART_SEARCH_COLLECTION_NAME, type CreateSearchKeyResponse } from '@snapspare/shared'
import { httpsCallable } from 'firebase/functions'
import Typesense from 'typesense'
import { functions } from '@/lib/firebase'

// See the identical comment in functions/src/search/typesenseClient.ts.
type TypesenseClient = InstanceType<typeof Typesense.Client>

const createCatalogPartSearchKeyCallable = httpsCallable<Record<string, never>, CreateSearchKeyResponse>(
  functions,
  'createCatalogPartSearchKey',
)

const REFRESH_BUFFER_MS = 5 * 60 * 1000

let cached: { client: TypesenseClient; expiresAt: number } | undefined
let inFlight: Promise<TypesenseClient> | undefined

async function fetchScopedClient(): Promise<TypesenseClient> {
  const result = await createCatalogPartSearchKeyCallable({})
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
 * Seller-only counterpart to features/search/api/searchClient.ts's
 * getSearchClient — scoped to the `catalog_parts` collection via
 * createCatalogPartSearchKey (auth required), never the public
 * createSearchKey. Powers the "Add listing" part-number/name/brand
 * typeahead only; nothing buyer-facing uses this.
 */
export async function getCatalogPartSearchClient(): Promise<TypesenseClient> {
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

export { CATALOG_PART_SEARCH_COLLECTION_NAME }
