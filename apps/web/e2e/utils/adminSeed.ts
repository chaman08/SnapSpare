import { randomUUID } from 'node:crypto'
import {
  addressSchema,
  computeGstinCheckDigit,
  catalogPartSchema,
  configSchema,
  listingSchema,
  sellerSchema,
  userSchema,
} from '@snapspare/shared'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

/**
 * Admin-SDK seeding for e2e specs — same idiom as
 * functions/src/orders/__tests__/orderLifecycle.emulator.test.ts (build via
 * each real zod schema so a fixture can never silently drift from what the
 * app actually expects), but targets ALL the emulators (auth + firestore),
 * not just firestore, since these specs drive the real signed-in UI rather
 * than calling `onCall` handlers directly.
 */

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099'

if (getApps().length === 0) {
  initializeApp({ projectId: 'demo-snapspare' })
}

const db = getFirestore()
const auth = getAuth()
const now = Date.now()

export function freshId(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`
}

export function validGstin(stateCode: string): string {
  const first14 = `${stateCode}AAAAA0000A1Z`
  return `${first14}${computeGstinCheckDigit(first14)}`
}

export async function ensureAppConfig(): Promise<void> {
  await db.collection('config').doc('app').set(
    configSchema.parse({
      id: 'app',
      platformCommissionDefaultPercent: 10,
      codEnabled: true,
      reservationExpiryMinutes: 15,
      sellerAcceptSlaHours: 24,
      defaultReturnWindowDays: 7,
      updatedAt: now,
    }),
  )
}

export interface SeededBuyer {
  uid: string
  phoneNumber: string
  customToken: string
  addressId: string
}

/** Creates an Auth-emulator user (phone identity, matching the app's real sign-in method) plus a Firestore profile + saved address, and mints a custom token so the spec can sign in without driving the OTP UI — see apps/web/src/lib/firebase.ts's `__snapspareTestSignIn` hook. */
export async function seedBuyer(): Promise<SeededBuyer> {
  const uid = freshId('e2ebuyer')
  const phoneNumber = `+91${9000000000 + Math.floor(Math.random() * 99999999)}`
  const addressId = freshId('address')

  await auth.createUser({ uid, phoneNumber })

  await db
    .collection('users')
    .doc(uid)
    .set(
      userSchema.parse({
        id: uid,
        phone: phoneNumber.replace('+91', ''),
        displayName: 'E2E Buyer',
        roles: ['buyer'],
        primaryRole: 'buyer',
        buyerType: 'retail',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      }),
    )

  await db
    .collection('users')
    .doc(uid)
    .collection('addresses')
    .doc(addressId)
    .set(
      addressSchema.parse({
        id: addressId,
        userId: uid,
        label: 'Home',
        contactName: 'E2E Buyer',
        contactPhone: phoneNumber.replace('+91', ''),
        line1: '1 Test Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        stateCode: '27',
        pincode: '400001',
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      }),
    )

  const customToken = await auth.createCustomToken(uid)
  return { uid, phoneNumber, customToken, addressId }
}

export interface SeededSeller {
  ownerUid: string
  sellerId: string
  customToken: string
}

export async function seedSeller(): Promise<SeededSeller> {
  const ownerUid = freshId('e2eseller')
  const sellerId = ownerUid
  const warehouseAddressId = freshId('address')
  const phoneNumber = `+91${9100000000 + Math.floor(Math.random() * 99999999)}`

  await auth.createUser({ uid: ownerUid, phoneNumber })
  await auth.setCustomUserClaims(ownerUid, { role: 'seller', sellerId })

  await db
    .collection('users')
    .doc(ownerUid)
    .set(
      userSchema.parse({
        id: ownerUid,
        phone: phoneNumber.replace('+91', ''),
        displayName: 'E2E Seller Owner',
        roles: ['seller'],
        primaryRole: 'seller',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      }),
    )

  await db
    .collection('users')
    .doc(ownerUid)
    .collection('addresses')
    .doc(warehouseAddressId)
    .set(
      addressSchema.parse({
        id: warehouseAddressId,
        userId: ownerUid,
        label: 'Warehouse',
        contactName: 'E2E Seller Owner',
        contactPhone: phoneNumber.replace('+91', ''),
        line1: '1 Industrial Estate',
        city: 'Mumbai',
        state: 'Maharashtra',
        stateCode: '27',
        pincode: '400001',
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      }),
    )

  await db
    .collection('sellers')
    .doc(sellerId)
    .set(
      sellerSchema.parse({
        id: sellerId,
        ownerUserId: ownerUid,
        businessName: 'E2E Auto Parts Co',
        legalName: 'E2E Auto Parts Co Pvt Ltd',
        gstin: validGstin('27'),
        pan: 'ABCDE1234F',
        businessType: 'proprietorship',
        status: 'active',
        warehouseAddressId,
        bankAccount: {
          accountHolderName: 'E2E Auto Parts Co',
          accountNumber: '000123456789',
          ifsc: 'HDFC0000123',
          bankName: 'HDFC Bank',
        },
        codAvailable: true,
        createdAt: now,
        updatedAt: now,
      }),
    )

  // Custom-token claims are read from the user record at token-mint time,
  // so setCustomUserClaims above must happen before this.
  const customToken = await auth.createCustomToken(ownerUid, { role: 'seller', sellerId })
  return { ownerUid, sellerId, customToken }
}

export interface SeededPart {
  partId: string
  categorySlug: string
  subcategorySlug: string
}

/** A published catalog part + an active listing for it — the buyer journey navigates straight to this part's PDP by id (bypassing Typesense-backed search; see e2e/README.md for why). */
export async function seedPartWithListing(sellerId: string): Promise<SeededPart> {
  const partId = freshId('part')
  const listingId = freshId('listing')
  const categorySlug = 'brake'
  const subcategorySlug = 'brake-pads'

  await db
    .collection('catalogParts')
    .doc(partId)
    .set(
      catalogPartSchema.parse({
        id: partId,
        partNumber: `E2E-${partId}`,
        partType: 'aftermarket',
        categorySlug,
        subcategorySlug,
        name: 'E2E Test Brake Pad Set',
        createdAt: now,
        updatedAt: now,
      }),
    )

  await db
    .collection('listings')
    .doc(listingId)
    .set(
      listingSchema.parse({
        id: listingId,
        sellerId,
        partId,
        sku: `SKU-${listingId}`,
        title: 'E2E Test Brake Pad Set',
        condition: 'new',
        stockQty: 100,
        pricing: { moq: 1, stepQty: 1, tiers: [{ minQty: 1, maxQty: null, unitPricePaise: 1000_00 }] },
        taxIncluded: false,
        hsnCode: '87083000',
        gstRatePercent: 18,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      }),
    )

  return { partId, categorySlug, subcategorySlug }
}
