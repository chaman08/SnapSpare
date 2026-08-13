import type { ChannelRegistry } from './types.js'
import type { WhatsappTemplate } from '../channels/whatsappAdapter.js'

/**
 * WhatsApp requires every template's name/wording/param count to be
 * pre-approved in Meta Business Manager before it can be sent — these names
 * (`*_v1`) are placeholders for that approval, covering the same
 * high-value subset as sms.ts. `params` must match the approved template's
 * body placeholder count/order exactly; a mismatch is rejected by the
 * Graph API at send time.
 */
export const WHATSAPP_TEMPLATES: ChannelRegistry<WhatsappTemplate> = {
  order_placed: {
    en: () => ({ templateName: 'order_placed_v1', languageCode: 'en', params: [] }),
    hi: () => ({ templateName: 'order_placed_v1', languageCode: 'hi', params: [] }),
  },
  payment_confirmed: {
    en: () => ({ templateName: 'payment_confirmed_v1', languageCode: 'en', params: [] }),
    hi: () => ({ templateName: 'payment_confirmed_v1', languageCode: 'hi', params: [] }),
  },
  payment_failed: {
    en: () => ({ templateName: 'payment_failed_v1', languageCode: 'en', params: [] }),
    hi: () => ({ templateName: 'payment_failed_v1', languageCode: 'hi', params: [] }),
  },
  suborder_accepted: {
    en: () => ({ templateName: 'suborder_accepted_v1', languageCode: 'en', params: [] }),
    hi: () => ({ templateName: 'suborder_accepted_v1', languageCode: 'hi', params: [] }),
  },
  suborder_shipped: {
    en: (v) => ({ templateName: 'suborder_shipped_v1', languageCode: 'en', params: [v.courier ?? 'courier', v.awb ?? ''] }),
    hi: (v) => ({ templateName: 'suborder_shipped_v1', languageCode: 'hi', params: [v.courier ?? 'कूरियर', v.awb ?? ''] }),
  },
  suborder_out_for_delivery: {
    en: () => ({ templateName: 'suborder_out_for_delivery_v1', languageCode: 'en', params: [] }),
    hi: () => ({ templateName: 'suborder_out_for_delivery_v1', languageCode: 'hi', params: [] }),
  },
  suborder_delivered: {
    en: () => ({ templateName: 'suborder_delivered_v1', languageCode: 'en', params: [] }),
    hi: () => ({ templateName: 'suborder_delivered_v1', languageCode: 'hi', params: [] }),
  },
  suborder_cancelled: {
    en: () => ({ templateName: 'suborder_cancelled_v1', languageCode: 'en', params: [] }),
    hi: () => ({ templateName: 'suborder_cancelled_v1', languageCode: 'hi', params: [] }),
  },
  return_approved: {
    en: () => ({ templateName: 'return_approved_v1', languageCode: 'en', params: [] }),
    hi: () => ({ templateName: 'return_approved_v1', languageCode: 'hi', params: [] }),
  },
  return_refunded: {
    en: () => ({ templateName: 'return_refunded_v1', languageCode: 'en', params: [] }),
    hi: () => ({ templateName: 'return_refunded_v1', languageCode: 'hi', params: [] }),
  },
  credit_due_reminder: {
    en: () => ({ templateName: 'credit_due_reminder_v1', languageCode: 'en', params: [] }),
    hi: () => ({ templateName: 'credit_due_reminder_v1', languageCode: 'hi', params: [] }),
  },
  credit_overdue: {
    en: () => ({ templateName: 'credit_overdue_v1', languageCode: 'en', params: [] }),
    hi: () => ({ templateName: 'credit_overdue_v1', languageCode: 'hi', params: [] }),
  },
  listing_low_stock: {
    en: (v) => ({ templateName: 'listing_low_stock_v1', languageCode: 'en', params: [v.count ?? 'Some'] }),
    hi: (v) => ({ templateName: 'listing_low_stock_v1', languageCode: 'hi', params: [v.count ?? 'कुछ'] }),
  },
  rfq_new_match: {
    en: () => ({ templateName: 'rfq_new_match_v1', languageCode: 'en', params: [] }),
    hi: () => ({ templateName: 'rfq_new_match_v1', languageCode: 'hi', params: [] }),
  },
  rfq_quote_received: {
    en: () => ({ templateName: 'rfq_quote_received_v1', languageCode: 'en', params: [] }),
    hi: () => ({ templateName: 'rfq_quote_received_v1', languageCode: 'hi', params: [] }),
  },
  sla_breach_warning: {
    en: () => ({ templateName: 'sla_breach_warning_v1', languageCode: 'en', params: [] }),
    hi: () => ({ templateName: 'sla_breach_warning_v1', languageCode: 'hi', params: [] }),
  },
  new_order_for_seller: {
    en: () => ({ templateName: 'new_order_for_seller_v1', languageCode: 'en', params: [] }),
    hi: () => ({ templateName: 'new_order_for_seller_v1', languageCode: 'hi', params: [] }),
  },
  // Phase 17: the only new notification type the design brief calls out for
  // WhatsApp specifically ("requested ... via WhatsApp with a deep link").
  review_request: {
    en: (v) => ({ templateName: 'review_request_v1', languageCode: 'en', params: [v.label ?? 'your recent purchase'] }),
    hi: (v) => ({ templateName: 'review_request_v1', languageCode: 'hi', params: [v.label ?? 'अपनी हाल की खरीद'] }),
  },
}
