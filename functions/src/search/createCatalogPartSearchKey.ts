import { CATALOG_PART_SEARCH_COLLECTION_NAME, type CreateSearchKeyResponse } from '@snapspare/shared'
import { onCall } from 'firebase-functions/v2/https'
import Typesense from 'typesense'
import { requireSellerId } from '../orders/authz.js'
import { typesenseHost, typesensePort, typesenseProtocol, typesenseSearchOnlyApiKey } from './typesenseClient.js'

const SCOPED_KEY_TTL_SECONDS = 60 * 60

/**
 * Seller-only counterpart to `createSearchKey.ts` — that one is public
 * (signed-out buyer catalog search); this typeahead only exists inside the
 * seller "Add listing" flow, so there's no reason to let a signed-out client
 * mint a key against it. Otherwise identical: a short-lived scoped key
 * derived locally from the parent search-only key, never the admin key.
 */
export const createCatalogPartSearchKey = onCall(
  { enforceAppCheck: true, region: 'asia-south1', secrets: [typesenseSearchOnlyApiKey] },
  (request): CreateSearchKeyResponse => {
    requireSellerId(request)

    const client = new Typesense.Client({
      nodes: [
        {
          host: typesenseHost.value(),
          port: Number(typesensePort.value()),
          protocol: typesenseProtocol.value() as 'http' | 'https',
        },
      ],
      apiKey: typesenseSearchOnlyApiKey.value(),
      connectionTimeoutSeconds: 5,
    })

    const expiresAtEpochSeconds = Math.floor(Date.now() / 1000) + SCOPED_KEY_TTL_SECONDS

    const searchOnlyApiKey = client.keys().generateScopedSearchKey(typesenseSearchOnlyApiKey.value(), {
      expires_at: expiresAtEpochSeconds,
    })

    return {
      searchOnlyApiKey,
      host: typesenseHost.value(),
      port: Number(typesensePort.value()),
      protocol: typesenseProtocol.value() as 'http' | 'https',
      collectionName: CATALOG_PART_SEARCH_COLLECTION_NAME,
      expiresAt: expiresAtEpochSeconds * 1000,
    }
  },
)
