import { defineSecret } from 'firebase-functions/params'

/** WhatsApp Cloud API bearer token (Meta developer app). Set via `firebase functions:secrets:set WHATSAPP_ACCESS_TOKEN`. */
export const WHATSAPP_ACCESS_TOKEN = defineSecret('WHATSAPP_ACCESS_TOKEN')

/** MSG91 SMS API auth key. Set via `firebase functions:secrets:set MSG91_API_KEY`. */
export const MSG91_API_KEY = defineSecret('MSG91_API_KEY')

/** Resend transactional email API key. Set via `firebase functions:secrets:set RESEND_API_KEY`. */
export const RESEND_API_KEY = defineSecret('RESEND_API_KEY')
