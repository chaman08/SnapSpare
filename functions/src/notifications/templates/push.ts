import type { ChannelRegistry, TemplateVars } from './types.js'
import type { PushTemplate } from '../channels/pushAdapter.js'

function linkFor(vars: TemplateVars): string | undefined {
  if (vars.orderId) return `/orders/${vars.orderId}`
  if (vars.rfqId) return `/rfq/${vars.rfqId}`
  return undefined
}

/**
 * Push copy for every notification type — deliberately the same wording as
 * the existing in-app COPY table in orders/notify.ts (push is just that
 * same title/body shown as a system notification), so this file only adds
 * copy for the 10 types Phase 16 introduces. `link` is derived from
 * whichever id field the notification carries, consumed by the service
 * worker's notificationclick handler.
 */
export const PUSH_TEMPLATES: ChannelRegistry<PushTemplate> = {
  suborder_accepted: {
    en: (v) => ({ title: 'Order accepted', body: 'The seller has accepted your order and will start packing it.', link: linkFor(v) }),
    hi: (v) => ({ title: 'ऑर्डर स्वीकृत', body: 'विक्रेता ने आपका ऑर्डर स्वीकार कर लिया है और जल्द ही पैक करेगा।', link: linkFor(v) }),
  },
  suborder_rejected: {
    en: (v) => ({ title: 'Order declined', body: 'The seller was unable to fulfil this order. It has been cancelled and refunded.', link: linkFor(v) }),
    hi: (v) => ({ title: 'ऑर्डर अस्वीकृत', body: 'विक्रेता यह ऑर्डर पूरा नहीं कर सका। इसे रद्द कर रिफंड किया गया है।', link: linkFor(v) }),
  },
  suborder_packed: {
    en: (v) => ({ title: 'Order packed', body: 'Your order has been packed and is ready to ship.', link: linkFor(v) }),
    hi: (v) => ({ title: 'ऑर्डर पैक हो गया', body: 'आपका ऑर्डर पैक हो गया है और भेजने के लिए तैयार है।', link: linkFor(v) }),
  },
  suborder_shipped: {
    en: (v) => ({ title: 'Order shipped', body: `Shipped via ${v.courier ?? 'courier'} — AWB ${v.awb ?? ''}.`, link: linkFor(v) }),
    hi: (v) => ({ title: 'ऑर्डर भेज दिया गया', body: `${v.courier ?? 'कूरियर'} द्वारा भेजा गया — AWB ${v.awb ?? ''}.`, link: linkFor(v) }),
  },
  suborder_out_for_delivery: {
    en: (v) => ({ title: 'Out for delivery', body: 'Your order is out for delivery today.', link: linkFor(v) }),
    hi: (v) => ({ title: 'डिलीवरी के लिए निकल गया', body: 'आपका ऑर्डर आज डिलीवर हो जाएगा।', link: linkFor(v) }),
  },
  suborder_delivered: {
    en: (v) => ({ title: 'Order delivered', body: 'Your order has been delivered. We hope it fits right!', link: linkFor(v) }),
    hi: (v) => ({ title: 'ऑर्डर डिलीवर हो गया', body: 'आपका ऑर्डर डिलीवर हो गया है।', link: linkFor(v) }),
  },
  suborder_cancelled: {
    en: (v) => ({ title: 'Order cancelled', body: v.reason ? `Cancelled: ${v.reason}` : 'This order has been cancelled and any payment refunded.', link: linkFor(v) }),
    hi: (v) => ({ title: 'ऑर्डर रद्द', body: v.reason ? `रद्द: ${v.reason}` : 'यह ऑर्डर रद्द कर दिया गया है और भुगतान रिफंड किया जाएगा।', link: linkFor(v) }),
  },
  suborder_sla_breached: {
    en: (v) => ({ title: 'Order auto-cancelled', body: 'This order was not accepted in time and has been auto-cancelled.', link: linkFor(v) }),
    hi: (v) => ({ title: 'ऑर्डर स्वतः रद्द', body: 'यह ऑर्डर समय पर स्वीकार नहीं हुआ और स्वतः रद्द कर दिया गया है।', link: linkFor(v) }),
  },
  order_cancelled: {
    en: (v) => ({ title: 'Order cancelled', body: 'Your order has been cancelled.', link: linkFor(v) }),
    hi: (v) => ({ title: 'ऑर्डर रद्द', body: 'आपका ऑर्डर रद्द कर दिया गया है।', link: linkFor(v) }),
  },
  return_requested: {
    en: (v) => ({ title: 'Return requested', body: 'A buyer has requested a return on one of your orders.', link: linkFor(v) }),
    hi: (v) => ({ title: 'रिटर्न अनुरोध', body: 'एक खरीदार ने आपके ऑर्डर पर रिटर्न का अनुरोध किया है।', link: linkFor(v) }),
  },
  return_approved: {
    en: (v) => ({ title: 'Return approved', body: 'Your return request has been approved.', link: linkFor(v) }),
    hi: (v) => ({ title: 'रिटर्न स्वीकृत', body: 'आपका रिटर्न अनुरोध स्वीकृत हो गया है।', link: linkFor(v) }),
  },
  return_rejected: {
    en: (v) => ({ title: 'Return rejected', body: 'Your return request was not approved.', link: linkFor(v) }),
    hi: (v) => ({ title: 'रिटर्न अस्वीकृत', body: 'आपका रिटर्न अनुरोध स्वीकृत नहीं हुआ।', link: linkFor(v) }),
  },
  return_refunded: {
    en: (v) => ({ title: 'Refund processed', body: 'Your return has been refunded.', link: linkFor(v) }),
    hi: (v) => ({ title: 'रिफंड हो गया', body: 'आपके रिटर्न का रिफंड कर दिया गया है।', link: linkFor(v) }),
  },
  suborder_ndr_raised: {
    en: (v) => ({ title: 'Delivery attempt failed', body: "We're sorry, the courier could not deliver your order. Please confirm your address to request redelivery.", link: linkFor(v) }),
    hi: (v) => ({ title: 'डिलीवरी असफल', body: 'क्षमा करें, कूरियर आपका ऑर्डर डिलीवर नहीं कर सका। दोबारा डिलीवरी के लिए अपना पता कन्फर्म करें।', link: linkFor(v) }),
  },
  suborder_ndr_reattempt_requested: {
    en: (v) => ({ title: 'Redelivery requested', body: 'The buyer has confirmed their address — please arrange a reattempt.', link: linkFor(v) }),
    hi: (v) => ({ title: 'पुनः डिलीवरी का अनुरोध', body: 'खरीदार ने अपना पता कन्फर्म किया है — कृपया पुनः प्रयास की व्यवस्था करें।', link: linkFor(v) }),
  },
  suborder_rto_initiated: {
    en: (v) => ({ title: 'Order returned to seller', body: 'After repeated failed delivery attempts, this order is being sent back to the seller.', link: linkFor(v) }),
    hi: (v) => ({ title: 'ऑर्डर विक्रेता को वापस', body: 'बार-बार डिलीवरी असफल होने के बाद यह ऑर्डर विक्रेता को वापस भेजा जा रहा है।', link: linkFor(v) }),
  },
  suborder_rto_refunded: {
    en: (v) => ({ title: 'Order refunded', body: 'Your undelivered order has been refunded.', link: linkFor(v) }),
    hi: (v) => ({ title: 'ऑर्डर रिफंड हो गया', body: 'आपका अनडिलीवर्ड ऑर्डर रिफंड कर दिया गया है।', link: linkFor(v) }),
  },
  refund_failed: {
    en: (v) => ({ title: 'Refund needs attention', body: 'A refund could not be processed automatically and is being looked into.', link: linkFor(v) }),
    hi: (v) => ({ title: 'रिफंड पर ध्यान दें', body: 'एक रिफंड स्वतः प्रोसेस नहीं हो सका और उसकी जांच की जा रही है।', link: linkFor(v) }),
  },
  payout_paid: {
    en: (v) => ({ title: 'Payout sent', body: 'Your latest payout has been sent to your bank account.', link: linkFor(v) }),
    hi: (v) => ({ title: 'भुगतान भेजा गया', body: 'आपका नवीनतम भुगतान आपके बैंक खाते में भेज दिया गया है।', link: linkFor(v) }),
  },
  payout_failed: {
    en: (v) => ({ title: 'Payout failed', body: 'Your latest payout could not be sent. We will retry automatically.', link: linkFor(v) }),
    hi: (v) => ({ title: 'भुगतान विफल', body: 'आपका नवीनतम भुगतान नहीं भेजा जा सका। इसे स्वतः पुनः प्रयास किया जाएगा।', link: linkFor(v) }),
  },
  credit_limit_requested: {
    en: (v) => ({ title: 'Credit request received', body: 'Your Khata credit limit request has been received and is under review.', link: linkFor(v) }),
    hi: (v) => ({ title: 'क्रेडिट अनुरोध प्राप्त', body: 'आपका खाता क्रेडिट लिमिट अनुरोध प्राप्त हुआ है और समीक्षाधीन है।', link: linkFor(v) }),
  },
  credit_limit_approved: {
    en: (v) => ({ title: 'Khata credit approved', body: 'Your Khata credit limit has been approved.', link: linkFor(v) }),
    hi: (v) => ({ title: 'खाता क्रेडिट स्वीकृत', body: 'आपकी खाता क्रेडिट लिमिट स्वीकृत हो गई है।', link: linkFor(v) }),
  },
  credit_limit_rejected: {
    en: (v) => ({ title: 'Khata credit request declined', body: 'Your Khata credit limit request was not approved.', link: linkFor(v) }),
    hi: (v) => ({ title: 'खाता क्रेडिट अनुरोध अस्वीकृत', body: 'आपका खाता क्रेडिट लिमिट अनुरोध स्वीकृत नहीं हुआ।', link: linkFor(v) }),
  },
  credit_statement_ready: {
    en: (v) => ({ title: 'Khata statement ready', body: 'Your monthly Khata statement is ready to view.', link: linkFor(v) }),
    hi: (v) => ({ title: 'खाता विवरण तैयार', body: 'आपका मासिक खाता विवरण देखने के लिए तैयार है।', link: linkFor(v) }),
  },
  credit_due_reminder: {
    en: (v) => ({ title: 'Khata payment due soon', body: 'Your Khata statement is due soon. Please repay to avoid an overdue block.', link: linkFor(v) }),
    hi: (v) => ({ title: 'खाता भुगतान जल्द देय', body: 'आपका खाता विवरण जल्द देय है। ओवरड्यू से बचने हेतु भुगतान करें।', link: linkFor(v) }),
  },
  credit_overdue: {
    en: (v) => ({ title: 'Khata payment overdue', body: 'Your Khata payment is overdue. Please repay to keep your account active.', link: linkFor(v) }),
    hi: (v) => ({ title: 'खाता भुगतान अतिदेय', body: 'आपका खाता भुगतान अतिदेय है। खाता सक्रिय रखने हेतु भुगतान करें।', link: linkFor(v) }),
  },
  credit_blocked: {
    en: (v) => ({ title: 'Khata account blocked', body: 'Your Khata account has been blocked for an overdue payment.', link: linkFor(v) }),
    hi: (v) => ({ title: 'खाता अवरुद्ध', body: 'अतिदेय भुगतान के कारण आपका खाता अवरुद्ध कर दिया गया है।', link: linkFor(v) }),
  },
  credit_repayment_received: {
    en: (v) => ({ title: 'Repayment received', body: 'Your Khata repayment has been received and credited to your account.', link: linkFor(v) }),
    hi: (v) => ({ title: 'भुगतान प्राप्त हुआ', body: 'आपका खाता भुगतान प्राप्त हो गया है और खाते में जमा कर दिया गया है।', link: linkFor(v) }),
  },
  seller_application_submitted: {
    en: (v) => ({ title: 'Application submitted', body: 'Your seller application has been submitted and is awaiting review.', link: linkFor(v) }),
    hi: (v) => ({ title: 'आवेदन जमा हुआ', body: 'आपका विक्रेता आवेदन जमा हो गया है और समीक्षा की प्रतीक्षा में है।', link: linkFor(v) }),
  },
  seller_application_under_review: {
    en: (v) => ({ title: 'Application under review', body: 'Our team has started reviewing your seller application.', link: linkFor(v) }),
    hi: (v) => ({ title: 'आवेदन समीक्षाधीन', body: 'हमारी टीम ने आपके विक्रेता आवेदन की समीक्षा शुरू कर दी है।', link: linkFor(v) }),
  },
  seller_application_changes_requested: {
    en: (v) => ({ title: 'Changes needed on your application', body: 'Please review the requested changes and resubmit your seller application.', link: linkFor(v) }),
    hi: (v) => ({ title: 'आवेदन में बदलाव आवश्यक', body: 'कृपया मांगे गए बदलाव देखें और अपना विक्रेता आवेदन फिर से जमा करें।', link: linkFor(v) }),
  },
  seller_application_approved: {
    en: (v) => ({ title: 'Welcome aboard!', body: 'Your seller application has been approved. You can now start listing your parts.', link: linkFor(v) }),
    hi: (v) => ({ title: 'स्वागत है!', body: 'आपका विक्रेता आवेदन स्वीकृत हो गया है। अब आप अपने पार्ट्स लिस्ट करना शुरू कर सकते हैं।', link: linkFor(v) }),
  },
  seller_application_rejected: {
    en: (v) => ({ title: 'Application not approved', body: 'Your seller application was not approved. Contact support for details.', link: linkFor(v) }),
    hi: (v) => ({ title: 'आवेदन स्वीकृत नहीं हुआ', body: 'आपका विक्रेता आवेदन स्वीकृत नहीं हुआ। विवरण हेतु सहायता से संपर्क करें।', link: linkFor(v) }),
  },
  seller_staff_invited: {
    en: (v) => ({ title: 'You joined a seller team', body: 'You now have staff access to a seller account on SnapSpare.', link: linkFor(v) }),
    hi: (v) => ({ title: 'आप विक्रेता टीम से जुड़े', body: 'अब आपके पास SnapSpare पर एक विक्रेता खाते की स्टाफ एक्सेस है।', link: linkFor(v) }),
  },
  part_request_submitted: {
    en: (v) => ({ title: 'Part request submitted', body: 'Your new-part request has been submitted and is awaiting review.', link: linkFor(v) }),
    hi: (v) => ({ title: 'पार्ट अनुरोध जमा हुआ', body: 'आपका नया पार्ट अनुरोध जमा हो गया है और समीक्षा की प्रतीक्षा में है।', link: linkFor(v) }),
  },
  part_request_approved: {
    en: (v) => ({ title: 'Part request approved', body: 'Your requested part was added to the catalogue and a draft listing was created for you.', link: linkFor(v) }),
    hi: (v) => ({ title: 'पार्ट अनुरोध स्वीकृत', body: 'आपके अनुरोधित पार्ट को कैटलॉग में जोड़ दिया गया है और आपके लिए एक ड्राफ्ट लिस्टिंग बनाई गई है।', link: linkFor(v) }),
  },
  part_request_rejected: {
    en: (v) => ({ title: 'Part request declined', body: 'Your new-part request was not approved. Check the reviewer notes for details.', link: linkFor(v) }),
    hi: (v) => ({ title: 'पार्ट अनुरोध अस्वीकृत', body: 'आपका नया पार्ट अनुरोध स्वीकृत नहीं हुआ। विवरण हेतु समीक्षक टिप्पणियां देखें।', link: linkFor(v) }),
  },
  part_request_changes_requested: {
    en: (v) => ({ title: 'Changes needed on your part request', body: 'Please review the requested changes and resubmit.', link: linkFor(v) }),
    hi: (v) => ({ title: 'पार्ट अनुरोध में बदलाव आवश्यक', body: 'कृपया मांगे गए बदलाव देखें और फिर से जमा करें।', link: linkFor(v) }),
  },
  listing_low_stock: {
    en: (v) => ({ title: 'Low stock alert', body: `${v.count ?? 'Some'} of your listings are running low on stock. Restock soon to avoid going out of stock.`, link: linkFor(v) }),
    hi: (v) => ({ title: 'कम स्टॉक चेतावनी', body: `आपकी ${v.count ?? 'कुछ'} लिस्टिंग में स्टॉक कम हो रहा है। स्टॉक खत्म होने से बचने के लिए जल्द ही रीस्टॉक करें।`, link: linkFor(v) }),
  },
  rfq_new_match: {
    en: (v) => ({ title: 'New RFQ matched to you', body: 'A buyer is requesting a bulk quote in your category. Respond before the window closes.', link: linkFor(v) }),
    hi: (v) => ({ title: 'नया RFQ आपसे मेल खाता है', body: 'एक खरीदार आपकी श्रेणी में थोक कोट मांग रहा है। समय सीमा समाप्त होने से पहले जवाब दें।', link: linkFor(v) }),
  },
  rfq_quote_received: {
    en: (v) => ({ title: 'New quote received', body: 'A seller has quoted on your RFQ. Compare quotes and accept the one that works for you.', link: linkFor(v) }),
    hi: (v) => ({ title: 'नया कोट प्राप्त हुआ', body: 'एक विक्रेता ने आपके RFQ पर कोट दिया है। कोट की तुलना करें और जो उपयुक्त हो उसे स्वीकार करें।', link: linkFor(v) }),
  },
  rfq_quote_accepted: {
    en: (v) => ({ title: 'Quote accepted', body: 'Your quote was accepted and converted into an order.', link: linkFor(v) }),
    hi: (v) => ({ title: 'कोट स्वीकृत', body: 'आपका कोट स्वीकृत हो गया है और ऑर्डर में बदल दिया गया है।', link: linkFor(v) }),
  },
  rfq_quote_rejected: {
    en: (v) => ({ title: 'Quote not selected', body: 'The buyer accepted a different quote for this RFQ.', link: linkFor(v) }),
    hi: (v) => ({ title: 'कोट नहीं चुना गया', body: 'खरीदार ने इस RFQ के लिए दूसरा कोट स्वीकार किया है।', link: linkFor(v) }),
  },
  rfq_quote_withdrawn: {
    en: (v) => ({ title: 'Quote withdrawn', body: 'A seller has withdrawn their quote on your RFQ.', link: linkFor(v) }),
    hi: (v) => ({ title: 'कोट वापस लिया गया', body: 'एक विक्रेता ने आपके RFQ पर अपना कोट वापस ले लिया है।', link: linkFor(v) }),
  },
  rfq_withdrawn_by_buyer: {
    en: (v) => ({ title: 'RFQ withdrawn', body: 'The buyer has withdrawn this RFQ. Your quote is no longer active.', link: linkFor(v) }),
    hi: (v) => ({ title: 'RFQ वापस लिया गया', body: 'खरीदार ने यह RFQ वापस ले लिया है। आपका कोट अब सक्रिय नहीं है।', link: linkFor(v) }),
  },
  rfq_expired: {
    en: (v) => ({ title: 'RFQ expired', body: 'This RFQ closed without an accepted quote.', link: linkFor(v) }),
    hi: (v) => ({ title: 'RFQ समाप्त', body: 'यह RFQ बिना किसी स्वीकृत कोट के बंद हो गया।', link: linkFor(v) }),
  },
  rfq_message_received: {
    en: (v) => ({ title: 'New RFQ message', body: 'You have a new message on an RFQ quote.', link: linkFor(v) }),
    hi: (v) => ({ title: 'नया RFQ संदेश', body: 'आपके पास RFQ कोट पर एक नया संदेश है।', link: linkFor(v) }),
  },

  // Phase 16 additions
  order_placed: {
    en: (v) => ({ title: 'Order placed', body: `Your order${v.orderId ? ` #${v.orderId.slice(-6).toUpperCase()}` : ''} has been placed successfully.`, link: linkFor(v) }),
    hi: (v) => ({ title: 'ऑर्डर दर्ज हुआ', body: 'आपका ऑर्डर सफलतापूर्वक दर्ज कर लिया गया है।', link: linkFor(v) }),
  },
  payment_confirmed: {
    en: (v) => ({ title: 'Payment confirmed', body: 'Your payment was received and your order is confirmed.', link: linkFor(v) }),
    hi: (v) => ({ title: 'भुगतान की पुष्टि', body: 'आपका भुगतान प्राप्त हो गया है और ऑर्डर की पुष्टि हो गई है।', link: linkFor(v) }),
  },
  payment_failed: {
    en: (v) => ({ title: 'Payment failed', body: 'Your payment could not be completed. Please try again to place your order.', link: linkFor(v) }),
    hi: (v) => ({ title: 'भुगतान विफल', body: 'आपका भुगतान पूरा नहीं हो सका। कृपया ऑर्डर देने के लिए फिर से प्रयास करें।', link: linkFor(v) }),
  },
  refund_initiated: {
    en: (v) => ({ title: 'Refund initiated', body: 'Your refund has been initiated and will reflect in your account within a few business days.', link: linkFor(v) }),
    hi: (v) => ({ title: 'रिफंड शुरू हुआ', body: 'आपका रिफंड शुरू कर दिया गया है और कुछ कार्यदिवसों में आपके खाते में दिखेगा।', link: linkFor(v) }),
  },
  sla_breach_warning: {
    en: (v) => ({ title: 'Accept this order soon', body: `An order is close to its accept-by deadline${v.hoursLeft ? ` (${v.hoursLeft}h left)` : ''}. Accept it now to avoid an auto-cancellation.`, link: linkFor(v) }),
    hi: (v) => ({ title: 'यह ऑर्डर जल्द स्वीकार करें', body: 'एक ऑर्डर की स्वीकृति समय सीमा नज़दीक है। स्वतः रद्द होने से बचने के लिए अभी स्वीकार करें।', link: linkFor(v) }),
  },
  price_drop: {
    en: (v) => ({ title: 'Price drop', body: `A part on your wishlist just got cheaper${v.newPrice ? ` — now ₹${v.newPrice}` : ''}.`, link: linkFor(v) }),
    hi: (v) => ({ title: 'कीमत घटी', body: 'आपकी विशलिस्ट में शामिल एक पार्ट अब सस्ता हो गया है।', link: linkFor(v) }),
  },
  back_in_stock: {
    en: (v) => ({ title: 'Back in stock', body: 'A part you wanted is back in stock. Order it before it runs out again.', link: linkFor(v) }),
    hi: (v) => ({ title: 'स्टॉक में वापस आया', body: 'आपका चाहा गया पार्ट फिर से स्टॉक में है। खत्म होने से पहले ऑर्डर करें।', link: linkFor(v) }),
  },
  abandoned_cart: {
    en: () => ({ title: 'You left something in your cart', body: 'Your cart is still waiting — complete your order before items go out of stock.', link: '/cart' }),
    hi: () => ({ title: 'आपकी कार्ट में सामान बचा है', body: 'आपकी कार्ट अभी भी तैयार है — स्टॉक खत्म होने से पहले ऑर्डर पूरा करें।', link: '/cart' }),
  },
  kyc_status_change: {
    en: (v) => ({ title: 'KYC status updated', body: `Your seller KYC verification status is now: ${v.status ?? 'updated'}.`, link: linkFor(v) }),
    hi: (v) => ({ title: 'KYC स्थिति अपडेट हुई', body: 'आपकी विक्रेता KYC सत्यापन स्थिति अपडेट हो गई है।', link: linkFor(v) }),
  },
  new_order_for_seller: {
    en: (v) => ({ title: 'New order received', body: 'You have a new order to accept. Respond within your SLA window.', link: linkFor(v) }),
    hi: (v) => ({ title: 'नया ऑर्डर मिला', body: 'आपको स्वीकार करने के लिए एक नया ऑर्डर मिला है। अपनी SLA समय सीमा में जवाब दें।', link: linkFor(v) }),
  },
  // Phase 19 — Marketing module campaign composer. Free-text: the campaign's
  // own title/body, passed through as data vars by sendCampaign.ts.
  admin_campaign: {
    en: (v) => ({ title: v.campaignTitle ?? '', body: v.campaignBody ?? '' }),
    hi: (v) => ({ title: v.campaignTitle ?? '', body: v.campaignBody ?? '' }),
  },
}
