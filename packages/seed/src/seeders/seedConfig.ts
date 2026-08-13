import { configSchema } from '@snapspare/shared'
import { db } from '../lib/firebaseAdmin.js'

export async function seedConfig(): Promise<void> {
  const now = Date.now()
  const { id: _id, ...configDoc } = configSchema.parse({
    id: 'app',
    platformCommissionDefaultPercent: 8,
    minOrderValuePaise: 20_000, // ₹200
    supportPhone: '+911800123456',
    supportEmail: 'support@snapspare.in',
    maintenanceMode: false,
    featureFlags: { rfq: true, creditLine: true },
    bannerMessage: {
      en: 'Free shipping on your first order over ₹2,000!',
      hi: '₹2,000 से ऊपर के पहले ऑर्डर पर मुफ़्त शिपिंग!',
    },
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
    codEnabled: true,
    codCapPaise: 500_000, // ₹5,000
    codFeePaise: 3_000, // ₹30
    emiThresholdPaise: 300_000, // ₹3,000
    reservationExpiryMinutes: 15,
    // Phase 24: launch readiness. Placeholders — a human operator must
    // replace these with the real registered-entity/officer details before
    // go-live (see README's Phase 24 section and seedLegalContent.ts's
    // header comment, which references the same placeholders).
    companyLegalName: '[Company Legal Name — to be filled in before go-live]',
    companyRegistrationNumber: '[CIN/registration number — to be filled in before go-live]',
    companyRegisteredAddress: '[Registered Office Address — to be filled in before go-live]',
    grievanceOfficer: {
      name: '[Grievance Officer Name — to be filled in before go-live]',
      designation: 'Grievance Officer',
      email: 'grievance@snapspare.in',
      phone: '+91 1800-123-456',
      address: '[Registered Office Address — to be filled in before go-live]',
      acknowledgeWithinHours: 48,
      resolveWithinDays: 30,
    },
    supportWhatsappNumber: '+911800123456',
    supportBusinessHours: {
      timezone: 'Asia/Kolkata',
      monday: { closed: false, opensAt: '09:00', closesAt: '19:00' },
      tuesday: { closed: false, opensAt: '09:00', closesAt: '19:00' },
      wednesday: { closed: false, opensAt: '09:00', closesAt: '19:00' },
      thursday: { closed: false, opensAt: '09:00', closesAt: '19:00' },
      friday: { closed: false, opensAt: '09:00', closesAt: '19:00' },
      saturday: { closed: false, opensAt: '09:00', closesAt: '18:00' },
      sunday: { closed: true },
    },
    supportTicketSlaHours: 48,
    updatedAt: now,
  })
  await db.collection('config').doc('app').set(configDoc)
  console.log('  config/app: written')
}
