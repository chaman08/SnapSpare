import { defineSecret } from 'firebase-functions/params'

/** Used to create Razorpay orders (server-side) and to verify the checkout-success signature the client hands back to confirmPayment. Set via `firebase functions:secrets:set RAZORPAY_KEY_SECRET`. */
export const RAZORPAY_KEY_SECRET = defineSecret('RAZORPAY_KEY_SECRET')

/** A separate secret configured in the Razorpay dashboard's webhook settings — never the same value as RAZORPAY_KEY_SECRET. Set via `firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET`. */
export const RAZORPAY_WEBHOOK_SECRET = defineSecret('RAZORPAY_WEBHOOK_SECRET')
