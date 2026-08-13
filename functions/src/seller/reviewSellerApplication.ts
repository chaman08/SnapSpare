import {
  type ReviewSellerApplicationResult,
  reviewSellerApplicationRequestSchema,
  sellerApplicationSchema,
} from '@snapspare/shared'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isAdminRequest } from '../orders/authz.js'
import { queueNotificationDirect } from '../orders/notify.js'
import { writeAuditLog } from '../util/auditLog.js'
import { stripUndefined } from '../util/stripUndefined.js'
import { resolveUserLanguage } from './notifyLanguage.js'

/**
 * Admin-only resolution of a submitted seller application. `approve` is the
 * one action with a real side effect: it creates the `sellers/{uid}` doc
 * (id == the applicant's uid, see sellerApplication.ts), which in turn fires
 * the existing onSellerStatusChange.ts trigger to set the owner's custom
 * claims — this callable doesn't duplicate that logic, it just performs the
 * write that trigger reacts to. Blocked (failed-precondition) when the
 * applicant declared "not GST registered": this platform version has no
 * GSTIN-less seller support downstream (checkout shipping-zone resolution,
 * GST invoicing, GSTR-1/TCS reports all key off seller.gstin) — the reviewer
 * can only request_changes (ask for a GSTIN) or reject until one is added.
 */
export const reviewSellerApplication = onCall(
  { enforceAppCheck: true, region: 'asia-south1' },
  async (request): Promise<ReviewSellerApplicationResult> => {
    if (!request.auth || !isAdminRequest(request)) throw new HttpsError('permission-denied', 'admin_only')
    const adminUid = request.auth.uid

    const parsed = reviewSellerApplicationRequestSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'Invalid request')
    const input = parsed.data

    const db = getFirestore()
    const ref = db.collection('sellerApplications').doc(input.applicationId)
    const snapshot = await ref.get()
    if (!snapshot.exists) throw new HttpsError('not-found', 'application_not_found')
    const application = sellerApplicationSchema.parse({ id: snapshot.id, ...snapshot.data() })

    if (!['submitted', 'under_review'].includes(application.status)) {
      throw new HttpsError('failed-precondition', 'application_not_reviewable')
    }

    const now = Date.now()
    const language = await resolveUserLanguage(db, application.ownerUserId)

    if (input.action === 'start_review') {
      await ref.update({ status: 'under_review', reviewedBy: adminUid, updatedAt: now })
      await queueNotificationDirect(db, {
        userId: application.ownerUserId,
        type: 'seller_application_under_review',
        language,
      })
      await writeAuditLog({
        request,
        action: 'sellerApplication.startReview',
        targetType: 'sellerApplications',
        targetId: application.id,
        before: { status: application.status },
        after: { status: 'under_review' },
      })
      return { status: 'under_review' }
    }

    if (input.action === 'request_changes') {
      if (!input.notes || input.notes.length === 0) {
        throw new HttpsError('invalid-argument', 'At least one itemised reason is required')
      }
      const notes = input.notes.map((note) => ({ ...note, createdAt: now }))
      await ref.update({
        status: 'changes_requested',
        reviewNotes: [...application.reviewNotes, ...notes],
        reviewedBy: adminUid,
        reviewedAt: now,
        updatedAt: now,
      })
      await queueNotificationDirect(db, {
        userId: application.ownerUserId,
        type: 'seller_application_changes_requested',
        language,
      })
      await writeAuditLog({
        request,
        action: 'sellerApplication.requestChanges',
        targetType: 'sellerApplications',
        targetId: application.id,
        before: { status: application.status },
        after: { status: 'changes_requested', notes },
      })
      return { status: 'changes_requested' }
    }

    if (input.action === 'reject') {
      const notes = input.reason ? [{ step: 'general' as const, message: input.reason, createdAt: now }] : []
      await ref.update({
        status: 'rejected',
        reviewNotes: [...application.reviewNotes, ...notes],
        reviewedBy: adminUid,
        reviewedAt: now,
        updatedAt: now,
      })
      await queueNotificationDirect(db, {
        userId: application.ownerUserId,
        type: 'seller_application_rejected',
        language,
      })
      await writeAuditLog({
        request,
        action: 'sellerApplication.reject',
        targetType: 'sellerApplications',
        targetId: application.id,
        before: { status: application.status },
        after: { status: 'rejected' },
        note: input.reason,
      })
      return { status: 'rejected' }
    }

    // action === 'approve'
    if (!application.taxIdentity?.gstin) {
      throw new HttpsError('failed-precondition', 'gstin_required_to_approve')
    }
    if (!application.business || !application.registeredAddress || !application.bank || application.pickupAddresses.length === 0) {
      throw new HttpsError('failed-precondition', 'application_incomplete')
    }

    const sellerId = application.ownerUserId
    const defaultPickup = application.pickupAddresses.find((addr) => addr.isDefault) ?? application.pickupAddresses[0]

    const batch = db.batch()
    const sellerRef = db.collection('sellers').doc(sellerId)
    batch.set(sellerRef, {
      ownerUserId: application.ownerUserId,
      businessName: application.business.tradeName,
      legalName: application.business.legalName,
      gstin: application.taxIdentity.gstin,
      pan: application.taxIdentity.pan,
      businessType: application.business.businessType,
      gstComposition: application.taxIdentity.gstComposition,
      status: 'active',
      ratingAvg: 0,
      ratingCount: 0,
      warehouseAddressId: defaultPickup?.id,
      bankAccount: {
        accountHolderName: application.bank.accountHolderName,
        accountNumber: application.bank.accountNumber,
        ifsc: application.bank.ifsc,
        bankName: application.bank.bankName,
      },
      codAvailable: true,
      categorySlugs: application.business.categorySlugs,
      onboardedAt: now,
      createdAt: now,
      updatedAt: now,
    })

    for (const address of application.pickupAddresses) {
      const addressRef = sellerRef.collection('pickupAddresses').doc(address.id)
      batch.set(addressRef, { ...address, createdAt: now, updatedAt: now })
    }

    batch.set(sellerRef.collection('settings').doc('general'), {
      // Denormalized onto this doc (the only seller-scoped doc that's
      // publicly readable) for the public store page — see
      // sellerSettingsSchema's businessName/ratingAvg/ratingCount comment.
      businessName: application.business.tradeName,
      // Phase 24: Consumer Protection (E-Commerce) Rules Rule 5(4)
      // disclosure — see sellerSettingsSchema's legalName/registeredAddress
      // comment for why these live here rather than on the closed
      // `sellers/{id}` doc.
      legalName: application.business.legalName,
      registeredAddress: stripUndefined({
        line1: application.registeredAddress.line1,
        line2: application.registeredAddress.line2,
        city: application.registeredAddress.city,
        state: application.registeredAddress.state,
        stateCode: application.registeredAddress.stateCode,
        pincode: application.registeredAddress.pincode,
      }),
      gstin: application.taxIdentity.gstin,
      ratingAvg: 0,
      ratingCount: 0,
      holidayMode: { active: false },
      slaPreferences: { acceptWithinHours: 24, packWithinHours: 24 },
      notificationPreferences: { channels: ['push', 'whatsapp'] },
      updatedAt: now,
    })

    batch.update(ref, { status: 'approved', reviewedBy: adminUid, reviewedAt: now, updatedAt: now })

    await batch.commit()

    await queueNotificationDirect(db, {
      userId: application.ownerUserId,
      type: 'seller_application_approved',
      language,
    })
    await writeAuditLog({
      request,
      action: 'sellerApplication.approve',
      targetType: 'sellerApplications',
      targetId: application.id,
      before: { status: application.status },
      after: { status: 'approved', sellerId },
    })

    return { status: 'approved', sellerId }
  },
)
