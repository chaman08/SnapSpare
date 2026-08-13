const RAZORPAY_API_BASE = 'https://api.razorpay.com/v1'

export interface RazorpayOrder {
  id: string
  amount: number
  currency: string
  receipt?: string
  status: string
}

/**
 * Thin fetch-based client for the two Razorpay Orders API calls this phase
 * needs. Deliberately not the `razorpay` npm SDK — Node 20's built-in
 * `fetch` covers this without adding an unpinned third-party dependency to
 * a Cloud Function, and the Orders API surface used here is tiny.
 */
export async function createRazorpayOrder(params: {
  keyId: string
  keySecret: string
  amountPaise: number
  receipt: string
  notes?: Record<string, string>
}): Promise<RazorpayOrder> {
  const auth = Buffer.from(`${params.keyId}:${params.keySecret}`).toString('base64')

  const response = await fetch(`${RAZORPAY_API_BASE}/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: params.amountPaise,
      currency: 'INR',
      receipt: params.receipt,
      notes: params.notes,
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Razorpay order creation failed (${response.status}): ${body}`)
  }

  return (await response.json()) as RazorpayOrder
}

export interface RazorpayRefund {
  id: string
  payment_id: string
  amount: number
  status: string
}

/**
 * Issues a refund against a captured payment — used only by
 * shipping/processRtoRefund.ts (RTO on a prepaid order). Every other
 * cancel/return path in this codebase deliberately defers the gateway
 * refund call to a later payouts/ledger phase (see cancelSubOrder.ts's doc
 * comment); RTO is the one case where nothing downstream would ever retry
 * it manually, so it's wired up now.
 */
export async function createRazorpayRefund(params: {
  keyId: string
  keySecret: string
  razorpayPaymentId: string
  amountPaise: number
  notes?: Record<string, string>
}): Promise<RazorpayRefund> {
  const auth = Buffer.from(`${params.keyId}:${params.keySecret}`).toString('base64')

  const response = await fetch(`${RAZORPAY_API_BASE}/payments/${params.razorpayPaymentId}/refund`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ amount: params.amountPaise, notes: params.notes }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Razorpay refund failed (${response.status}): ${body}`)
  }

  return (await response.json()) as RazorpayRefund
}

export interface RazorpayPaymentLink {
  id: string
  short_url: string
  status: string
}

/**
 * Creates a Razorpay Payment Link — used only by
 * functions/src/credit/createCreditRepaymentLink.ts (design brief item 7's
 * Khata repayment flow). Unlike the payout API, Payment Links are part of
 * standard Razorpay (no separate RazorpayX account activation needed), so
 * this is a real integration rather than a documented mock swap-point. The
 * `notes.purpose: 'credit_repayment'` this caller always sets is what lets
 * razorpayWebhook.ts's `payment.captured` handler route the eventual
 * payment to applyCreditRepayment.ts instead of the order-confirmation path.
 */
export async function createPaymentLink(params: {
  keyId: string
  keySecret: string
  amountPaise: number
  description: string
  customer?: { name?: string; contact?: string }
  notes: Record<string, string>
}): Promise<RazorpayPaymentLink> {
  const auth = Buffer.from(`${params.keyId}:${params.keySecret}`).toString('base64')

  const response = await fetch(`${RAZORPAY_API_BASE}/payment_links`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: params.amountPaise,
      currency: 'INR',
      description: params.description,
      customer: params.customer,
      notify: { sms: true, email: false },
      notes: params.notes,
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Razorpay payment link creation failed (${response.status}): ${body}`)
  }

  return (await response.json()) as RazorpayPaymentLink
}
