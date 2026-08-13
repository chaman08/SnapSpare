import type { NotificationChannel, NotificationType } from '@snapspare/shared'
import type { Firestore, Transaction } from 'firebase-admin/firestore'

export type NotificationLanguage = 'en' | 'hi'

interface CopyInput {
  awb?: string
  courier?: string
  reason?: string
  count?: number
  /** Generic interpolated label (part/listing title, seller name, etc.) — used by the Phase 17 trust-system copy below rather than adding a narrow field per type. */
  label?: string
  /** Phase 19 Marketing module: the campaign's own admin-authored copy — admin_campaign is the one notification type with no fixed catalog wording. */
  campaignTitle?: string
  campaignBody?: string
}

/** en/hi labels for the NDR reason codes statusMapping.ts can raise — deliberately small/generic (courier-reported reason text is often terse/English-only) rather than trying to translate every possible carrier string. */
const NDR_REASON_LABEL: { en: string; hi: string } = {
  en: 'the courier could not deliver your order',
  hi: 'कूरियर आपका ऑर्डर डिलीवर नहीं कर सका',
}

type CopyFn = (input: CopyInput) => { title: string; body: string }

/**
 * Bilingual copy for every notification type. Deliberately plain data (not
 * routed through i18next — these are server-generated Firestore documents,
 * not rendered React UI strings) but still honours the project's en+hi
 * expectation. Phase 16's dispatchers read `title`/`body` directly; a
 * richer per-user-language template system can replace this if needed.
 */
const COPY: Record<NotificationType, { en: CopyFn; hi: CopyFn }> = {
  suborder_accepted: {
    en: () => ({ title: 'Order accepted', body: 'The seller has accepted your order and will start packing it.' }),
    hi: () => ({ title: 'ऑर्डर स्वीकृत', body: 'विक्रेता ने आपका ऑर्डर स्वीकार कर लिया है और जल्द ही पैक करेगा।' }),
  },
  suborder_rejected: {
    en: () => ({ title: 'Order declined', body: 'The seller was unable to fulfil this order. It has been cancelled and refunded.' }),
    hi: () => ({ title: 'ऑर्डर अस्वीकृत', body: 'विक्रेता यह ऑर्डर पूरा नहीं कर सका। इसे रद्द कर रिफंड किया गया है।' }),
  },
  suborder_packed: {
    en: () => ({ title: 'Order packed', body: 'Your order has been packed and is ready to ship.' }),
    hi: () => ({ title: 'ऑर्डर पैक हो गया', body: 'आपका ऑर्डर पैक हो गया है और भेजने के लिए तैयार है।' }),
  },
  suborder_shipped: {
    en: (i) => ({ title: 'Order shipped', body: `Shipped via ${i.courier ?? 'courier'} — AWB ${i.awb ?? ''}.` }),
    hi: (i) => ({ title: 'ऑर्डर भेज दिया गया', body: `${i.courier ?? 'कूरियर'} द्वारा भेजा गया — AWB ${i.awb ?? ''}.` }),
  },
  suborder_out_for_delivery: {
    en: () => ({ title: 'Out for delivery', body: 'Your order is out for delivery today.' }),
    hi: () => ({ title: 'डिलीवरी के लिए निकल गया', body: 'आपका ऑर्डर आज डिलीवर हो जाएगा।' }),
  },
  suborder_delivered: {
    en: () => ({ title: 'Order delivered', body: 'Your order has been delivered. We hope it fits right!' }),
    hi: () => ({ title: 'ऑर्डर डिलीवर हो गया', body: 'आपका ऑर्डर डिलीवर हो गया है।' }),
  },
  suborder_cancelled: {
    en: (i) => ({ title: 'Order cancelled', body: i.reason ? `Cancelled: ${i.reason}` : 'This order has been cancelled and any payment refunded.' }),
    hi: (i) => ({ title: 'ऑर्डर रद्द', body: i.reason ? `रद्द: ${i.reason}` : 'यह ऑर्डर रद्द कर दिया गया है और भुगतान रिफंड किया जाएगा।' }),
  },
  suborder_sla_breached: {
    en: () => ({ title: 'Order auto-cancelled', body: 'This order was not accepted in time and has been auto-cancelled.' }),
    hi: () => ({ title: 'ऑर्डर स्वतः रद्द', body: 'यह ऑर्डर समय पर स्वीकार नहीं हुआ और स्वतः रद्द कर दिया गया है।' }),
  },
  order_cancelled: {
    en: () => ({ title: 'Order cancelled', body: 'Your order has been cancelled.' }),
    hi: () => ({ title: 'ऑर्डर रद्द', body: 'आपका ऑर्डर रद्द कर दिया गया है।' }),
  },
  return_requested: {
    en: () => ({ title: 'Return requested', body: 'A buyer has requested a return on one of your orders.' }),
    hi: () => ({ title: 'रिटर्न अनुरोध', body: 'एक खरीदार ने आपके ऑर्डर पर रिटर्न का अनुरोध किया है।' }),
  },
  return_approved: {
    en: () => ({ title: 'Return approved', body: 'Your return request has been approved.' }),
    hi: () => ({ title: 'रिटर्न स्वीकृत', body: 'आपका रिटर्न अनुरोध स्वीकृत हो गया है।' }),
  },
  return_rejected: {
    en: () => ({ title: 'Return rejected', body: 'Your return request was not approved.' }),
    hi: () => ({ title: 'रिटर्न अस्वीकृत', body: 'आपका रिटर्न अनुरोध स्वीकृत नहीं हुआ।' }),
  },
  return_refunded: {
    en: () => ({ title: 'Refund processed', body: 'Your return has been refunded.' }),
    hi: () => ({ title: 'रिफंड हो गया', body: 'आपके रिटर्न का रिफंड कर दिया गया है।' }),
  },
  suborder_ndr_raised: {
    en: () => ({ title: 'Delivery attempt failed', body: `We're sorry, ${NDR_REASON_LABEL.en}. Please confirm your address to request redelivery.` }),
    hi: () => ({ title: 'डिलीवरी असफल', body: `क्षमा करें, ${NDR_REASON_LABEL.hi}। दोबारा डिलीवरी के लिए अपना पता कन्फर्म करें।` }),
  },
  suborder_ndr_reattempt_requested: {
    en: () => ({ title: 'Redelivery requested', body: 'The buyer has confirmed their address — please arrange a reattempt.' }),
    hi: () => ({ title: 'पुनः डिलीवरी का अनुरोध', body: 'खरीदार ने अपना पता कन्फर्म किया है — कृपया पुनः प्रयास की व्यवस्था करें।' }),
  },
  suborder_rto_initiated: {
    en: () => ({ title: 'Order returned to seller', body: 'After repeated failed delivery attempts, this order is being sent back to the seller.' }),
    hi: () => ({ title: 'ऑर्डर विक्रेता को वापस', body: 'बार-बार डिलीवरी असफल होने के बाद यह ऑर्डर विक्रेता को वापस भेजा जा रहा है।' }),
  },
  suborder_rto_refunded: {
    en: () => ({ title: 'Order refunded', body: 'Your undelivered order has been refunded.' }),
    hi: () => ({ title: 'ऑर्डर रिफंड हो गया', body: 'आपका अनडिलीवर्ड ऑर्डर रिफंड कर दिया गया है।' }),
  },
  refund_failed: {
    en: () => ({ title: 'Refund needs attention', body: 'A refund could not be processed automatically and is being looked into.' }),
    hi: () => ({ title: 'रिफंड पर ध्यान दें', body: 'एक रिफंड स्वतः प्रोसेस नहीं हो सका और उसकी जांच की जा रही है।' }),
  },
  payout_paid: {
    en: () => ({ title: 'Payout sent', body: 'Your latest payout has been sent to your bank account.' }),
    hi: () => ({ title: 'भुगतान भेजा गया', body: 'आपका नवीनतम भुगतान आपके बैंक खाते में भेज दिया गया है।' }),
  },
  payout_failed: {
    en: () => ({ title: 'Payout failed', body: 'Your latest payout could not be sent. We will retry automatically.' }),
    hi: () => ({ title: 'भुगतान विफल', body: 'आपका नवीनतम भुगतान नहीं भेजा जा सका। इसे स्वतः पुनः प्रयास किया जाएगा।' }),
  },
  credit_limit_requested: {
    en: () => ({ title: 'Credit request received', body: 'Your Khata credit limit request has been received and is under review.' }),
    hi: () => ({ title: 'क्रेडिट अनुरोध प्राप्त', body: 'आपका खाता क्रेडिट लिमिट अनुरोध प्राप्त हुआ है और समीक्षाधीन है।' }),
  },
  credit_limit_approved: {
    en: () => ({ title: 'Khata credit approved', body: 'Your Khata credit limit has been approved.' }),
    hi: () => ({ title: 'खाता क्रेडिट स्वीकृत', body: 'आपकी खाता क्रेडिट लिमिट स्वीकृत हो गई है।' }),
  },
  credit_limit_rejected: {
    en: () => ({ title: 'Khata credit request declined', body: 'Your Khata credit limit request was not approved.' }),
    hi: () => ({ title: 'खाता क्रेडिट अनुरोध अस्वीकृत', body: 'आपका खाता क्रेडिट लिमिट अनुरोध स्वीकृत नहीं हुआ।' }),
  },
  credit_statement_ready: {
    en: () => ({ title: 'Khata statement ready', body: 'Your monthly Khata statement is ready to view.' }),
    hi: () => ({ title: 'खाता विवरण तैयार', body: 'आपका मासिक खाता विवरण देखने के लिए तैयार है।' }),
  },
  credit_due_reminder: {
    en: () => ({ title: 'Khata payment due soon', body: 'Your Khata statement is due soon. Please repay to avoid an overdue block.' }),
    hi: () => ({ title: 'खाता भुगतान जल्द देय', body: 'आपका खाता विवरण जल्द देय है। ओवरड्यू से बचने हेतु भुगतान करें।' }),
  },
  credit_overdue: {
    en: () => ({ title: 'Khata payment overdue', body: 'Your Khata payment is overdue. Please repay to keep your account active.' }),
    hi: () => ({ title: 'खाता भुगतान अतिदेय', body: 'आपका खाता भुगतान अतिदेय है। खाता सक्रिय रखने हेतु भुगतान करें।' }),
  },
  credit_blocked: {
    en: () => ({ title: 'Khata account blocked', body: 'Your Khata account has been blocked for an overdue payment.' }),
    hi: () => ({ title: 'खाता अवरुद्ध', body: 'अतिदेय भुगतान के कारण आपका खाता अवरुद्ध कर दिया गया है।' }),
  },
  credit_repayment_received: {
    en: () => ({ title: 'Repayment received', body: 'Your Khata repayment has been received and credited to your account.' }),
    hi: () => ({ title: 'भुगतान प्राप्त हुआ', body: 'आपका खाता भुगतान प्राप्त हो गया है और खाते में जमा कर दिया गया है।' }),
  },
  seller_application_submitted: {
    en: () => ({ title: 'Application submitted', body: 'Your seller application has been submitted and is awaiting review.' }),
    hi: () => ({ title: 'आवेदन जमा हुआ', body: 'आपका विक्रेता आवेदन जमा हो गया है और समीक्षा की प्रतीक्षा में है।' }),
  },
  seller_application_under_review: {
    en: () => ({ title: 'Application under review', body: 'Our team has started reviewing your seller application.' }),
    hi: () => ({ title: 'आवेदन समीक्षाधीन', body: 'हमारी टीम ने आपके विक्रेता आवेदन की समीक्षा शुरू कर दी है।' }),
  },
  seller_application_changes_requested: {
    en: () => ({ title: 'Changes needed on your application', body: 'Please review the requested changes and resubmit your seller application.' }),
    hi: () => ({ title: 'आवेदन में बदलाव आवश्यक', body: 'कृपया मांगे गए बदलाव देखें और अपना विक्रेता आवेदन फिर से जमा करें।' }),
  },
  seller_application_approved: {
    en: () => ({ title: 'Welcome aboard!', body: 'Your seller application has been approved. You can now start listing your parts.' }),
    hi: () => ({ title: 'स्वागत है!', body: 'आपका विक्रेता आवेदन स्वीकृत हो गया है। अब आप अपने पार्ट्स लिस्ट करना शुरू कर सकते हैं।' }),
  },
  seller_application_rejected: {
    en: () => ({ title: 'Application not approved', body: 'Your seller application was not approved. Contact support for details.' }),
    hi: () => ({ title: 'आवेदन स्वीकृत नहीं हुआ', body: 'आपका विक्रेता आवेदन स्वीकृत नहीं हुआ। विवरण हेतु सहायता से संपर्क करें।' }),
  },
  seller_staff_invited: {
    en: () => ({ title: 'You joined a seller team', body: 'You now have staff access to a seller account on SnapSpare.' }),
    hi: () => ({ title: 'आप विक्रेता टीम से जुड़े', body: 'अब आपके पास SnapSpare पर एक विक्रेता खाते की स्टाफ एक्सेस है।' }),
  },
  part_request_submitted: {
    en: () => ({ title: 'Part request submitted', body: 'Your new-part request has been submitted and is awaiting review.' }),
    hi: () => ({ title: 'पार्ट अनुरोध जमा हुआ', body: 'आपका नया पार्ट अनुरोध जमा हो गया है और समीक्षा की प्रतीक्षा में है।' }),
  },
  part_request_approved: {
    en: () => ({ title: 'Part request approved', body: 'Your requested part was added to the catalogue and a draft listing was created for you.' }),
    hi: () => ({ title: 'पार्ट अनुरोध स्वीकृत', body: 'आपके अनुरोधित पार्ट को कैटलॉग में जोड़ दिया गया है और आपके लिए एक ड्राफ्ट लिस्टिंग बनाई गई है।' }),
  },
  part_request_rejected: {
    en: () => ({ title: 'Part request declined', body: 'Your new-part request was not approved. Check the reviewer notes for details.' }),
    hi: () => ({ title: 'पार्ट अनुरोध अस्वीकृत', body: 'आपका नया पार्ट अनुरोध स्वीकृत नहीं हुआ। विवरण हेतु समीक्षक टिप्पणियां देखें।' }),
  },
  part_request_changes_requested: {
    en: () => ({ title: 'Changes needed on your part request', body: 'Please review the requested changes and resubmit.' }),
    hi: () => ({ title: 'पार्ट अनुरोध में बदलाव आवश्यक', body: 'कृपया मांगे गए बदलाव देखें और फिर से जमा करें।' }),
  },
  listing_low_stock: {
    en: (i) => ({
      title: 'Low stock alert',
      body: `${i.count ?? 'Some'} of your listings are running low on stock. Restock soon to avoid going out of stock.`,
    }),
    hi: (i) => ({
      title: 'कम स्टॉक चेतावनी',
      body: `आपकी ${i.count ?? 'कुछ'} लिस्टिंग में स्टॉक कम हो रहा है। स्टॉक खत्म होने से बचने के लिए जल्द ही रीस्टॉक करें।`,
    }),
  },
  rfq_new_match: {
    en: () => ({ title: 'New RFQ matched to you', body: 'A buyer is requesting a bulk quote in your category. Respond before the window closes.' }),
    hi: () => ({ title: 'नया RFQ आपसे मेल खाता है', body: 'एक खरीदार आपकी श्रेणी में थोक कोट मांग रहा है। समय सीमा समाप्त होने से पहले जवाब दें।' }),
  },
  rfq_quote_received: {
    en: () => ({ title: 'New quote received', body: 'A seller has quoted on your RFQ. Compare quotes and accept the one that works for you.' }),
    hi: () => ({ title: 'नया कोट प्राप्त हुआ', body: 'एक विक्रेता ने आपके RFQ पर कोट दिया है। कोट की तुलना करें और जो उपयुक्त हो उसे स्वीकार करें।' }),
  },
  rfq_quote_accepted: {
    en: () => ({ title: 'Quote accepted', body: 'Your quote was accepted and converted into an order.' }),
    hi: () => ({ title: 'कोट स्वीकृत', body: 'आपका कोट स्वीकृत हो गया है और ऑर्डर में बदल दिया गया है।' }),
  },
  rfq_quote_rejected: {
    en: () => ({ title: 'Quote not selected', body: 'The buyer accepted a different quote for this RFQ.' }),
    hi: () => ({ title: 'कोट नहीं चुना गया', body: 'खरीदार ने इस RFQ के लिए दूसरा कोट स्वीकार किया है।' }),
  },
  rfq_quote_withdrawn: {
    en: () => ({ title: 'Quote withdrawn', body: 'A seller has withdrawn their quote on your RFQ.' }),
    hi: () => ({ title: 'कोट वापस लिया गया', body: 'एक विक्रेता ने आपके RFQ पर अपना कोट वापस ले लिया है।' }),
  },
  rfq_withdrawn_by_buyer: {
    en: () => ({ title: 'RFQ withdrawn', body: 'The buyer has withdrawn this RFQ. Your quote is no longer active.' }),
    hi: () => ({ title: 'RFQ वापस लिया गया', body: 'खरीदार ने यह RFQ वापस ले लिया है। आपका कोट अब सक्रिय नहीं है।' }),
  },
  rfq_expired: {
    en: () => ({ title: 'RFQ expired', body: 'This RFQ closed without an accepted quote.' }),
    hi: () => ({ title: 'RFQ समाप्त', body: 'यह RFQ बिना किसी स्वीकृत कोट के बंद हो गया।' }),
  },
  rfq_message_received: {
    en: () => ({ title: 'New RFQ message', body: 'You have a new message on an RFQ quote.' }),
    hi: () => ({ title: 'नया RFQ संदेश', body: 'आपके पास RFQ कोट पर एक नया संदेश है।' }),
  },

  // Phase 16 additions — see functions/src/notifications/templates for the
  // external-channel (push/sms/whatsapp/email) copy; this in-app copy is
  // deliberately similar wording.
  order_placed: {
    en: () => ({ title: 'Order placed', body: 'Your order has been placed successfully.' }),
    hi: () => ({ title: 'ऑर्डर दर्ज हुआ', body: 'आपका ऑर्डर सफलतापूर्वक दर्ज कर लिया गया है।' }),
  },
  payment_confirmed: {
    en: () => ({ title: 'Payment confirmed', body: 'Your payment was received and your order is confirmed.' }),
    hi: () => ({ title: 'भुगतान की पुष्टि', body: 'आपका भुगतान प्राप्त हो गया है और ऑर्डर की पुष्टि हो गई है।' }),
  },
  payment_failed: {
    en: () => ({ title: 'Payment failed', body: 'Your payment could not be completed. Please try again to place your order.' }),
    hi: () => ({ title: 'भुगतान विफल', body: 'आपका भुगतान पूरा नहीं हो सका। कृपया ऑर्डर देने के लिए फिर से प्रयास करें।' }),
  },
  refund_initiated: {
    en: () => ({ title: 'Refund initiated', body: 'Your refund has been initiated and will reflect in your account within a few business days.' }),
    hi: () => ({ title: 'रिफंड शुरू हुआ', body: 'आपका रिफंड शुरू कर दिया गया है और कुछ कार्यदिवसों में आपके खाते में दिखेगा।' }),
  },
  sla_breach_warning: {
    en: () => ({ title: 'Accept this order soon', body: 'An order is close to its accept-by deadline. Accept it now to avoid an auto-cancellation.' }),
    hi: () => ({ title: 'यह ऑर्डर जल्द स्वीकार करें', body: 'एक ऑर्डर की स्वीकृति समय सीमा नज़दीक है। स्वतः रद्द होने से बचने के लिए अभी स्वीकार करें।' }),
  },
  price_drop: {
    en: () => ({ title: 'Price drop', body: 'A part on your wishlist just got cheaper.' }),
    hi: () => ({ title: 'कीमत घटी', body: 'आपकी विशलिस्ट में शामिल एक पार्ट अब सस्ता हो गया है।' }),
  },
  back_in_stock: {
    en: () => ({ title: 'Back in stock', body: 'A part you wanted is back in stock. Order it before it runs out again.' }),
    hi: () => ({ title: 'स्टॉक में वापस आया', body: 'आपका चाहा गया पार्ट फिर से स्टॉक में है। खत्म होने से पहले ऑर्डर करें।' }),
  },
  abandoned_cart: {
    en: () => ({ title: 'You left something in your cart', body: 'Your cart is still waiting — complete your order before items go out of stock.' }),
    hi: () => ({ title: 'आपकी कार्ट में सामान बचा है', body: 'आपकी कार्ट अभी भी तैयार है — स्टॉक खत्म होने से पहले ऑर्डर पूरा करें।' }),
  },
  kyc_status_change: {
    en: () => ({ title: 'KYC status updated', body: 'Your seller KYC verification status has been updated.' }),
    hi: () => ({ title: 'KYC स्थिति अपडेट हुई', body: 'आपकी विक्रेता KYC सत्यापन स्थिति अपडेट हो गई है।' }),
  },
  new_order_for_seller: {
    en: () => ({ title: 'New order received', body: 'You have a new order to accept. Respond within your SLA window.' }),
    hi: () => ({ title: 'नया ऑर्डर मिला', body: 'आपको स्वीकार करने के लिए एक नया ऑर्डर मिला है। अपनी SLA समय सीमा में जवाब दें।' }),
  },

  // Phase 17 additions — trust systems (reviews, Q&A, anti-counterfeit).
  review_request: {
    en: (i) => ({ title: 'How was your part?', body: `Tell us what you thought of ${i.label ?? 'your recent purchase'} — it helps other buyers.` }),
    hi: (i) => ({ title: 'आपका पार्ट कैसा रहा?', body: `${i.label ?? 'अपनी हाल की खरीद'} के बारे में हमें बताएं — इससे अन्य खरीदारों को मदद मिलती है।` }),
  },
  review_seller_reply: {
    en: () => ({ title: 'Seller replied to your review', body: 'The seller has posted a reply to your review.' }),
    hi: () => ({ title: 'विक्रेता ने आपकी समीक्षा का जवाब दिया', body: 'विक्रेता ने आपकी समीक्षा पर जवाब पोस्ट किया है।' }),
  },
  qa_question_answered: {
    en: () => ({ title: 'Your question was answered', body: 'Someone answered the question you asked about a part.' }),
    hi: () => ({ title: 'आपके प्रश्न का उत्तर मिला', body: 'किसी ने आपके द्वारा पूछे गए प्रश्न का उत्तर दिया है।' }),
  },
  spurious_report_response_requested: {
    en: () => ({ title: 'Counterfeit report needs your response', body: 'A buyer reported a suspected counterfeit part from your listing. Please respond.' }),
    hi: () => ({ title: 'नकली पार्ट रिपोर्ट पर जवाब आवश्यक', body: 'एक खरीदार ने आपकी लिस्टिंग से संदिग्ध नकली पार्ट की रिपोर्ट की है। कृपया जवाब दें।' }),
  },
  spurious_report_resolved: {
    en: () => ({ title: 'Your report was reviewed', body: 'Your suspected-counterfeit-part report has been reviewed and resolved.' }),
    hi: () => ({ title: 'आपकी रिपोर्ट की समीक्षा हुई', body: 'आपकी संदिग्ध नकली पार्ट रिपोर्ट की समीक्षा कर उसे हल कर दिया गया है।' }),
  },
  brand_authorization_reviewed: {
    en: () => ({ title: 'Brand authorization reviewed', body: 'Your brand authorization document has been reviewed.' }),
    hi: () => ({ title: 'ब्रांड प्राधिकरण की समीक्षा हुई', body: 'आपके ब्रांड प्राधिकरण दस्तावेज़ की समीक्षा कर ली गई है।' }),
  },

  // Phase 18 additions — post-sale resolution (returns QC, warranty, disputes).
  return_picked_up_qc_pending: {
    en: () => ({ title: 'Reverse pickup booked', body: 'A return pickup has been booked. Inspect the item once received and record your QC decision.' }),
    hi: () => ({ title: 'रिवर्स पिकअप बुक हुआ', body: 'एक रिटर्न पिकअप बुक कर दिया गया है। सामान मिलने पर उसका निरीक्षण कर अपना QC निर्णय दर्ज करें।' }),
  },
  return_qc_disputed: {
    en: () => ({ title: 'Return inspection disputed', body: 'The seller disagrees with your return claim after inspection. You can escalate this for review.' }),
    hi: () => ({ title: 'रिटर्न निरीक्षण पर असहमति', body: 'निरीक्षण के बाद विक्रेता आपके रिटर्न दावे से असहमत है। आप इसे समीक्षा हेतु आगे भेज सकते हैं।' }),
  },
  return_replaced: {
    en: () => ({ title: 'Replacement on the way', body: 'Your return was approved for replacement — a new order has been created for you.' }),
    hi: () => ({ title: 'रिप्लेसमेंट भेजा जा रहा है', body: 'आपका रिटर्न रिप्लेसमेंट हेतु स्वीकृत हुआ — आपके लिए एक नया ऑर्डर बनाया गया है।' }),
  },
  warranty_claim_submitted: {
    en: () => ({ title: 'Warranty claim received', body: 'A buyer has submitted a warranty claim on one of your orders.' }),
    hi: () => ({ title: 'वारंटी दावा प्राप्त', body: 'एक खरीदार ने आपके ऑर्डर पर वारंटी दावा प्रस्तुत किया है।' }),
  },
  warranty_claim_decided: {
    en: (i) => ({ title: 'Warranty claim update', body: i.reason ? `Your warranty claim was ${i.reason}.` : 'Your warranty claim has been reviewed.' }),
    hi: (i) => ({ title: 'वारंटी दावा अपडेट', body: i.reason ? `आपका वारंटी दावा ${i.reason} हुआ।` : 'आपके वारंटी दावे की समीक्षा हो गई है।' }),
  },
  warranty_claim_escalated: {
    en: () => ({ title: 'Warranty claim escalated', body: 'A warranty claim has been escalated to the brand for review.' }),
    hi: () => ({ title: 'वारंटी दावा आगे भेजा गया', body: 'एक वारंटी दावा समीक्षा हेतु ब्रांड को भेज दिया गया है।' }),
  },
  dispute_opened: {
    en: () => ({ title: 'Dispute opened', body: 'A dispute has been opened and needs admin review.' }),
    hi: () => ({ title: 'विवाद खोला गया', body: 'एक विवाद खोला गया है जिसकी एडमिन समीक्षा आवश्यक है।' }),
  },
  dispute_evidence_added: {
    en: () => ({ title: 'New evidence on your dispute', body: 'New evidence has been added to an open dispute.' }),
    hi: () => ({ title: 'आपके विवाद पर नया साक्ष्य', body: 'एक खुले विवाद में नया साक्ष्य जोड़ा गया है।' }),
  },
  dispute_resolved: {
    en: () => ({ title: 'Dispute resolved', body: 'An admin has resolved your dispute. Check the details for the outcome.' }),
    hi: () => ({ title: 'विवाद हल हुआ', body: 'एडमिन ने आपका विवाद हल कर दिया है। परिणाम हेतु विवरण देखें।' }),
  },
  dispute_sla_breach_warning: {
    en: () => ({ title: 'Dispute nearing SLA deadline', body: 'An open dispute is close to its resolution deadline.' }),
    hi: () => ({ title: 'विवाद की SLA समय सीमा नज़दीक', body: 'एक खुले विवाद की समाधान समय सीमा नज़दीक है।' }),
  },

  // Phase 19 — Marketing module campaign broadcast. The only type whose
  // copy comes entirely from the caller (sendCampaign.ts), not a fixed
  // catalog string.
  admin_campaign: {
    en: (i) => ({ title: i.campaignTitle ?? '', body: i.campaignBody ?? '' }),
    hi: (i) => ({ title: i.campaignTitle ?? '', body: i.campaignBody ?? '' }),
  },
  // Phase 24: support ticketing (contact form).
  support_ticket_replied: {
    en: () => ({ title: 'New reply on your support ticket', body: 'Our support team has replied to your ticket.' }),
    hi: () => ({ title: 'आपके सहायता टिकट पर नया जवाब', body: 'हमारी सहायता टीम ने आपके टिकट का जवाब दिया है।' }),
  },
  support_ticket_resolved: {
    en: () => ({ title: 'Support ticket resolved', body: 'Your support ticket has been marked resolved. Reply if you need more help.' }),
    hi: () => ({ title: 'सहायता टिकट हल हो गया', body: 'आपका सहायता टिकट हल के रूप में चिह्नित किया गया है। अधिक सहायता चाहिए तो जवाब दें।' }),
  },
  support_ticket_sla_breach_warning: {
    en: () => ({ title: 'Support ticket nearing SLA breach', body: 'An open support ticket is close to breaching its response-time SLA.' }),
    hi: () => ({ title: 'सहायता टिकट SLA उल्लंघन के करीब', body: 'एक खुला सहायता टिकट अपनी प्रतिक्रिया-समय SLA के उल्लंघन के करीब है।' }),
  },
}

export interface QueueNotificationInput {
  userId: string
  type: NotificationType
  language: NotificationLanguage
  orderId?: string
  subOrderId?: string
  returnId?: string
  warrantyClaimId?: string
  disputeId?: string
  rfqId?: string
  listingId?: string
  reviewId?: string
  partId?: string
  copyInput?: CopyInput
  channels?: NotificationChannel[]
  data?: Record<string, string>
}

function buildNotificationDoc(input: QueueNotificationInput): Record<string, unknown> {
  const copy = COPY[input.type][input.language](input.copyInput ?? {})
  const doc: Record<string, unknown> = {
    userId: input.userId,
    type: input.type,
    title: copy.title,
    body: copy.body,
    data: input.data ?? {},
    channels: input.channels ?? ['push'],
    status: 'queued',
    createdAt: Date.now(),
  }
  if (input.orderId !== undefined) doc.orderId = input.orderId
  if (input.subOrderId !== undefined) doc.subOrderId = input.subOrderId
  if (input.returnId !== undefined) doc.returnId = input.returnId
  if (input.warrantyClaimId !== undefined) doc.warrantyClaimId = input.warrantyClaimId
  if (input.disputeId !== undefined) doc.disputeId = input.disputeId
  if (input.rfqId !== undefined) doc.rfqId = input.rfqId
  if (input.listingId !== undefined) doc.listingId = input.listingId
  if (input.reviewId !== undefined) doc.reviewId = input.reviewId
  if (input.partId !== undefined) doc.partId = input.partId
  return doc
}

/** Writes one `notificationsQueue` doc inside the caller's transaction — Phase 16 is what actually dispatches these over FCM/SMS/WhatsApp. */
export function queueNotification(tx: Transaction, db: Firestore, input: QueueNotificationInput): void {
  tx.set(db.collection('notificationsQueue').doc(), buildNotificationDoc(input))
}

/** Same as queueNotification but for callers with no transaction of their own (e.g. a Firestore trigger reacting to a client write it doesn't otherwise need to touch). */
export async function queueNotificationDirect(db: Firestore, input: QueueNotificationInput): Promise<void> {
  await db.collection('notificationsQueue').doc().set(buildNotificationDoc(input))
}
