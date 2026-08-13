export interface PayToBankParams {
  accountHolderName: string
  accountNumber: string
  ifsc: string
  amountPaise: number
  /** Idempotency/audit reference the provider should echo back or dedupe on — a payout doc id or a refund-bank-detail id. */
  reference: string
}

export interface PayToBankResult {
  utr: string
  status: 'processed' | 'failed'
  failureReason?: string
}

/** A bank-transfer capable payment provider — implemented by both the seller payout run and COD-refund-to-bank paths, since a bank transfer is a bank transfer regardless of payer/payee. */
export interface PayoutProvider {
  payToBank(params: PayToBankParams): Promise<PayToBankResult>
}
