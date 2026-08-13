import { z } from 'zod'
import { makeFirestoreConverter } from '../firestore/converter'
import { epochMsSchema } from './common'

/**
 * Phase 24 (launch readiness): the Grievance Officer disclosure the
 * Consumer Protection (E-Commerce) Rules, 2020 (Rule 5(1)) and the IT
 * (Intermediary Guidelines) Rules, 2021 both require — a named individual,
 * a physical address, an email, and the statutory response timelines
 * (acknowledge within 48 hours, resolve within 1 month of receipt, per
 * Rule 4(1)(b) of the 2021 Intermediary Guidelines). Placeholder contact
 * details below — a human operator must fill in the real officer before
 * go-live, see README's Phase 24 section.
 */
export const grievanceOfficerSchema = z.object({
  name: z.string().min(1),
  designation: z.string().min(1).default('Grievance Officer'),
  email: z.string().email(),
  phone: z.string().min(1),
  address: z.string().min(1),
  acknowledgeWithinHours: z.number().int().positive().default(48),
  resolveWithinDays: z.number().int().positive().default(30),
})
export type GrievanceOfficer = z.infer<typeof grievanceOfficerSchema>

/** One open/close pair per day; `closed: true` days omit open/close. IST throughout — this platform has no other timezone to support. */
export const businessHoursDaySchema = z.object({
  closed: z.boolean().default(false),
  opensAt: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  closesAt: z.string().regex(/^\d{2}:\d{2}$/).optional(),
})
export type BusinessHoursDay = z.infer<typeof businessHoursDaySchema>

export const businessHoursSchema = z.object({
  timezone: z.literal('Asia/Kolkata').default('Asia/Kolkata'),
  monday: businessHoursDaySchema,
  tuesday: businessHoursDaySchema,
  wednesday: businessHoursDaySchema,
  thursday: businessHoursDaySchema,
  friday: businessHoursDaySchema,
  saturday: businessHoursDaySchema,
  sunday: businessHoursDaySchema,
})
export type BusinessHours = z.infer<typeof businessHoursSchema>

/** Singleton document, conventionally at config/app. */
export const configSchema = z.object({
  id: z.string().min(1),
  platformCommissionDefaultPercent: z.number().min(0).max(100),
  minOrderValuePaise: z.number().int().nonnegative().optional(),
  supportPhone: z.string().optional(),
  supportEmail: z.string().email().optional(),
  maintenanceMode: z.boolean().default(false),
  featureFlags: z.record(z.string(), z.boolean()).default({}),
  bannerMessage: z.object({ en: z.string(), hi: z.string() }).optional(),
  /** Publishable Razorpay key (safe to expose to the client — the secret key/webhook secret live only in Cloud Functions config, never in Firestore). Checkout's payment section can't open Razorpay Standard Checkout without this. */
  razorpayKeyId: z.string().optional(),
  /** Platform-wide Cash on Delivery switch. Even when true, COD at checkout still requires every seller in the cart to support it, the order to be under codCapPaise, and the buyer to have no codAbuseFlag. */
  codEnabled: z.boolean().default(true),
  codCapPaise: z.number().int().positive().optional(),
  codFeePaise: z.number().int().nonnegative().optional(),
  /** Order total (post-discount, pre-COD-fee) at or above which Razorpay's EMI option is shown. Absent hides EMI entirely. */
  emiThresholdPaise: z.number().int().positive().optional(),
  /** Minutes a `pending_payment` order holds its stock reservation before releaseExpiredReservations cancels it. */
  reservationExpiryMinutes: z.number().int().positive().default(15),
  /** Hours a seller has to accept a newly-confirmed subOrder before autoCancelUnacceptedSubOrders cancels it, refunds stock, and records an SLA breach. */
  sellerAcceptSlaHours: z.number().int().positive().default(24),
  /** Fallback return window (days after delivery) used when a listing doesn't set its own `returnWindowDays`. */
  defaultReturnWindowDays: z.number().int().nonnegative().default(7),
  /** Phase 22: canonical production origin (e.g. "https://snapspare.app"), no trailing slash — every absolute URL a Cloud Function generates (sitemap entries, canonical/OG URLs baked into a prerendered page) is built from this rather than a hardcoded domain. Falls back to a placeholder in functions/src/seo/siteOrigin.ts when unset, so dev/emulator environments don't need it configured. */
  siteOrigin: z.string().url().optional(),
  /** Phase 24: registered operating-company identity, shown in the footer and on every legal page (Terms/Seller Agreement/Privacy Policy all reference "the Company" by this name). Placeholder — set to the real registered entity before go-live. */
  companyLegalName: z.string().optional(),
  companyRegistrationNumber: z.string().optional(),
  companyRegisteredAddress: z.string().optional(),
  grievanceOfficer: grievanceOfficerSchema.optional(),
  /** WhatsApp Business number for the support entry point (`wa.me` deep link) — distinct from the WhatsApp Cloud API sender number in Cloud Functions config, though in practice they're usually the same number. */
  supportWhatsappNumber: z.string().optional(),
  supportBusinessHours: businessHoursSchema.optional(),
  /** Hours from ticket open to `slaBreachAt` — see supportTicket.ts. Distinct from sellerAcceptSlaHours (order fulfilment) and returnsConfig's disputeSlaHours (escalation review) — this is the customer-support contact-form SLA the public SLA policy page states. */
  supportTicketSlaHours: z.number().int().positive().default(48),
  updatedAt: epochMsSchema,
})
export type Config = z.infer<typeof configSchema>

export const configConverter = makeFirestoreConverter(configSchema)
