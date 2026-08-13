import type { CheckServiceabilityResult, Seller } from '@snapspare/shared'
import {
  checkServiceabilityRequestSchema,
  configSchema,
  estimateSellerShipping,
  isValidStateCode,
  pincodeMasterSchema,
  resolveShippingZone,
  sellerSchema,
} from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { getShippingConfig } from '../shipping/shippingConfig.js'

/**
 * Per-seller delivery serviceability + COD availability for one pincode
 * (Phase 8 checkout's Delivery section) — surfaced before payment, per the
 * spec, rather than discovered after. This is a stub the same way
 * lookupVehicleByReg/verifyGstin are: it derives an answer from the
 * zone/weight heuristic in packages/shared/src/pricing/shipping.ts rather
 * than a live Shiprocket serviceability call, so today every seller with a
 * resolvable GSTIN state code is "serviceable" everywhere — only an unknown
 * pincode or an unresolvable seller state produces `serviceable: false`.
 * Swap the body for a real Shiprocket call in a later phase.
 */
export const checkServiceability = onCall(
  { enforceAppCheck: true, region: 'asia-south1' },
  async (request): Promise<CheckServiceabilityResult> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required')
    }

    const parsed = checkServiceabilityRequestSchema.safeParse(request.data)
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', 'A pincode and at least one seller id are required')
    }
    const { pincode, sellerIds } = parsed.data
    const uniqueSellerIds = Array.from(new Set(sellerIds))

    const db = getFirestore()
    const [pincodeSnapshot, configSnapshot, sellerSnapshots, shippingConfig] = await Promise.all([
      db.collection('pincodes').doc(pincode).get(),
      db.collection('config').doc('app').get(),
      Promise.all(uniqueSellerIds.map((id) => db.collection('sellers').doc(id).get())),
      getShippingConfig(),
    ])

    const parsedConfig = configSnapshot.exists
      ? configSchema.safeParse({ id: configSnapshot.id, ...configSnapshot.data() })
      : undefined
    const codEnabled = parsedConfig?.success ? parsedConfig.data.codEnabled : true

    if (!pincodeSnapshot.exists) {
      return {
        pincode,
        results: sellerIds.map((sellerId) => ({
          sellerId,
          serviceable: false,
          codAvailable: false,
          reason: 'pincode_not_found' as const,
        })),
      }
    }
    const pincodeRecord = pincodeMasterSchema.parse({ id: pincodeSnapshot.id, ...pincodeSnapshot.data() })
    // stateCodeSchema's inferred zod type is widened to `string`, not the
    // IndianStateCode literal union — re-validate the same way priceCart.ts
    // does rather than trust the parse's inferred type.
    if (!isValidStateCode(pincodeRecord.stateCode)) {
      return {
        pincode,
        results: sellerIds.map((sellerId) => ({
          sellerId,
          serviceable: false,
          codAvailable: false,
          reason: 'pincode_not_found' as const,
        })),
      }
    }
    const buyerStateCode = pincodeRecord.stateCode

    const sellerById = new Map<string, Seller>()
    for (const snapshot of sellerSnapshots) {
      if (!snapshot.exists) continue
      const parsedSeller = sellerSchema.safeParse({ id: snapshot.id, ...snapshot.data() })
      if (parsedSeller.success) sellerById.set(snapshot.id, parsedSeller.data)
    }

    const results = sellerIds.map((sellerId) => {
      const seller = sellerById.get(sellerId)
      const sellerStateCode = seller?.gstin.slice(0, 2)
      if (!seller || !sellerStateCode || !isValidStateCode(sellerStateCode)) {
        return { sellerId, serviceable: false, codAvailable: false, reason: 'seller_state_unresolved' as const }
      }

      const zone = resolveShippingZone(sellerStateCode, buyerStateCode)
      // Weight/subtotal don't affect etaDays (only the fee), so 0/0 is fine here — this callable never quotes shipping cost, only serviceability + ETA.
      const estimate = estimateSellerShipping(zone, 0, 0, shippingConfig)

      return {
        sellerId,
        serviceable: true,
        etaDaysMin: estimate.etaDaysMin,
        etaDaysMax: estimate.etaDaysMax,
        codAvailable: codEnabled && seller.codAvailable,
      }
    })

    return { pincode, results }
  },
)
