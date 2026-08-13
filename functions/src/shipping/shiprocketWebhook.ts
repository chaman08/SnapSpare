import { timingSafeEqual } from 'node:crypto'
import { getFirestore } from 'firebase-admin/firestore'
import { onRequest } from 'firebase-functions/v2/https'
import { applyTrackingUpdate } from './applyTrackingUpdate.js'
import { SHIPROCKET_WEBHOOK_TOKEN } from './secrets.js'

interface ShiprocketWebhookBody {
  awb?: string
  awb_code?: string
  current_status?: string
  shipment_status?: string
}

/** Constant-time token compare — mirrors razorpayWebhook.ts's verifySignature so a static-token check isn't vulnerable to a timing side-channel the same HMAC one already guards against. */
function tokenMatches(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided, 'utf8')
  const expectedBuffer = Buffer.from(expected, 'utf8')
  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer)
}

/**
 * Shiprocket webhook — the push half of tracking (design brief item 6),
 * mirrors checkout/razorpayWebhook.ts's shape but authenticates
 * differently: Shiprocket doesn't HMAC-sign its payloads, it echoes back a
 * static token you configure in its dashboard's webhook settings, sent as
 * a header (`x-api-key` here — whichever header name is configured on the
 * Shiprocket side must match). Public HTTPS endpoint, no Firebase Auth
 * token, so it must stay excluded from App Check enforcement the same way
 * razorpayWebhook is. reconcileAwbTracking.ts is the poll-based safety net
 * for whenever this doesn't fire.
 */
export const shiprocketWebhook = onRequest(
  { region: 'asia-south1', secrets: [SHIPROCKET_WEBHOOK_TOKEN] },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed')
      return
    }

    const providedToken = req.headers['x-api-key']
    if (typeof providedToken !== 'string' || !tokenMatches(providedToken, SHIPROCKET_WEBHOOK_TOKEN.value())) {
      res.status(401).send('Invalid token')
      return
    }

    const body = req.body as ShiprocketWebhookBody
    const awb = body.awb_code ?? body.awb
    const status = body.current_status ?? body.shipment_status
    if (!awb || !status) {
      res.status(200).send('ignored')
      return
    }

    const subOrderQuery = await getFirestore().collection('subOrders').where('shipment.awb', '==', awb).limit(1).get()
    const subOrderDoc = subOrderQuery.docs[0]
    if (!subOrderDoc) {
      res.status(200).send('subOrder not found')
      return
    }

    await applyTrackingUpdate(subOrderDoc.id, status)
    res.status(200).send('ok')
  },
)
