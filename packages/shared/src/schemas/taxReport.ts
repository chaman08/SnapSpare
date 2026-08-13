import { z } from 'zod'
import { sellerIdSchema } from '../ids'

/** Calendar-month period selector shared by every admin tax report below — "2026-08" style, unambiguous regardless of financial-year boundaries. */
export const reportMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Expected YYYY-MM')
export type ReportMonth = z.infer<typeof reportMonthSchema>

const monthlyReportRequestSchema = z.object({
  month: reportMonthSchema,
  /** Restrict to one seller (e.g. a support investigation); omit for the marketplace-wide report. */
  sellerId: sellerIdSchema.optional(),
})

// ---------------------------------------------------------------------------
// getGstr1SummaryReport — outward-supply summary in a GSTR-1-adjacent shape
// (B2B/B2C split, rate-wise taxable value + tax), per seller, exportable.
// ---------------------------------------------------------------------------

export const getGstr1SummaryRequestSchema = monthlyReportRequestSchema
export type GetGstr1SummaryRequest = z.infer<typeof getGstr1SummaryRequestSchema>

export const gstr1SummaryRowSchema = z.object({
  sellerId: sellerIdSchema,
  sellerLegalName: z.string(),
  sellerGstin: z.string(),
  supplyType: z.enum(['b2b', 'b2c']),
  gstRatePercent: z.number(),
  invoiceCount: z.number().int().nonnegative(),
  taxableValuePaise: z.number().int().nonnegative(),
  cgstPaise: z.number().int().nonnegative(),
  sgstPaise: z.number().int().nonnegative(),
  igstPaise: z.number().int().nonnegative(),
})
export type Gstr1SummaryRow = z.infer<typeof gstr1SummaryRowSchema>

export const getGstr1SummaryResultSchema = z.object({
  month: reportMonthSchema,
  rows: z.array(gstr1SummaryRowSchema),
  csv: z.string(),
})
export type GetGstr1SummaryResult = z.infer<typeof getGstr1SummaryResultSchema>

// ---------------------------------------------------------------------------
// getTcsSummaryReport — per-seller net taxable supplies + TCS withheld, the
// shape needed for GSTR-8 reconciliation.
// ---------------------------------------------------------------------------

export const getTcsSummaryRequestSchema = monthlyReportRequestSchema
export type GetTcsSummaryRequest = z.infer<typeof getTcsSummaryRequestSchema>

export const tcsSummaryRowSchema = z.object({
  sellerId: sellerIdSchema,
  sellerLegalName: z.string(),
  sellerGstin: z.string(),
  netTaxableSuppliesPaise: z.number().int(),
  tcsCgstPaise: z.number().int(),
  tcsSgstPaise: z.number().int(),
  tcsIgstPaise: z.number().int(),
  tcsTotalPaise: z.number().int(),
})
export type TcsSummaryRow = z.infer<typeof tcsSummaryRowSchema>

export const getTcsSummaryResultSchema = z.object({
  month: reportMonthSchema,
  rows: z.array(tcsSummaryRowSchema),
  csv: z.string(),
})
export type GetTcsSummaryResult = z.infer<typeof getTcsSummaryResultSchema>

// ---------------------------------------------------------------------------
// getTdsSummaryReport — quarterly, per Section 194-O's filing cadence.
// ---------------------------------------------------------------------------

export const reportQuarterSchema = z.enum(['Q1', 'Q2', 'Q3', 'Q4'])
export type ReportQuarter = z.infer<typeof reportQuarterSchema>

export const getTdsSummaryRequestSchema = z.object({
  /** "FY26-27" — see invoicing/financialYear.ts. */
  financialYear: z.string().min(1),
  quarter: reportQuarterSchema,
  sellerId: sellerIdSchema.optional(),
})
export type GetTdsSummaryRequest = z.infer<typeof getTdsSummaryRequestSchema>

export const tdsSummaryRowSchema = z.object({
  sellerId: sellerIdSchema,
  sellerLegalName: z.string(),
  sellerPan: z.string(),
  grossSaleExGstPaise: z.number().int(),
  tdsDeductedPaise: z.number().int(),
})
export type TdsSummaryRow = z.infer<typeof tdsSummaryRowSchema>

export const getTdsSummaryResultSchema = z.object({
  financialYear: z.string(),
  quarter: reportQuarterSchema,
  rows: z.array(tdsSummaryRowSchema),
  csv: z.string(),
})
export type GetTdsSummaryResult = z.infer<typeof getTdsSummaryResultSchema>

// ---------------------------------------------------------------------------
// getGmvTaxReport — monthly GMV + tax collected, marketplace-wide.
// ---------------------------------------------------------------------------

export const getGmvTaxReportRequestSchema = monthlyReportRequestSchema
export type GetGmvTaxReportRequest = z.infer<typeof getGmvTaxReportRequestSchema>

export const getGmvTaxReportResultSchema = z.object({
  month: reportMonthSchema,
  subOrderCount: z.number().int().nonnegative(),
  gmvPaise: z.number().int().nonnegative(),
  taxableValuePaise: z.number().int().nonnegative(),
  cgstPaise: z.number().int().nonnegative(),
  sgstPaise: z.number().int().nonnegative(),
  igstPaise: z.number().int().nonnegative(),
  tcsPaise: z.number().int().nonnegative(),
  csv: z.string(),
})
export type GetGmvTaxReportResult = z.infer<typeof getGmvTaxReportResultSchema>

// ---------------------------------------------------------------------------
// exportEwayBillTasks — pending e-way-bill tasks marketplace-wide (or one
// seller), as CSV for the GST portal's bulk tools.
// ---------------------------------------------------------------------------

export const exportEwayBillTasksRequestSchema = z.object({
  sellerId: sellerIdSchema.optional(),
  status: z.enum(['pending', 'generated', 'not_required']).optional(),
})
export type ExportEwayBillTasksRequest = z.infer<typeof exportEwayBillTasksRequestSchema>

export const exportEwayBillTasksResultSchema = z.object({
  csv: z.string(),
  rowCount: z.number().int().nonnegative(),
})
export type ExportEwayBillTasksResult = z.infer<typeof exportEwayBillTasksResultSchema>
