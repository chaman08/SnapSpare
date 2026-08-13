import { defineSecret } from 'firebase-functions/params'

/** Shiprocket account credentials, exchanged for a bearer token by shiprocketProvider.ts's login step. Set via `firebase functions:secrets:set SHIPROCKET_EMAIL` / `SHIPROCKET_PASSWORD` — never in env files committed to the repo. */
export const SHIPROCKET_EMAIL = defineSecret('SHIPROCKET_EMAIL')
export const SHIPROCKET_PASSWORD = defineSecret('SHIPROCKET_PASSWORD')

/** Static token configured in the Shiprocket dashboard's webhook settings (Shiprocket doesn't HMAC-sign webhook payloads like Razorpay does — it echoes this token back in a header instead). Set via `firebase functions:secrets:set SHIPROCKET_WEBHOOK_TOKEN`. */
export const SHIPROCKET_WEBHOOK_TOKEN = defineSecret('SHIPROCKET_WEBHOOK_TOKEN')
