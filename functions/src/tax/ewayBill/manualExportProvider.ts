import type { EwayBillGenerationResult, EwayBillProvider } from './provider.js'

/**
 * No live NIC/GSP e-way bill API is integrated in this phase — a seller (or
 * admin) exports the flagged task's JSON/CSV payload (see
 * reports/exportEwayBillTasks.ts and buildEwayBillPayload.ts) and files it
 * manually on the GST e-way bill portal, then records the resulting number
 * via the `markEwayBillGenerated` callable. `generate()` always throws so
 * any future code path that assumes a live integration fails loudly instead
 * of silently no-op'ing.
 */
export class ManualExportEwayBillProvider implements EwayBillProvider {
  async generate(): Promise<EwayBillGenerationResult> {
    throw new Error('eway_bill_manual_filing_required')
  }
}
