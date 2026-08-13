const CHECKOUT_SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js'

export interface RazorpayCheckoutSuccess {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

interface RazorpayInstanceOptions {
  key: string
  order_id: string
  amount: number
  currency: string
  name: string
  description?: string
  prefill?: { name?: string; contact?: string; email?: string }
  notes?: Record<string, string>
  theme?: { color?: string }
  config?: {
    display: {
      blocks: Record<string, { name: string; instruments: Array<{ method: string }> }>
      sequence: string[]
      preferences: { show_default_blocks: boolean }
    }
  }
  handler: (response: RazorpayCheckoutSuccess) => void
  modal?: { ondismiss?: () => void }
}

interface RazorpayInstance {
  open: () => void
  on: (event: 'payment.failed', handler: (response: { error: { description?: string } }) => void) => void
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayInstanceOptions) => RazorpayInstance
  }
}

let scriptLoadPromise: Promise<void> | undefined

/** Razorpay's own guidance is to load checkout.js from their CDN at runtime rather than bundle it — this loads it once (cached across calls) the first time checkout actually needs it, not on every page. */
function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve()
  if (scriptLoadPromise) return scriptLoadPromise

  scriptLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = CHECKOUT_SCRIPT_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptLoadPromise = undefined
      reject(new Error('razorpay_script_load_failed'))
    }
    document.body.appendChild(script)
  })
  return scriptLoadPromise
}

export interface OpenRazorpayCheckoutOptions {
  keyId: string
  gatewayOrderId: string
  amountPaise: number
  currency: string
  buyerName: string
  buyerPhone?: string
  buyerEmail?: string
  /** Order id, shown in Razorpay's own notes for support/reconciliation. */
  orderId: string
  /** Whether to surface Razorpay's EMI option — checkout only passes true above config.emiThresholdPaise. */
  emiEnabled: boolean
}

/**
 * Opens Razorpay Standard Checkout with UPI surfaced first (intent + collect
 * + QR on desktop), then cards/netbanking/wallets/EMI — per the design spec.
 * Resolves with the gateway's signed success payload (still just a client
 * hint — confirmPayment/the webhook do the real signature verification),
 * rejects if the buyer dismisses the modal or the payment fails outright.
 */
export async function openRazorpayCheckout(options: OpenRazorpayCheckoutOptions): Promise<RazorpayCheckoutSuccess> {
  await loadRazorpayScript()

  return new Promise((resolve, reject) => {
    if (!window.Razorpay) {
      reject(new Error('razorpay_unavailable'))
      return
    }

    const instrumentBlocks: Array<{ method: string }> = [
      { method: 'card' },
      { method: 'netbanking' },
      { method: 'wallet' },
    ]
    if (options.emiEnabled) instrumentBlocks.push({ method: 'emi' })

    const rzp = new window.Razorpay({
      key: options.keyId,
      order_id: options.gatewayOrderId,
      amount: options.amountPaise,
      currency: options.currency,
      name: 'SnapSpare',
      prefill: { name: options.buyerName, contact: options.buyerPhone, email: options.buyerEmail },
      notes: { orderId: options.orderId },
      theme: { color: '#FF6B00' },
      config: {
        display: {
          blocks: {
            upi: { name: 'Pay by UPI', instruments: [{ method: 'upi' }] },
            other: { name: 'Other ways to pay', instruments: instrumentBlocks },
          },
          sequence: ['block.upi', 'block.other'],
          preferences: { show_default_blocks: false },
        },
      },
      handler: (response) => resolve(response),
      modal: {
        ondismiss: () => reject(new Error('checkout_dismissed')),
      },
    })

    rzp.on('payment.failed', () => reject(new Error('payment_failed')))
    rzp.open()
  })
}

/** Stable across retries of one "Place order" click (double-tap, flaky network) so createOrder's idempotency guard can recognise a resubmission — see functions/src/checkout/idempotency.ts. */
export function generateIdempotencyKey(): string {
  return crypto.randomUUID()
}
