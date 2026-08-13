import { type CreateSearchKeyResponse, SEARCH_COLLECTION_NAME } from '@snapspare/shared'
import { onCall } from 'firebase-functions/v2/https'
import Typesense from 'typesense'
import {
  typesenseHost,
  typesensePort,
  typesenseProtocol,
  typesenseSearchOnlyApiKey,
} from './typesenseClient.js'

const SCOPED_KEY_TTL_SECONDS = 60 * 60 // 1 hour — the web client refetches a fresh key on expiry.

/**
 * Public (no auth required — same reasoning as checkFitment: catalog search
 * is open to signed-out visitors). Returns a short-lived, HMAC-derived
 * Typesense key scoped to search-only actions on the listings collection, so
 * the browser never sees the parent search-only key (let alone the admin
 * key). Generating a scoped key is a local HMAC computation, not a network
 * call to Typesense, so this stays fast and has nothing to fail against.
 */
export const createSearchKey = onCall(
  { enforceAppCheck: true, region: 'asia-south1', secrets: [typesenseSearchOnlyApiKey] },
  (): CreateSearchKeyResponse => {
    const client = new Typesense.Client({
      nodes: [
        {
          host: typesenseHost.value(),
          port: Number(typesensePort.value()),
          protocol: typesenseProtocol.value() as 'http' | 'https',
        },
      ],
      // Unused for key generation itself, but required by the client constructor.
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
      collectionName: SEARCH_COLLECTION_NAME,
      expiresAt: expiresAtEpochSeconds * 1000,
    }
  },
)
