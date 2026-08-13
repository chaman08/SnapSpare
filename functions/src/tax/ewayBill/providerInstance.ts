import { ManualExportEwayBillProvider } from './manualExportProvider.js'
import type { EwayBillProvider } from './provider.js'

/**
 * Single swap point — see provider.ts's doc comment. Replace with a real
 * NIC/GSP client when a direct API integration is ready:
 *
 *   import { NicEwayBillProvider } from './nicEwayBillProvider.js'
 *   export const ewayBillProvider: EwayBillProvider = new NicEwayBillProvider(
 *     EWAY_BILL_USERNAME.value(),
 *     EWAY_BILL_PASSWORD.value(),
 *   )
 */
export const ewayBillProvider: EwayBillProvider = new ManualExportEwayBillProvider()
