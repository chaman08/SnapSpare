import type { ChannelRegistry } from './types.js'

/**
 * SMS is reserved for the small set of urgent/short-lived events where a
 * push notification alone might be missed (payment, shipping, SLA, credit
 * due) — every other type is push/email/in-app only. Kept under ~140
 * characters per DLT/SMS-length conventions.
 */
export const SMS_TEMPLATES: ChannelRegistry<string> = {
  order_placed: {
    en: () => 'SnapSpare: Your order has been placed successfully. Track it in the app.',
    hi: () => 'SnapSpare: आपका ऑर्डर सफलतापूर्वक दर्ज हो गया है। ऐप में ट्रैक करें।',
  },
  payment_confirmed: {
    en: () => 'SnapSpare: Payment received. Your order is confirmed.',
    hi: () => 'SnapSpare: भुगतान प्राप्त हुआ। आपका ऑर्डर कन्फर्म है।',
  },
  payment_failed: {
    en: () => 'SnapSpare: Your payment failed. Please retry to place your order.',
    hi: () => 'SnapSpare: भुगतान विफल रहा। कृपया ऑर्डर के लिए फिर प्रयास करें।',
  },
  suborder_accepted: {
    en: () => 'SnapSpare: Your order has been accepted by the seller and will be packed soon.',
    hi: () => 'SnapSpare: विक्रेता ने आपका ऑर्डर स्वीकार कर लिया है, जल्द पैक होगा।',
  },
  suborder_shipped: {
    en: (v) => `SnapSpare: Order shipped via ${v.courier ?? 'courier'}. AWB ${v.awb ?? ''}.`,
    hi: (v) => `SnapSpare: ऑर्डर ${v.courier ?? 'कूरियर'} द्वारा भेजा गया। AWB ${v.awb ?? ''}.`,
  },
  suborder_out_for_delivery: {
    en: () => 'SnapSpare: Your order is out for delivery today.',
    hi: () => 'SnapSpare: आपका ऑर्डर आज डिलीवर होगा।',
  },
  suborder_delivered: {
    en: () => 'SnapSpare: Your order has been delivered.',
    hi: () => 'SnapSpare: आपका ऑर्डर डिलीवर हो गया है।',
  },
  suborder_cancelled: {
    en: () => 'SnapSpare: Your order has been cancelled and any payment refunded.',
    hi: () => 'SnapSpare: आपका ऑर्डर रद्द कर दिया गया है, भुगतान रिफंड होगा।',
  },
  return_approved: {
    en: () => 'SnapSpare: Your return request has been approved.',
    hi: () => 'SnapSpare: आपका रिटर्न अनुरोध स्वीकृत हो गया है।',
  },
  return_refunded: {
    en: () => 'SnapSpare: Your return has been refunded.',
    hi: () => 'SnapSpare: आपके रिटर्न का रिफंड हो गया है।',
  },
  credit_due_reminder: {
    en: () => 'SnapSpare: Your Khata statement is due soon. Repay to avoid an overdue block.',
    hi: () => 'SnapSpare: आपका खाता विवरण जल्द देय है। ओवरड्यू से बचने हेतु भुगतान करें।',
  },
  credit_overdue: {
    en: () => 'SnapSpare: Your Khata payment is overdue. Repay now to keep your account active.',
    hi: () => 'SnapSpare: आपका खाता भुगतान अतिदेय है। खाता सक्रिय रखने हेतु अभी भुगतान करें।',
  },
  listing_low_stock: {
    en: (v) => `SnapSpare: ${v.count ?? 'Some'} of your listings are low on stock. Restock soon.`,
    hi: (v) => `SnapSpare: आपकी ${v.count ?? 'कुछ'} लिस्टिंग में स्टॉक कम है। जल्द रीस्टॉक करें।`,
  },
  rfq_new_match: {
    en: () => 'SnapSpare: A new RFQ matches your category. Respond before the window closes.',
    hi: () => 'SnapSpare: एक नया RFQ आपकी श्रेणी से मेल खाता है। समय रहते जवाब दें।',
  },
  rfq_quote_received: {
    en: () => 'SnapSpare: You received a new quote on your RFQ.',
    hi: () => 'SnapSpare: आपके RFQ पर एक नया कोट मिला है।',
  },
  sla_breach_warning: {
    en: () => 'SnapSpare: An order is close to its accept-by deadline. Accept it now.',
    hi: () => 'SnapSpare: एक ऑर्डर की स्वीकृति समय सीमा नज़दीक है। अभी स्वीकार करें।',
  },
  new_order_for_seller: {
    en: () => 'SnapSpare: You have a new order to accept.',
    hi: () => 'SnapSpare: आपको स्वीकार करने के लिए एक नया ऑर्डर मिला है।',
  },
}
