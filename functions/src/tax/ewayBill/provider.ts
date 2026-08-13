import type { EwayBillPayload } from '@snapspare/shared'

export interface EwayBillGenerationResult {
  ewayBillNumber: string
  /** Epoch ms — e-way bills issued for &lt;100km are valid 1 day from generation, longer distances get more; a real NIC/GSP integration returns this, the manual adapter leaves it undefined. */
  validUntil?: number
}

/**
 * Single swap point for a direct NIC/GSP e-way bill API integration, same
 * pattern as shipping/provider.ts and vehicle/lookupVehicleByReg.ts. No
 * such integration exists yet (design brief item 6 explicitly scopes this
 * phase to "flag + exportable JSON/CSV", not a live API call) — see
 * manualExportProvider.ts, the current implementation.
 */
export interface EwayBillProvider {
  generate(payload: EwayBillPayload): Promise<EwayBillGenerationResult>
}
