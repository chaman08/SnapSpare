import { cmsPageSchema } from '@snapspare/shared'
import { db } from '../lib/firebaseAdmin.js'

/**
 * Phase 24 (launch readiness): the seven statutory/contractual pages plus a
 * starter set of Help Centre articles, all as `cmsPages` docs (type
 * `policy`/`faq`) — the same collection/renderer Phase 19's admin CMS panel
 * already edits. Written directly with the Admin SDK (bypasses
 * firestore.rules, same as every other seeder) rather than through
 * saveCmsPage.ts, since this is a one-time content load, not an admin
 * editing session.
 *
 * IMPORTANT: this is a working draft, not a substitute for legal review.
 * Every `[Company Legal Name]` / `[Registered Address]` placeholder below
 * must be replaced with the real operating entity's details (see
 * config/app.companyLegalName/companyRegisteredAddress, set alongside this
 * in seedConfig.ts) and the whole set reviewed by a lawyer qualified in
 * Indian consumer/IT/data-protection law before go-live — see README's
 * Phase 24 section. The Hindi (`hi`) text is a working translation, not a
 * certified one; get it checked by a professional legal translator before
 * relying on it in a dispute.
 */

const PLATFORM_NAME = 'SnapSpare'
const COMPANY_PLACEHOLDER = '[Company Legal Name — to be filled in before go-live]'
const ADDRESS_PLACEHOLDER = '[Registered Office Address — to be filled in before go-live]'
const SUPPORT_EMAIL = 'support@snapspare.in'
const GRIEVANCE_EMAIL = 'grievance@snapspare.in'
const SUPPORT_PHONE = '+91 1800-123-456'

interface LegalPageInput {
  slug: string
  type: 'policy' | 'faq'
  title: { en: string; hi: string }
  body: { en: string; hi: string }
  metaDescription: { en: string; hi: string }
}

const PAGES: LegalPageInput[] = [
  {
    slug: 'terms-of-use',
    type: 'policy',
    title: { en: 'Terms of Use', hi: 'उपयोग की शर्तें' },
    metaDescription: {
      en: `Terms of Use governing your access to and use of ${PLATFORM_NAME}.`,
      hi: `${PLATFORM_NAME} तक पहुंच और उपयोग को नियंत्रित करने वाली उपयोग की शर्तें।`,
    },
    body: {
      en: `Last updated: 11 August 2026

## 1. Who we are
${PLATFORM_NAME} is an online marketplace operated by ${COMPANY_PLACEHOLDER} (registered office: ${ADDRESS_PLACEHOLDER}) ("Company", "we", "us"), connecting buyers of automotive spare parts (retail vehicle owners, mechanics, garages, fleet operators and resellers) with independent third-party sellers. These Terms of Use, along with our Privacy Policy, Seller Agreement, Return & Refund Policy, Shipping Policy and Cancellation Policy (together, the "Terms"), govern your use of the ${PLATFORM_NAME} website and app (the "Platform").

## 2. Marketplace, not a seller
${PLATFORM_NAME} is an intermediary under Section 2(1)(w) of the Information Technology Act, 2000 and an "e-commerce marketplace entity" under the Consumer Protection (E-Commerce) Rules, 2020. We do not manufacture, own, or sell any part listed on the Platform. Every listing is created and controlled by an independent seller, who is solely responsible for the accuracy of the listing, the genuineness, quality, and fitment of the part, and compliance with applicable law (including GST, the Legal Metrology Act, and motor vehicle spare-parts regulations).

## 3. Account and eligibility
You must be at least 18 years old and capable of entering a binding contract under the Indian Contract Act, 1872 to create an account. You are responsible for keeping your login credentials (including OTP-based phone authentication) confidential and for all activity under your account. Notify us immediately at ${SUPPORT_EMAIL} of any unauthorised use.

## 4. Orders, pricing, and quantity-slab pricing
Prices shown are set by individual sellers and may include quantity-slab (bulk) pricing — the price per unit may fall as order quantity increases, exactly as displayed at checkout. All prices are in Indian Rupees (INR) and inclusive of applicable GST unless stated otherwise. The complete price breakdown (goods value, tax, shipping, discounts, and total payable) is always shown before you confirm an order — see the checkout summary. A contract of sale is formed between you and the seller when the seller accepts your order, not when you place it.

## 5. Fitment information
Fitment ("FITS" / "DOES NOT FIT" / "UNVERIFIED") shown on a listing is based on data supplied by sellers and our fitment database and is provided as a convenience, not a guarantee. Always verify part compatibility against your vehicle's registration/chassis details before fitting, particularly for safety-critical parts.

## 6. Prohibited conduct
You agree not to: (a) list, sell, or attempt to purchase counterfeit, stolen, or spurious parts; (b) circumvent Platform payment or communication systems; (c) post false reviews or fitment reports; (d) use the Platform for any unlawful purpose; or (e) attempt to reverse-engineer, scrape, or interfere with the Platform's operation.

## 7. Intellectual property
The ${PLATFORM_NAME} name, logo, and Platform design are owned by the Company. Seller-uploaded content (images, descriptions) remains the seller's responsibility; by uploading, a seller grants us a licence to display it on the Platform.

## 8. Limitation of liability
To the extent permitted by law, the Company's liability for any claim arising from your use of the Platform is limited to the value of the relevant order. We are not liable for indirect or consequential loss. Nothing in these Terms limits liability that cannot be excluded under the Consumer Protection Act, 2019.

## 9. Grievance redressal
See our separate Grievance Redressal page for our Grievance Officer's contact details and statutory response timelines.

## 10. Governing law and jurisdiction
These Terms are governed by the laws of India. Courts at the Company's registered office location shall have exclusive jurisdiction, without prejudice to any right you have to approach a consumer forum under the Consumer Protection Act, 2019 (including e-filing via the National Consumer Helpline / e-Daakhil) closer to your residence.

## 11. Changes to these Terms
We may update these Terms from time to time; the "Last updated" date above will change accordingly. Continued use of the Platform after a change constitutes acceptance.`,
      hi: `अंतिम अद्यतन: 11 अगस्त 2026

## 1. हम कौन हैं
${PLATFORM_NAME}, ${COMPANY_PLACEHOLDER} (पंजीकृत कार्यालय: ${ADDRESS_PLACEHOLDER}) ("कंपनी", "हम") द्वारा संचालित एक ऑनलाइन मार्केटप्लेस है, जो ऑटोमोटिव स्पेयर पार्ट्स के खरीदारों (वाहन मालिक, मैकेनिक, गैराज, फ्लीट ऑपरेटर और रीसेलर) को स्वतंत्र तृतीय-पक्ष विक्रेताओं से जोड़ता है। उपयोग की ये शर्तें, हमारी गोपनीयता नीति, विक्रेता समझौता, रिटर्न व रिफंड नीति, शिपिंग नीति और रद्दीकरण नीति (सामूहिक रूप से "शर्तें") के साथ, ${PLATFORM_NAME} वेबसाइट और ऐप ("प्लेटफ़ॉर्म") के आपके उपयोग को नियंत्रित करती हैं।

## 2. मार्केटप्लेस, विक्रेता नहीं
${PLATFORM_NAME}, सूचना प्रौद्योगिकी अधिनियम, 2000 की धारा 2(1)(w) के तहत एक मध्यस्थ और उपभोक्ता संरक्षण (ई-कॉमर्स) नियम, 2020 के तहत एक "ई-कॉमर्स मार्केटप्लेस इकाई" है। हम प्लेटफ़ॉर्म पर सूचीबद्ध किसी भी पार्ट का निर्माण, स्वामित्व या बिक्री नहीं करते। प्रत्येक लिस्टिंग एक स्वतंत्र विक्रेता द्वारा बनाई और नियंत्रित की जाती है, जो लिस्टिंग की सटीकता, पार्ट की वास्तविकता, गुणवत्ता और फिटमेंट, तथा लागू कानून (GST, माप-तौल कानून और मोटर वाहन स्पेयर-पार्ट्स नियमों सहित) के अनुपालन के लिए पूर्णतः उत्तरदायी है।

## 3. खाता और पात्रता
खाता बनाने के लिए आपकी आयु कम से कम 18 वर्ष होनी चाहिए और भारतीय अनुबंध अधिनियम, 1872 के तहत बाध्यकारी अनुबंध करने में सक्षम होना चाहिए। अपने लॉगिन विवरण (OTP-आधारित फोन प्रमाणीकरण सहित) को गोपनीय रखना और अपने खाते के तहत सभी गतिविधि के लिए आप उत्तरदायी हैं। किसी भी अनधिकृत उपयोग की सूचना तुरंत ${SUPPORT_EMAIL} पर दें।

## 4. ऑर्डर, मूल्य निर्धारण, और मात्रा-स्लैब मूल्य निर्धारण
प्रदर्शित मूल्य व्यक्तिगत विक्रेताओं द्वारा निर्धारित किए जाते हैं और इसमें मात्रा-स्लैब (थोक) मूल्य निर्धारण शामिल हो सकता है — ऑर्डर की मात्रा बढ़ने पर प्रति इकाई मूल्य घट सकता है, ठीक वैसे ही जैसे चेकआउट पर दिखाया गया है। सभी मूल्य भारतीय रुपये (INR) में हैं और जब तक अन्यथा न कहा जाए, लागू GST सहित हैं। पूर्ण मूल्य विवरण (माल का मूल्य, कर, शिपिंग, छूट और कुल देय राशि) हमेशा ऑर्डर की पुष्टि से पहले दिखाया जाता है — चेकआउट सारांश देखें। बिक्री का अनुबंध आपके और विक्रेता के बीच तब बनता है जब विक्रेता आपका ऑर्डर स्वीकार करता है, न कि जब आप इसे देते हैं।

## 5. फिटमेंट जानकारी
किसी लिस्टिंग पर दिखाई गई फिटमेंट ("FITS" / "DOES NOT FIT" / "UNVERIFIED") विक्रेताओं और हमारे फिटमेंट डेटाबेस द्वारा प्रदत्त डेटा पर आधारित है और यह एक सुविधा के रूप में दी जाती है, गारंटी के रूप में नहीं। फिट करने से पहले हमेशा अपने वाहन के पंजीकरण/चेसिस विवरण के विरुद्ध पार्ट की अनुकूलता सत्यापित करें, विशेष रूप से सुरक्षा-महत्वपूर्ण पुर्जों के लिए।

## 6. निषिद्ध आचरण
आप सहमत हैं कि आप: (क) नकली, चोरी या संदिग्ध पुर्जे सूचीबद्ध, बेचेंगे या खरीदने का प्रयास नहीं करेंगे; (ख) प्लेटफ़ॉर्म भुगतान या संचार प्रणालियों को दरकिनार नहीं करेंगे; (ग) झूठी समीक्षाएं या फिटमेंट रिपोर्ट पोस्ट नहीं करेंगे; (घ) प्लेटफ़ॉर्म का किसी गैरकानूनी उद्देश्य के लिए उपयोग नहीं करेंगे; या (ङ) प्लेटफ़ॉर्म को रिवर्स-इंजीनियर, स्क्रैप या उसके संचालन में हस्तक्षेप करने का प्रयास नहीं करेंगे।

## 7. बौद्धिक संपदा
${PLATFORM_NAME} नाम, लोगो और प्लेटफ़ॉर्म डिज़ाइन कंपनी के स्वामित्व में हैं। विक्रेता द्वारा अपलोड की गई सामग्री (चित्र, विवरण) विक्रेता की जिम्मेदारी बनी रहती है; अपलोड करके, विक्रेता हमें इसे प्लेटफ़ॉर्म पर प्रदर्शित करने का लाइसेंस देता है।

## 8. दायित्व की सीमा
कानून द्वारा अनुमत सीमा तक, प्लेटफ़ॉर्म के उपयोग से उत्पन्न किसी भी दावे के लिए कंपनी का दायित्व संबंधित ऑर्डर के मूल्य तक सीमित है। हम अप्रत्यक्ष या परिणामी हानि के लिए उत्तरदायी नहीं हैं। इन शर्तों में कुछ भी उपभोक्ता संरक्षण अधिनियम, 2019 के तहत बाहर नहीं किए जा सकने वाले दायित्व को सीमित नहीं करता।

## 9. शिकायत निवारण
हमारे शिकायत निवारण अधिकारी के संपर्क विवरण और वैधानिक प्रतिक्रिया समय-सीमा के लिए हमारा अलग शिकायत निवारण पृष्ठ देखें।

## 10. शासी कानून और क्षेत्राधिकार
ये शर्तें भारत के कानूनों द्वारा शासित हैं। कंपनी के पंजीकृत कार्यालय स्थान की अदालतों का विशेष क्षेत्राधिकार होगा, बिना किसी पूर्वाग्रह के कि आपको उपभोक्ता संरक्षण अधिनियम, 2019 के तहत अपने निवास के निकट उपभोक्ता फोरम (राष्ट्रीय उपभोक्ता हेल्पलाइन / ई-दाखिल सहित) से संपर्क करने का अधिकार है।

## 11. इन शर्तों में परिवर्तन
हम समय-समय पर इन शर्तों को अपडेट कर सकते हैं; ऊपर दी गई "अंतिम अद्यतन" तिथि तदनुसार बदल जाएगी। परिवर्तन के बाद प्लेटफ़ॉर्म का निरंतर उपयोग स्वीकृति माना जाएगा।`,
    },
  },
  {
    slug: 'seller-agreement',
    type: 'policy',
    title: { en: 'Seller Agreement', hi: 'विक्रेता समझौता' },
    metaDescription: {
      en: `The agreement between ${PLATFORM_NAME} and sellers listing parts on the marketplace.`,
      hi: `${PLATFORM_NAME} और मार्केटप्लेस पर पुर्जे सूचीबद्ध करने वाले विक्रेताओं के बीच समझौता।`,
    },
    body: {
      en: `Last updated: 11 August 2026 · Version: 2026-01-seller-tos-v1

This Seller Agreement is entered into between ${COMPANY_PLACEHOLDER} ("${PLATFORM_NAME}", "we") and the entity or individual completing seller onboarding ("Seller", "you") the moment you accept it during onboarding.

## 1. Appointment
${PLATFORM_NAME} grants you a non-exclusive, revocable right to list and sell automotive spare parts through the Platform, subject to this Agreement and our listing/quality policies. You act as an independent seller, not as our agent or employee.

## 2. Onboarding and verification
You must provide accurate business details (legal name, business type, GSTIN, PAN), a valid bank account for settlements, and supporting KYC documents (GST certificate, PAN, address proof, shop photo) as prompted during onboarding. We may verify, request additional documents, or reject/suspend an application at our discretion, including where a GSTIN cannot be validated.

## 3. Listings, pricing, and quantity-slab tiers
You are solely responsible for listing accuracy: part number, condition, HSN code, GST rate, country of origin, images, and — critically — the quantity-slab pricing ladder (minimum order quantity and per-tier unit prices). Prices must strictly decrease as quantity tiers increase; you may not misrepresent MRP or list counterfeit/spurious parts. Listings found to misrepresent fitment, authenticity, or pricing may be removed, and repeated violations may lead to warnings, category bans, payout holds, or delisting under our anti-counterfeit penalty ladder.

## 4. Order fulfilment and SLA
You must accept or reject an order within the SLA window shown in your seller dashboard (default 24 hours), pack within the packing SLA, and hand over to the designated logistics partner on schedule. Failure to accept within SLA auto-cancels the order and may affect your seller trust score.

## 5. Commission, taxes, and payouts
${PLATFORM_NAME} charges a platform commission (shown in your dashboard, may vary by category) on the value of goods sold, deducted before settlement. As an e-commerce operator, we deduct Tax Collected at Source (TCS) under Section 52 of the CGST Act and Tax Deducted at Source (TDS) under Section 194-O of the Income Tax Act at the rates prescribed by law, and issue GST-compliant tax invoices / bills of supply on your behalf where applicable. You remain solely responsible for your own GST returns, income tax filings, and reconciling TCS/TDS credits.

## 6. Returns, warranty, and disputes
You must honour the return window and warranty terms disclosed on your listings and cooperate with our returns/warranty-claim/dispute-resolution process, including providing evidence and responding within stated windows. Admin-forced resolutions (e.g. a dispute refund debited to your ledger) are binding under this Agreement.

## 7. Prohibited items and conduct
You may not list stolen, counterfeit, banned, or safety-recalled parts; misuse buyer contact information obtained through the Platform; or attempt to complete transactions outside the Platform to avoid commission.

## 8. Suspension and termination
We may suspend or terminate your seller account for a material breach of this Agreement, repeated policy violations, fraud, or a spurious-parts penalty-ladder escalation reaching delisting. You may close your seller account at any time by contacting ${SUPPORT_EMAIL}, subject to settling any open orders and outstanding ledger balance.

## 9. Governing law
This Agreement is governed by Indian law, with the same jurisdiction and grievance-redressal provisions as our Terms of Use.`,
      hi: `अंतिम अद्यतन: 11 अगस्त 2026 · संस्करण: 2026-01-seller-tos-v1

यह विक्रेता समझौता ${COMPANY_PLACEHOLDER} ("${PLATFORM_NAME}", "हम") और सेलर ऑनबोर्डिंग पूरा करने वाली संस्था या व्यक्ति ("विक्रेता", "आप") के बीच, ऑनबोर्डिंग के दौरान स्वीकृति देते ही, संपन्न होता है।

## 1. नियुक्ति
${PLATFORM_NAME} आपको इस समझौते और हमारी लिस्टिंग/गुणवत्ता नीतियों के अधीन, प्लेटफ़ॉर्म के माध्यम से ऑटोमोटिव स्पेयर पार्ट्स सूचीबद्ध करने और बेचने का एक गैर-अनन्य, प्रतिसंहरणीय अधिकार देता है। आप एक स्वतंत्र विक्रेता के रूप में कार्य करते हैं, हमारे एजेंट या कर्मचारी के रूप में नहीं।

## 2. ऑनबोर्डिंग और सत्यापन
आपको सटीक व्यावसायिक विवरण (कानूनी नाम, व्यवसाय प्रकार, GSTIN, PAN), निपटान के लिए एक वैध बैंक खाता, और ऑनबोर्डिंग के दौरान मांगे गए सहायक KYC दस्तावेज़ (GST प्रमाणपत्र, PAN, पता प्रमाण, दुकान फोटो) प्रदान करने होंगे। हम अपने विवेक पर सत्यापन कर सकते हैं, अतिरिक्त दस्तावेज़ मांग सकते हैं, या आवेदन अस्वीकार/निलंबित कर सकते हैं, जिसमें GSTIN मान्य न हो सकने की स्थिति भी शामिल है।

## 3. लिस्टिंग, मूल्य निर्धारण, और मात्रा-स्लैब स्तर
लिस्टिंग की सटीकता के लिए आप पूर्णतः उत्तरदायी हैं: पार्ट नंबर, स्थिति, HSN कोड, GST दर, मूल देश, चित्र, और — महत्वपूर्ण रूप से — मात्रा-स्लैब मूल्य निर्धारण सीढ़ी (न्यूनतम ऑर्डर मात्रा और प्रति-स्तर इकाई मूल्य)। मात्रा स्तर बढ़ने के साथ मूल्य सख्ती से घटना चाहिए; आप MRP को गलत तरीके से प्रस्तुत नहीं कर सकते या नकली/संदिग्ध पुर्जे सूचीबद्ध नहीं कर सकते। फिटमेंट, वास्तविकता या मूल्य निर्धारण को गलत तरीके से प्रस्तुत करने वाली लिस्टिंग हटाई जा सकती है, और बार-बार उल्लंघन पर हमारी नकली-रोधी दंड सीढ़ी के तहत चेतावनी, श्रेणी प्रतिबंध, भुगतान रोक, या डीलिस्टिंग हो सकती है।

## 4. ऑर्डर पूर्ति और SLA
आपको अपने सेलर डैशबोर्ड में दिखाई गई SLA विंडो (डिफ़ॉल्ट 24 घंटे) के भीतर ऑर्डर स्वीकार या अस्वीकार करना होगा, पैकिंग SLA के भीतर पैक करना होगा, और निर्धारित समय पर नामित लॉजिस्टिक्स पार्टनर को सौंपना होगा। SLA के भीतर स्वीकार न करने पर ऑर्डर स्वतः रद्द हो जाता है और आपके विक्रेता ट्रस्ट स्कोर को प्रभावित कर सकता है।

## 5. कमीशन, कर, और भुगतान
${PLATFORM_NAME} बेचे गए माल के मूल्य पर एक प्लेटफ़ॉर्म कमीशन (आपके डैशबोर्ड में दिखाया गया, श्रेणी के अनुसार भिन्न हो सकता है) लेता है, जो निपटान से पहले काटा जाता है। एक ई-कॉमर्स ऑपरेटर के रूप में, हम कानून द्वारा निर्धारित दरों पर CGST अधिनियम की धारा 52 के तहत स्रोत पर एकत्रित कर (TCS) और आयकर अधिनियम की धारा 194-O के तहत स्रोत पर कर कटौती (TDS) काटते हैं, और जहां लागू हो, आपकी ओर से GST-अनुरूप कर चालान/आपूर्ति बिल जारी करते हैं। आप अपने स्वयं के GST रिटर्न, आयकर फाइलिंग, और TCS/TDS क्रेडिट के मिलान के लिए पूर्णतः उत्तरदायी बने रहते हैं।

## 6. रिटर्न, वारंटी, और विवाद
आपको अपनी लिस्टिंग पर बताई गई रिटर्न विंडो और वारंटी शर्तों का पालन करना होगा और हमारी रिटर्न/वारंटी-दावा/विवाद-समाधान प्रक्रिया में सहयोग करना होगा, जिसमें साक्ष्य प्रदान करना और बताई गई समय-सीमा के भीतर प्रतिक्रिया देना शामिल है। एडमिन द्वारा लागू किए गए समाधान (जैसे, आपके लेजर पर डेबिट किया गया विवाद रिफंड) इस समझौते के तहत बाध्यकारी हैं।

## 7. निषिद्ध वस्तुएं और आचरण
आप चोरी, नकली, प्रतिबंधित, या सुरक्षा-रिकॉल किए गए पुर्जे सूचीबद्ध नहीं कर सकते; प्लेटफ़ॉर्म के माध्यम से प्राप्त खरीदार संपर्क जानकारी का दुरुपयोग नहीं कर सकते; या कमीशन से बचने के लिए प्लेटफ़ॉर्म के बाहर लेनदेन पूरा करने का प्रयास नहीं कर सकते।

## 8. निलंबन और समाप्ति
हम इस समझौते के भौतिक उल्लंघन, बार-बार नीति उल्लंघन, धोखाधड़ी, या डीलिस्टिंग तक पहुंचने वाली संदिग्ध-पुर्जे दंड-सीढ़ी वृद्धि के लिए आपका विक्रेता खाता निलंबित या समाप्त कर सकते हैं। आप किसी भी समय ${SUPPORT_EMAIL} से संपर्क करके अपना विक्रेता खाता बंद कर सकते हैं, बशर्ते कोई भी खुला ऑर्डर और बकाया लेजर शेष निपटाया जाए।

## 9. शासी कानून
यह समझौता भारतीय कानून द्वारा शासित है, हमारी उपयोग की शर्तों के समान क्षेत्राधिकार और शिकायत-निवारण प्रावधानों के साथ।`,
    },
  },
  {
    slug: 'privacy-policy',
    type: 'policy',
    title: { en: 'Privacy Policy', hi: 'गोपनीयता नीति' },
    metaDescription: {
      en: `How ${PLATFORM_NAME} collects, uses, and protects your personal data, aligned with the Digital Personal Data Protection Act, 2023.`,
      hi: `${PLATFORM_NAME} आपके व्यक्तिगत डेटा को कैसे एकत्र, उपयोग और सुरक्षित करता है, डिजिटल व्यक्तिगत डेटा संरक्षण अधिनियम, 2023 के अनुरूप।`,
    },
    body: {
      en: `Last updated: 11 August 2026

This Privacy Policy explains how ${COMPANY_PLACEHOLDER} ("${PLATFORM_NAME}", "we", the "Data Fiduciary" under the Digital Personal Data Protection Act, 2023 ("DPDP Act")) collects, uses, discloses, and protects your personal data when you use the Platform.

## 1. What we collect
- **Identity and contact data**: name, phone number (used for OTP login), email, delivery/billing addresses.
- **Vehicle data**: make, model, variant, year (to power fitment matching — the FITS/DOES NOT FIT indicator).
- **Transaction data**: orders, payments (processed by Razorpay — we do not store your card/UPI credentials), returns, reviews, RFQs and quotes, credit account (Khata) usage.
- **Business data (sellers)**: GSTIN, PAN, bank account details, KYC documents — collected to meet GST/KYC obligations as an e-commerce operator.
- **Device and usage data**: device identifiers, app/browser interactions, and location (only where you grant permission, e.g. to auto-fill a pincode).

## 2. Purpose and lawful basis (consent)
We process your personal data only for the purposes you consented to at collection: account creation and authentication, order processing and fulfilment, fitment matching, payment and tax compliance, customer support, fraud/abuse prevention, and — where you separately opt in — marketing communications (price-drop alerts, WhatsApp/SMS updates). You may withdraw consent for non-essential (marketing) processing at any time from Account → Notification Preferences, without it affecting transactional communications necessary to fulfil an order already placed.

## 3. Purpose limitation and data minimisation
We collect only the personal data necessary for the stated purpose and do not use it for a materially different purpose without fresh consent, per Section 6 of the DPDP Act.

## 4. Sharing with third parties
We share personal data only as necessary to provide the service: the relevant seller (your delivery address and order details, so they can fulfil your order), Shiprocket and its courier network (for delivery), Razorpay (for payment processing), MSG91/WhatsApp Cloud API (for order/OTP notifications), and government authorities where legally required (e.g. GST/tax filings, a lawful law-enforcement request). We do not sell your personal data.

## 5. Data retention
We retain personal data for as long as your account is active, plus the period required by applicable law for tax, accounting, and dispute-resolution records (generally up to 8 years for GST-related invoices under the CGST Act). Data no longer needed for these purposes is deleted or anonymised.

## 6. Your rights as a Data Principal
Under the DPDP Act, you have the right to: (a) obtain a summary of the personal data we hold about you and the processing activities; (b) request correction, completion, or updating of your personal data; (c) request erasure of your personal data (subject to our legal retention obligations, e.g. invoicing records); (d) nominate another individual to exercise your rights in the event of death or incapacity; and (e) withdraw consent at any time. To exercise any of these rights, write to our Grievance Officer (see the Grievance Redressal page) or email ${GRIEVANCE_EMAIL}. We will respond within the statutory timelines stated there.

## 7. Data security
We use industry-standard safeguards (encryption in transit, access controls, Firebase App Check, role-scoped server-side authorization) to protect your data. Sensitive documents (KYC, bank details) are stored in access-restricted Storage buckets, readable only via authenticated, audit-logged Cloud Functions.

## 8. Children's data
The Platform is not directed at, and we do not knowingly collect personal data from, individuals under 18.

## 9. Cross-border transfer
Our infrastructure (Firebase/Google Cloud, region asia-south1) primarily processes data within India; where a sub-processor operates outside India, we ensure it is not a country restricted by the Central Government under Section 16 of the DPDP Act.

## 10. Grievance redressal and Data Protection Board
If you are dissatisfied with our response to a grievance, you may approach the Data Protection Board of India once constituted under the DPDP Act, without prejudice to any other remedy available to you.

## 11. Changes to this Policy
We will notify you of material changes to this Policy via the Platform or your registered contact details before they take effect.`,
      hi: `अंतिम अद्यतन: 11 अगस्त 2026

यह गोपनीयता नीति बताती है कि ${COMPANY_PLACEHOLDER} ("${PLATFORM_NAME}", डिजिटल व्यक्तिगत डेटा संरक्षण अधिनियम, 2023 ("DPDP अधिनियम") के तहत "डेटा फिड्यूशियरी") प्लेटफ़ॉर्म का उपयोग करते समय आपके व्यक्तिगत डेटा को कैसे एकत्र, उपयोग, प्रकट और सुरक्षित करता है।

## 1. हम क्या एकत्र करते हैं
- **पहचान और संपर्क डेटा**: नाम, फ़ोन नंबर (OTP लॉगिन के लिए), ईमेल, डिलीवरी/बिलिंग पते।
- **वाहन डेटा**: मेक, मॉडल, वेरिएंट, वर्ष (फिटमेंट मिलान — FITS/DOES NOT FIT संकेतक — को शक्ति देने के लिए)।
- **लेन-देन डेटा**: ऑर्डर, भुगतान (Razorpay द्वारा संसाधित — हम आपके कार्ड/UPI क्रेडेंशियल संग्रहीत नहीं करते), रिटर्न, समीक्षाएं, RFQ और कोटेशन, क्रेडिट खाता (खाता) उपयोग।
- **व्यावसायिक डेटा (विक्रेता)**: GSTIN, PAN, बैंक खाता विवरण, KYC दस्तावेज़ — एक ई-कॉमर्स ऑपरेटर के रूप में GST/KYC दायित्वों को पूरा करने के लिए एकत्र किए गए।
- **डिवाइस और उपयोग डेटा**: डिवाइस पहचानकर्ता, ऐप/ब्राउज़र इंटरैक्शन, और स्थान (केवल जहां आप अनुमति देते हैं, जैसे पिनकोड ऑटो-फिल के लिए)।

## 2. उद्देश्य और वैध आधार (सहमति)
हम आपके व्यक्तिगत डेटा को केवल संग्रह के समय आपके द्वारा सहमत उद्देश्यों के लिए संसाधित करते हैं: खाता निर्माण और प्रमाणीकरण, ऑर्डर प्रोसेसिंग और पूर्ति, फिटमेंट मिलान, भुगतान और कर अनुपालन, ग्राहक सहायता, धोखाधड़ी/दुरुपयोग रोकथाम, और — जहां आप अलग से सहमति देते हैं — मार्केटिंग संचार (मूल्य-गिरावट अलर्ट, WhatsApp/SMS अपडेट)। आप किसी भी समय खाता → अधिसूचना प्राथमिकताएं से गैर-आवश्यक (मार्केटिंग) प्रसंस्करण के लिए सहमति वापस ले सकते हैं, बिना इसके पहले से दिए गए ऑर्डर को पूरा करने के लिए आवश्यक लेन-देन संचार को प्रभावित किए।

## 3. उद्देश्य सीमा और डेटा न्यूनीकरण
हम केवल बताए गए उद्देश्य के लिए आवश्यक व्यक्तिगत डेटा एकत्र करते हैं और DPDP अधिनियम की धारा 6 के अनुसार नई सहमति के बिना इसे किसी भौतिक रूप से भिन्न उद्देश्य के लिए उपयोग नहीं करते।

## 4. तृतीय पक्षों के साथ साझाकरण
हम व्यक्तिगत डेटा केवल सेवा प्रदान करने के लिए आवश्यक सीमा तक साझा करते हैं: संबंधित विक्रेता (आपका डिलीवरी पता और ऑर्डर विवरण, ताकि वे आपका ऑर्डर पूरा कर सकें), Shiprocket और उसका कूरियर नेटवर्क (डिलीवरी के लिए), Razorpay (भुगतान प्रसंस्करण के लिए), MSG91/WhatsApp Cloud API (ऑर्डर/OTP सूचनाओं के लिए), और कानूनी रूप से आवश्यक होने पर सरकारी प्राधिकरण (जैसे GST/कर फाइलिंग, वैध कानून-प्रवर्तन अनुरोध)। हम आपका व्यक्तिगत डेटा नहीं बेचते।

## 5. डेटा प्रतिधारण
जब तक आपका खाता सक्रिय है, हम व्यक्तिगत डेटा बनाए रखते हैं, साथ ही कर, लेखांकन, और विवाद-समाधान रिकॉर्ड के लिए लागू कानून द्वारा आवश्यक अवधि (आमतौर पर CGST अधिनियम के तहत GST-संबंधित चालानों के लिए 8 वर्ष तक)। इन उद्देश्यों के लिए अब आवश्यक न होने वाला डेटा हटा दिया जाता है या गुमनाम बना दिया जाता है।

## 6. डेटा प्रिंसिपल के रूप में आपके अधिकार
DPDP अधिनियम के तहत, आपको अधिकार है: (क) हमारे पास मौजूद आपके व्यक्तिगत डेटा और प्रसंस्करण गतिविधियों का सारांश प्राप्त करना; (ख) अपने व्यक्तिगत डेटा में सुधार, पूर्णता, या अद्यतन का अनुरोध करना; (ग) अपने व्यक्तिगत डेटा को मिटाने का अनुरोध करना (हमारे कानूनी प्रतिधारण दायित्वों के अधीन, जैसे चालान रिकॉर्ड); (घ) मृत्यु या अक्षमता की स्थिति में अपने अधिकारों का प्रयोग करने के लिए किसी अन्य व्यक्ति को नामित करना; और (ङ) किसी भी समय सहमति वापस लेना। इनमें से किसी भी अधिकार का प्रयोग करने के लिए, हमारे शिकायत निवारण अधिकारी को लिखें (शिकायत निवारण पृष्ठ देखें) या ${GRIEVANCE_EMAIL} पर ईमेल करें। हम वहां बताई गई वैधानिक समय-सीमा के भीतर जवाब देंगे।

## 7. डेटा सुरक्षा
हम आपके डेटा की सुरक्षा के लिए उद्योग-मानक सुरक्षा उपायों (पारगमन में एन्क्रिप्शन, पहुंच नियंत्रण, Firebase App Check, भूमिका-सीमित सर्वर-साइड प्राधिकरण) का उपयोग करते हैं। संवेदनशील दस्तावेज़ (KYC, बैंक विवरण) पहुंच-प्रतिबंधित स्टोरेज बकेट में संग्रहीत हैं, जो केवल प्रमाणित, ऑडिट-लॉग किए गए क्लाउड फ़ंक्शंस के माध्यम से पढ़ने योग्य हैं।

## 8. बच्चों का डेटा
प्लेटफ़ॉर्म 18 वर्ष से कम आयु के व्यक्तियों के लिए निर्देशित नहीं है, और हम जानबूझकर उनसे व्यक्तिगत डेटा एकत्र नहीं करते।

## 9. सीमा-पार स्थानांतरण
हमारा बुनियादी ढांचा (Firebase/Google Cloud, क्षेत्र asia-south1) मुख्य रूप से भारत के भीतर डेटा संसाधित करता है; जहां कोई उप-प्रोसेसर भारत के बाहर संचालित होता है, हम सुनिश्चित करते हैं कि यह DPDP अधिनियम की धारा 16 के तहत केंद्र सरकार द्वारा प्रतिबंधित देश न हो।

## 10. शिकायत निवारण और डेटा संरक्षण बोर्ड
यदि आप किसी शिकायत पर हमारी प्रतिक्रिया से असंतुष्ट हैं, तो आप DPDP अधिनियम के तहत गठित होने के बाद भारत के डेटा संरक्षण बोर्ड से संपर्क कर सकते हैं, बिना आपके लिए उपलब्ध किसी अन्य उपाय पर पूर्वाग्रह के।

## 11. इस नीति में परिवर्तन
हम इस नीति में किसी भी भौतिक परिवर्तन के प्रभावी होने से पहले प्लेटफ़ॉर्म या आपके पंजीकृत संपर्क विवरण के माध्यम से आपको सूचित करेंगे।`,
    },
  },
  {
    slug: 'return-refund-policy',
    type: 'policy',
    title: { en: 'Return & Refund Policy', hi: 'रिटर्न और रिफंड नीति' },
    metaDescription: {
      en: `When and how you can return a part and get a refund on ${PLATFORM_NAME}.`,
      hi: `${PLATFORM_NAME} पर पुर्जा कब और कैसे लौटाया जा सकता है और रिफंड कैसे प्राप्त करें।`,
    },
    body: {
      en: `Last updated: 11 August 2026

## 1. Return window
Each listing discloses its own return window (in days from delivery), set by the seller, shown on the product page — most parts carry a 7-day window unless the seller states otherwise. Certain categories (e.g. electronic sensors, ECUs, and other items listed as non-returnable on the listing) are not eligible for return once installed, for hygiene/safety/anti-fraud reasons.

## 2. Eligible reasons
You may request a return for: a part that is damaged, defective, or materially not as described; the wrong part shipped; or (only where the seller/category allows it, and subject to a return-shipping fee) simply changing your mind, provided the part is unused and in original packaging.

## 3. How to request a return
Go to Orders → select the order → Request Return, choose a reason, and upload photos where prompted. We will schedule a reverse pickup (for most categories) or ask you to self-ship, per the flow shown.

## 4. Quality check and outcome
Once we receive the returned part, the seller (or our QC process) inspects it, generally within 5 business days. If approved, a refund or replacement is issued as you selected. If disputed (e.g. the seller says the part shows signs of use not disclosed at return), you may escalate to an admin-mediated dispute with photo evidence from both sides — see the Grievance Redressal page for the SLA on this review.

## 5. Refund method and timeline
Refunds are issued to the original payment method (or, for Cash on Delivery orders, to your linked bank account / as platform credit where you choose) once a return is approved. Razorpay-processed refunds typically reflect in 5–7 business days depending on your bank; Khata (credit account) repayments are credited to your credit balance immediately.

## 6. Buyer-fault deductions
Where a return is due to a change of mind (not a defect), a return-shipping fee (disclosed at the time you request the return) may be deducted from your refund.

## 7. Fair use
Frequent returns or a pattern of refusing Cash on Delivery orders may lead to Cash on Delivery being disabled on your account or future return requests requiring manual review, to keep the marketplace fair for sellers and other buyers.`,
      hi: `अंतिम अद्यतन: 11 अगस्त 2026

## 1. रिटर्न विंडो
प्रत्येक लिस्टिंग अपनी स्वयं की रिटर्न विंडो (डिलीवरी से दिनों में) प्रकट करती है, जो विक्रेता द्वारा निर्धारित होती है और उत्पाद पृष्ठ पर दिखाई जाती है — जब तक विक्रेता अन्यथा न बताए, अधिकांश पुर्जों की 7-दिन की विंडो होती है। कुछ श्रेणियां (जैसे इलेक्ट्रॉनिक सेंसर, ECU, और लिस्टिंग पर गैर-वापसी योग्य बताई गई अन्य वस्तुएं) स्थापित होने के बाद स्वच्छता/सुरक्षा/धोखाधड़ी-रोधी कारणों से रिटर्न के लिए पात्र नहीं हैं।

## 2. पात्र कारण
आप रिटर्न का अनुरोध कर सकते हैं: क्षतिग्रस्त, दोषपूर्ण, या वर्णन से भौतिक रूप से भिन्न पुर्जे के लिए; गलत पुर्जा भेजे जाने के लिए; या (केवल जहां विक्रेता/श्रेणी अनुमति देती है, और रिटर्न-शिपिंग शुल्क के अधीन) केवल विचार बदलने पर, बशर्ते पुर्जा अप्रयुक्त हो और मूल पैकेजिंग में हो।

## 3. रिटर्न का अनुरोध कैसे करें
ऑर्डर → संबंधित ऑर्डर चुनें → रिटर्न का अनुरोध करें पर जाएं, एक कारण चुनें, और संकेत मिलने पर फ़ोटो अपलोड करें। हम अधिकांश श्रेणियों के लिए रिवर्स पिकअप शेड्यूल करेंगे या दिखाए गए प्रवाह के अनुसार आपसे स्वयं भेजने के लिए कहेंगे।

## 4. गुणवत्ता जांच और परिणाम
लौटाया गया पुर्जा प्राप्त होने पर, विक्रेता (या हमारी QC प्रक्रिया) आमतौर पर 5 कार्य दिवसों के भीतर इसका निरीक्षण करती है। स्वीकृत होने पर, आपके चयन के अनुसार रिफंड या प्रतिस्थापन जारी किया जाता है। विवादित होने पर (जैसे, विक्रेता कहता है कि पुर्जे में रिटर्न पर प्रकट न किए गए उपयोग के संकेत हैं), आप दोनों पक्षों से फोटो साक्ष्य के साथ एडमिन-मध्यस्थ विवाद में वृद्धि कर सकते हैं — इस समीक्षा के SLA के लिए शिकायत निवारण पृष्ठ देखें।

## 5. रिफंड विधि और समय-सीमा
रिटर्न स्वीकृत होने पर मूल भुगतान विधि पर रिफंड जारी किया जाता है (या, कैश ऑन डिलीवरी ऑर्डर के लिए, आपके लिंक किए गए बैंक खाते में / जहां आप चुनते हैं वहां प्लेटफ़ॉर्म क्रेडिट के रूप में)। Razorpay-संसाधित रिफंड आमतौर पर आपके बैंक के आधार पर 5-7 कार्य दिवसों में दिखाई देते हैं; खाता (क्रेडिट खाता) चुकौती तुरंत आपके क्रेडिट बैलेंस में जमा हो जाती है।

## 6. खरीदार-दोष कटौती
जहां रिटर्न विचार बदलने के कारण है (दोष नहीं), आपके रिफंड से एक रिटर्न-शिपिंग शुल्क (रिटर्न का अनुरोध करते समय प्रकट किया गया) काटा जा सकता है।

## 7. उचित उपयोग
बार-बार रिटर्न या कैश ऑन डिलीवरी ऑर्डर अस्वीकार करने का पैटर्न आपके खाते पर कैश ऑन डिलीवरी बंद कर सकता है या भविष्य के रिटर्न अनुरोधों के लिए मैन्युअल समीक्षा आवश्यक बना सकता है, ताकि मार्केटप्लेस विक्रेताओं और अन्य खरीदारों के लिए निष्पक्ष बना रहे।`,
    },
  },
  {
    slug: 'shipping-policy',
    type: 'policy',
    title: { en: 'Shipping Policy', hi: 'शिपिंग नीति' },
    metaDescription: {
      en: `How orders are shipped, tracked, and delivered on ${PLATFORM_NAME}.`,
      hi: `${PLATFORM_NAME} पर ऑर्डर कैसे भेजे, ट्रैक और डिलीवर किए जाते हैं।`,
    },
    body: {
      en: `Last updated: 11 August 2026

## 1. Shipping partners
Shipments are handled through Shiprocket's courier network. Since a single order can include parts from multiple sellers, it may arrive as multiple shipments, each independently tracked.

## 2. Shipping charges
Shipping charges (if any) are calculated per seller based on weight/dimensions and destination pincode, shown in full in the checkout price breakdown before you pay. Many listings offer free shipping above a threshold, shown on the product page.

## 3. Delivery timelines
Estimated delivery is shown on the product page and at checkout based on your pincode and the seller's location, and is typically 2–7 business days depending on serviceability. Oversized items (e.g. bumpers, panels, batteries) ship via surface transport with a longer estimated window and, per our shipping configuration, may not be eligible for Cash on Delivery.

## 4. Tracking
Once a seller ships your order, you can track it from Orders → order detail, showing courier name and AWB (airway bill) number, with live status updates (out for delivery, delivered, etc.).

## 5. Failed delivery (NDR)
If a courier is unable to deliver (address issue, unavailability, refused COD), it is flagged as a non-delivery report (NDR) in your order detail, and you can request a reattempt from there within the window shown.

## 6. Serviceability
Not every pincode is serviceable by every seller. We check serviceability against your delivery pincode before you complete checkout, and will tell you if a seller in your cart cannot deliver to your address.`,
      hi: `अंतिम अद्यतन: 11 अगस्त 2026

## 1. शिपिंग पार्टनर
शिपमेंट Shiprocket के कूरियर नेटवर्क के माध्यम से संभाले जाते हैं। चूंकि एक ऑर्डर में कई विक्रेताओं के पुर्जे शामिल हो सकते हैं, यह कई शिपमेंट के रूप में आ सकता है, प्रत्येक को स्वतंत्र रूप से ट्रैक किया जाता है।

## 2. शिपिंग शुल्क
शिपिंग शुल्क (यदि कोई हो) प्रति विक्रेता वज़न/आयाम और गंतव्य पिनकोड के आधार पर गणना किए जाते हैं, भुगतान करने से पहले चेकआउट मूल्य विवरण में पूर्ण रूप से दिखाए जाते हैं। कई लिस्टिंग एक सीमा से ऊपर मुफ्त शिपिंग प्रदान करती हैं, जो उत्पाद पृष्ठ पर दिखाई जाती है।

## 3. डिलीवरी समय-सीमा
अनुमानित डिलीवरी उत्पाद पृष्ठ और चेकआउट पर आपके पिनकोड और विक्रेता के स्थान के आधार पर दिखाई जाती है, और आमतौर पर सेवाक्षमता के आधार पर 2-7 कार्य दिवस होती है। बड़े आकार की वस्तुएं (जैसे बम्पर, पैनल, बैटरी) सतह परिवहन के माध्यम से लंबी अनुमानित विंडो के साथ भेजी जाती हैं और, हमारे शिपिंग कॉन्फ़िगरेशन के अनुसार, कैश ऑन डिलीवरी के लिए पात्र नहीं हो सकतीं।

## 4. ट्रैकिंग
एक बार विक्रेता आपका ऑर्डर भेज दे, तो आप इसे ऑर्डर → ऑर्डर विवरण से ट्रैक कर सकते हैं, जो कूरियर नाम और AWB (एयरवे बिल) नंबर दिखाता है, लाइव स्टेटस अपडेट (डिलीवरी के लिए निकला, डिलीवर किया गया, आदि) के साथ।

## 5. असफल डिलीवरी (NDR)
यदि कोई कूरियर डिलीवर करने में असमर्थ है (पता समस्या, अनुपलब्धता, COD अस्वीकृत), तो इसे आपके ऑर्डर विवरण में एक गैर-डिलीवरी रिपोर्ट (NDR) के रूप में चिह्नित किया जाता है, और आप दिखाई गई विंडो के भीतर वहां से पुनः प्रयास का अनुरोध कर सकते हैं।

## 6. सेवाक्षमता
हर पिनकोड हर विक्रेता द्वारा सेवा योग्य नहीं है। चेकआउट पूरा करने से पहले हम आपके डिलीवरी पिनकोड के विरुद्ध सेवाक्षमता जांचते हैं, और यदि आपके कार्ट में कोई विक्रेता आपके पते पर डिलीवर नहीं कर सकता तो हम आपको बताएंगे।`,
    },
  },
  {
    slug: 'cancellation-policy',
    type: 'policy',
    title: { en: 'Cancellation Policy', hi: 'रद्दीकरण नीति' },
    metaDescription: {
      en: `When you can cancel an order on ${PLATFORM_NAME} and how refunds work.`,
      hi: `${PLATFORM_NAME} पर ऑर्डर कब रद्द किया जा सकता है और रिफंड कैसे काम करता है।`,
    },
    body: {
      en: `Last updated: 11 August 2026

## 1. Buyer-initiated cancellation
You can cancel an order (or an individual seller's part of a multi-seller order) from Orders → order detail, for free, at any time before the seller has shipped it. Once a shipment has been dispatched, it can no longer be cancelled — you would need to refuse delivery or request a return after delivery instead (see the Return & Refund Policy).

## 2. Refund on cancellation
A cancellation before shipping is refunded in full, including any shipping charge already paid, to your original payment method or Khata credit balance, typically within 5–7 business days for Razorpay-processed payments.

## 3. Seller-initiated cancellation
A seller may reject/cancel an order they cannot fulfil (e.g. out of stock) before accepting it, or if they fail to accept within the SLA window it is auto-cancelled by the system — either way, you are refunded in full automatically, with no action needed from you.

## 4. Cash on Delivery orders
For Cash on Delivery orders, cancelling before shipping requires no refund processing since no payment was collected upfront; any COD convenience fee already charged is waived on cancellation.

## 5. Return-to-origin (RTO)
If a delivery fails repeatedly and the shipment returns to the seller (RTO), it is treated as a seller-side cancellation for refund purposes once the seller confirms receipt — you do not need to take any action.`,
      hi: `अंतिम अद्यतन: 11 अगस्त 2026

## 1. खरीदार द्वारा रद्दीकरण
आप ऑर्डर (या बहु-विक्रेता ऑर्डर में किसी एक विक्रेता के हिस्से) को ऑर्डर → ऑर्डर विवरण से, विक्रेता द्वारा भेजे जाने से पहले किसी भी समय, मुफ्त में रद्द कर सकते हैं। एक बार शिपमेंट भेज दिए जाने के बाद, इसे रद्द नहीं किया जा सकता — इसके बजाय आपको डिलीवरी अस्वीकार करनी होगी या डिलीवरी के बाद रिटर्न का अनुरोध करना होगा (रिटर्न और रिफंड नीति देखें)।

## 2. रद्दीकरण पर रिफंड
भेजने से पहले रद्दीकरण पर पहले से भुगतान किए गए किसी भी शिपिंग शुल्क सहित पूर्ण रिफंड, आपकी मूल भुगतान विधि या खाता क्रेडिट बैलेंस में, आमतौर पर Razorpay-संसाधित भुगतानों के लिए 5-7 कार्य दिवसों के भीतर दिया जाता है।

## 3. विक्रेता द्वारा रद्दीकरण
कोई विक्रेता स्वीकार करने से पहले किसी ऐसे ऑर्डर को अस्वीकार/रद्द कर सकता है जिसे वे पूरा नहीं कर सकते (जैसे स्टॉक खत्म), या यदि वे SLA विंडो के भीतर स्वीकार करने में विफल रहते हैं तो सिस्टम द्वारा इसे स्वतः रद्द कर दिया जाता है — किसी भी तरह, आपको स्वचालित रूप से पूर्ण रिफंड मिलता है, आपकी ओर से कोई कार्रवाई आवश्यक नहीं है।

## 4. कैश ऑन डिलीवरी ऑर्डर
कैश ऑन डिलीवरी ऑर्डर के लिए, भेजने से पहले रद्द करने पर किसी रिफंड प्रसंस्करण की आवश्यकता नहीं है क्योंकि पहले से कोई भुगतान एकत्र नहीं किया गया था; पहले से लिया गया कोई भी COD सुविधा शुल्क रद्दीकरण पर माफ कर दिया जाता है।

## 5. मूल स्थान पर वापसी (RTO)
यदि डिलीवरी बार-बार विफल होती है और शिपमेंट विक्रेता को वापस चला जाता है (RTO), तो एक बार विक्रेता द्वारा प्राप्ति की पुष्टि करने पर इसे रिफंड उद्देश्यों के लिए विक्रेता-पक्ष रद्दीकरण के रूप में माना जाता है — आपको कोई कार्रवाई करने की आवश्यकता नहीं है।`,
    },
  },
  {
    slug: 'grievance-redressal',
    type: 'policy',
    title: { en: 'Grievance Redressal', hi: 'शिकायत निवारण' },
    metaDescription: {
      en: `Our Grievance Officer's contact details and statutory response timelines.`,
      hi: `हमारे शिकायत निवारण अधिकारी के संपर्क विवरण और वैधानिक प्रतिक्रिया समय-सीमा।`,
    },
    body: {
      en: `Last updated: 11 August 2026

In accordance with Rule 5(1)-(3) of the Consumer Protection (E-Commerce) Rules, 2020, Rule 4(1)(b) of the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, and Section 13 of the Digital Personal Data Protection Act, 2023, ${PLATFORM_NAME} has appointed a Grievance Officer to address complaints about the Platform, a seller's conduct, or your personal data.

## Grievance Officer

- **Name**: [Grievance Officer Name — to be filled in before go-live]
- **Designation**: Grievance Officer
- **Address**: ${ADDRESS_PLACEHOLDER}
- **Email**: ${GRIEVANCE_EMAIL}
- **Phone**: ${SUPPORT_PHONE}

## Statutory response timelines
- **Acknowledgement**: within **48 hours** of receipt of your complaint.
- **Resolution**: within **one month** of the date of receipt, per Rule 4(1)(b) of the IT (Intermediary Guidelines) Rules, 2021.

## What to include in your complaint
Your order ID (if applicable), a description of the issue, and any supporting evidence (photos, screenshots). You can raise a grievance via the Contact/Support form on the Platform (fastest — creates a tracked ticket with the same SLA), by emailing ${GRIEVANCE_EMAIL}, or by writing to the address above.

## Escalation
If you are not satisfied with the Grievance Officer's resolution, you may approach:
- The **National Consumer Helpline** (1915 / UMANG app / e-Daakhil at edaakhil.nic.in) or your local Consumer Disputes Redressal Commission under the Consumer Protection Act, 2019.
- The **Data Protection Board of India**, for a personal-data-specific complaint, once constituted under the DPDP Act, 2023.
- The nearest **cyber crime cell** (cybercrime.gov.in) for suspected fraud or account compromise.

## Nodal Officer
For coordination with law enforcement and government agencies (Rule 5(9) of the IT Rules, 2021), the Grievance Officer above also serves as the Platform's Nodal Contact Person.`,
      hi: `अंतिम अद्यतन: 11 अगस्त 2026

उपभोक्ता संरक्षण (ई-कॉमर्स) नियम, 2020 के नियम 5(1)-(3), सूचना प्रौद्योगिकी (मध्यस्थ दिशानिर्देश और डिजिटल मीडिया आचार संहिता) नियम, 2021 के नियम 4(1)(b), और डिजिटल व्यक्तिगत डेटा संरक्षण अधिनियम, 2023 की धारा 13 के अनुसार, ${PLATFORM_NAME} ने प्लेटफ़ॉर्म, किसी विक्रेता के आचरण, या आपके व्यक्तिगत डेटा के बारे में शिकायतों को संबोधित करने के लिए एक शिकायत निवारण अधिकारी नियुक्त किया है।

## शिकायत निवारण अधिकारी

- **नाम**: [शिकायत निवारण अधिकारी का नाम — गो-लाइव से पहले भरा जाएगा]
- **पदनाम**: शिकायत निवारण अधिकारी
- **पता**: ${ADDRESS_PLACEHOLDER}
- **ईमेल**: ${GRIEVANCE_EMAIL}
- **फ़ोन**: ${SUPPORT_PHONE}

## वैधानिक प्रतिक्रिया समय-सीमा
- **स्वीकृति**: आपकी शिकायत प्राप्त होने के **48 घंटों** के भीतर।
- **समाधान**: IT (मध्यस्थ दिशानिर्देश) नियम, 2021 के नियम 4(1)(b) के अनुसार, प्राप्ति की तारीख से **एक महीने** के भीतर।

## अपनी शिकायत में क्या शामिल करें
आपका ऑर्डर ID (यदि लागू हो), समस्या का विवरण, और कोई भी सहायक साक्ष्य (फ़ोटो, स्क्रीनशॉट)। आप प्लेटफ़ॉर्म पर संपर्क/सहायता फॉर्म के माध्यम से (सबसे तेज़ — समान SLA के साथ एक ट्रैक किया गया टिकट बनाता है), ${GRIEVANCE_EMAIL} पर ईमेल करके, या ऊपर दिए गए पते पर लिखकर शिकायत उठा सकते हैं।

## वृद्धि
यदि आप शिकायत निवारण अधिकारी के समाधान से संतुष्ट नहीं हैं, तो आप संपर्क कर सकते हैं:
- **राष्ट्रीय उपभोक्ता हेल्पलाइन** (1915 / UMANG ऐप / edaakhil.nic.in पर ई-दाखिल) या उपभोक्ता संरक्षण अधिनियम, 2019 के तहत आपका स्थानीय उपभोक्ता विवाद निवारण आयोग।
- **भारत का डेटा संरक्षण बोर्ड**, व्यक्तिगत-डेटा-विशिष्ट शिकायत के लिए, DPDP अधिनियम, 2023 के तहत गठित होने के बाद।
- संदिग्ध धोखाधड़ी या खाता समझौता के लिए निकटतम **साइबर क्राइम सेल** (cybercrime.gov.in)।

## नोडल अधिकारी
कानून प्रवर्तन और सरकारी एजेंसियों के साथ समन्वय के लिए (IT नियम, 2021 का नियम 5(9)), ऊपर दिए गए शिकायत निवारण अधिकारी प्लेटफ़ॉर्म के नोडल संपर्क व्यक्ति के रूप में भी कार्य करते हैं।`,
    },
  },
]

const FAQ_ARTICLES: LegalPageInput[] = [
  {
    slug: 'faq-how-to-check-fitment',
    type: 'faq',
    title: { en: 'How do I know a part fits my vehicle?', hi: 'मुझे कैसे पता चलेगा कि कोई पुर्जा मेरे वाहन में फिट होता है?' },
    metaDescription: { en: 'Understanding the FITS / DOES NOT FIT / UNVERIFIED fitment bar.', hi: 'FITS / DOES NOT FIT / UNVERIFIED फिटमेंट बार को समझना।' },
    body: {
      en: `Add your vehicle (make, model, variant, year) from your Garage. Every listing then shows a fitment bar: **FITS** (verified against your vehicle), **DOES NOT FIT** (verified mismatch — you can still view it, but ordering is discouraged), or **UNVERIFIED** (no fitment data yet for this combination — check the part description and OEM/cross-reference numbers, or message the seller before ordering).`,
      hi: `अपने गैराज से अपना वाहन (मेक, मॉडल, वेरिएंट, वर्ष) जोड़ें। फिर प्रत्येक लिस्टिंग एक फिटमेंट बार दिखाती है: **FITS** (आपके वाहन के विरुद्ध सत्यापित), **DOES NOT FIT** (सत्यापित बेमेल — आप फिर भी देख सकते हैं, लेकिन ऑर्डर करने की सलाह नहीं दी जाती), या **UNVERIFIED** (इस संयोजन के लिए अभी तक कोई फिटमेंट डेटा नहीं — पुर्जे का विवरण और OEM/क्रॉस-रेफरेंस नंबर जांचें, या ऑर्डर करने से पहले विक्रेता को संदेश भेजें)।`,
    },
  },
  {
    slug: 'faq-quantity-slab-pricing',
    type: 'faq',
    title: { en: 'How does bulk (quantity-slab) pricing work?', hi: 'थोक (मात्रा-स्लैब) मूल्य निर्धारण कैसे काम करता है?' },
    metaDescription: { en: 'Understanding tiered per-unit pricing as order quantity increases.', hi: 'ऑर्डर मात्रा बढ़ने पर स्तरीय प्रति-इकाई मूल्य निर्धारण को समझना।' },
    body: {
      en: `Many listings price by quantity tier — order more, pay less per unit. The stepped bar on a product page shows each tier's quantity range and unit price, with the next tier highlighted so you can see exactly how many more units unlock the next discount. The tier you land in is calculated automatically from your cart quantity — no code needed.`,
      hi: `कई लिस्टिंग मात्रा स्तर के अनुसार मूल्य निर्धारित करती हैं — अधिक ऑर्डर करें, प्रति इकाई कम भुगतान करें। उत्पाद पृष्ठ पर स्टेप्ड बार प्रत्येक स्तर की मात्रा सीमा और इकाई मूल्य दिखाता है, अगले स्तर को हाइलाइट किया जाता है ताकि आप देख सकें कि अगली छूट अनलॉक करने के लिए कितनी और इकाइयों की आवश्यकता है। आप जिस स्तर में आते हैं वह आपके कार्ट मात्रा से स्वचालित रूप से गणना की जाती है — किसी कोड की आवश्यकता नहीं।`,
    },
  },
  {
    slug: 'faq-track-order',
    type: 'faq',
    title: { en: 'How do I track my order?', hi: 'मैं अपना ऑर्डर कैसे ट्रैक करूं?' },
    metaDescription: { en: 'Finding your AWB number and live shipment status.', hi: 'अपना AWB नंबर और लाइव शिपमेंट स्थिति खोजना।' },
    body: {
      en: `Go to Orders → select the order. If it has multiple sellers, each seller's part ships separately — you'll see one card per shipment with courier name, AWB (airway bill) number, and live status.`,
      hi: `ऑर्डर → ऑर्डर चुनें पर जाएं। यदि इसमें कई विक्रेता हैं, तो प्रत्येक विक्रेता का हिस्सा अलग से भेजा जाता है — आपको प्रति शिपमेंट एक कार्ड दिखाई देगा जिसमें कूरियर नाम, AWB (एयरवे बिल) नंबर, और लाइव स्थिति होगी।`,
    },
  },
  {
    slug: 'faq-cancel-order',
    type: 'faq',
    title: { en: 'How do I cancel an order?', hi: 'मैं ऑर्डर कैसे रद्द करूं?' },
    metaDescription: { en: 'Cancelling before a seller ships your order.', hi: 'विक्रेता के आपका ऑर्डर भेजने से पहले रद्द करना।' },
    body: {
      en: `From Orders → order detail, tap Cancel — available for free until the seller ships. Once shipped, you'll need to refuse delivery or request a return instead. See our Cancellation Policy for full details.`,
      hi: `ऑर्डर → ऑर्डर विवरण से, रद्द करें पर टैप करें — विक्रेता के भेजने तक मुफ्त में उपलब्ध। भेजे जाने के बाद, आपको डिलीवरी अस्वीकार करनी होगी या इसके बजाय रिटर्न का अनुरोध करना होगा। पूर्ण विवरण के लिए हमारी रद्दीकरण नीति देखें।`,
    },
  },
  {
    slug: 'faq-return-request',
    type: 'faq',
    title: { en: 'How do I request a return or refund?', hi: 'मैं रिटर्न या रिफंड का अनुरोध कैसे करूं?' },
    metaDescription: { en: 'Requesting a return from your order detail page.', hi: 'अपने ऑर्डर विवरण पृष्ठ से रिटर्न का अनुरोध करना।' },
    body: {
      en: `Go to Orders → order detail → Request Return, within the return window shown on the listing. Pick a reason, add photos if the part is damaged/defective, and submit. See the Return & Refund Policy for eligible reasons, timelines, and refund methods.`,
      hi: `ऑर्डर → ऑर्डर विवरण → रिटर्न का अनुरोध करें पर जाएं, लिस्टिंग पर दिखाई गई रिटर्न विंडो के भीतर। एक कारण चुनें, यदि पुर्जा क्षतिग्रस्त/दोषपूर्ण है तो फ़ोटो जोड़ें, और सबमिट करें। पात्र कारणों, समय-सीमा, और रिफंड विधियों के लिए रिटर्न और रिफंड नीति देखें।`,
    },
  },
  {
    slug: 'faq-genuine-part-badge',
    type: 'faq',
    title: { en: 'What does the "Genuine Part" badge mean?', hi: '"असली पुर्जा" बैज का क्या अर्थ है?' },
    metaDescription: { en: 'How a listing earns brand-authorization verification.', hi: 'लिस्टिंग ब्रांड-प्राधिकरण सत्यापन कैसे अर्जित करती है।' },
    body: {
      en: `The badge appears only when a seller has submitted a verified brand-authorization document for that brand and category, reviewed by our team — it is never awarded automatically just because a listing claims to be genuine. If a listing has no badge, that doesn't necessarily mean it's spurious; check the seller's rating and, if in doubt, ask before ordering.`,
      hi: `यह बैज तभी दिखाई देता है जब किसी विक्रेता ने उस ब्रांड और श्रेणी के लिए एक सत्यापित ब्रांड-प्राधिकरण दस्तावेज़ प्रस्तुत किया हो, जिसकी हमारी टीम द्वारा समीक्षा की गई हो — यह केवल इसलिए स्वचालित रूप से नहीं दिया जाता कि कोई लिस्टिंग असली होने का दावा करती है। यदि किसी लिस्टिंग में बैज नहीं है, तो इसका आवश्यक रूप से मतलब यह नहीं है कि यह संदिग्ध है; विक्रेता की रेटिंग जांचें और संदेह होने पर, ऑर्डर करने से पहले पूछें।`,
    },
  },
  {
    slug: 'faq-spurious-part',
    type: 'faq',
    title: { en: 'What do I do if I received a fake/spurious part?', hi: 'यदि मुझे नकली/संदिग्ध पुर्जा मिला तो मुझे क्या करना चाहिए?' },
    metaDescription: { en: 'Reporting a suspected counterfeit part.', hi: 'संदिग्ध नकली पुर्जे की रिपोर्ट करना।' },
    body: {
      en: `Use "Report spurious part" from the order or listing detail page — this starts a dedicated investigation, separate from an ordinary return, and can lead to warnings, listing removal, category bans, or delisting for a seller found to be selling counterfeits. You'll still be refunded through the normal return process for the specific order.`,
      hi: `ऑर्डर या लिस्टिंग विवरण पृष्ठ से "संदिग्ध पुर्जे की रिपोर्ट करें" का उपयोग करें — यह एक समर्पित जांच शुरू करता है, जो सामान्य रिटर्न से अलग है, और नकली सामान बेचते पाए गए विक्रेता के लिए चेतावनी, लिस्टिंग हटाने, श्रेणी प्रतिबंध, या डीलिस्टिंग का कारण बन सकता है। आपको फिर भी विशिष्ट ऑर्डर के लिए सामान्य रिटर्न प्रक्रिया के माध्यम से रिफंड मिलेगा।`,
    },
  },
  {
    slug: 'faq-khata-credit',
    type: 'faq',
    title: { en: 'What is Khata (credit account)?', hi: 'खाता (क्रेडिट खाता) क्या है?' },
    metaDescription: { en: 'How the buyer credit-line feature works.', hi: 'खरीदार क्रेडिट-लाइन सुविधा कैसे काम करती है।' },
    body: {
      en: `Khata is a post-paid credit line for eligible garages/fleet buyers — order now, settle your statement monthly, subject to an admin-approved credit limit. Apply from Account → Khata; approval and limit are set by our admin team based on your order history.`,
      hi: `खाता पात्र गैराज/फ्लीट खरीदारों के लिए एक पोस्ट-पेड क्रेडिट लाइन है — अभी ऑर्डर करें, मासिक रूप से अपना स्टेटमेंट निपटाएं, एडमिन-अनुमोदित क्रेडिट सीमा के अधीन। खाता → खाता से आवेदन करें; अनुमोदन और सीमा हमारी एडमिन टीम द्वारा आपके ऑर्डर इतिहास के आधार पर निर्धारित की जाती है।`,
    },
  },
  {
    slug: 'faq-become-seller',
    type: 'faq',
    title: { en: 'How do I start selling on the Platform?', hi: 'मैं प्लेटफ़ॉर्म पर बेचना कैसे शुरू करूं?' },
    metaDescription: { en: 'The seller onboarding process.', hi: 'विक्रेता ऑनबोर्डिंग प्रक्रिया।' },
    body: {
      en: `Tap "Sell on ${PLATFORM_NAME}" and complete the onboarding wizard: business details, GSTIN/PAN, pickup address, bank account, and KYC documents. Our team reviews the application (a GSTIN is required for approval in this version of the Platform); once approved, you can start listing immediately. See the Seller Agreement for full terms.`,
      hi: `"${PLATFORM_NAME} पर बेचें" पर टैप करें और ऑनबोर्डिंग विज़ार्ड पूरा करें: व्यावसायिक विवरण, GSTIN/PAN, पिकअप पता, बैंक खाता, और KYC दस्तावेज़। हमारी टीम आवेदन की समीक्षा करती है (इस संस्करण में अनुमोदन के लिए GSTIN आवश्यक है); अनुमोदन के बाद, आप तुरंत लिस्टिंग शुरू कर सकते हैं। पूर्ण शर्तों के लिए विक्रेता समझौता देखें।`,
    },
  },
  {
    slug: 'faq-contact-support',
    type: 'faq',
    title: { en: 'How do I contact support?', hi: 'मैं सहायता से कैसे संपर्क करूं?' },
    metaDescription: { en: 'Support channels, business hours, and response SLA.', hi: 'सहायता चैनल, व्यावसायिक घंटे, और प्रतिक्रिया SLA।' },
    body: {
      en: `Use the Contact/Support form (fastest — creates a tracked ticket), WhatsApp us at the number shown on the Support page, call ${SUPPORT_PHONE}, or email ${SUPPORT_EMAIL}. See the Support page for current business hours and our SLA policy.`,
      hi: `संपर्क/सहायता फॉर्म का उपयोग करें (सबसे तेज़ — एक ट्रैक किया गया टिकट बनाता है), सहायता पृष्ठ पर दिखाए गए नंबर पर हमें WhatsApp करें, ${SUPPORT_PHONE} पर कॉल करें, या ${SUPPORT_EMAIL} पर ईमेल करें। वर्तमान व्यावसायिक घंटों और हमारी SLA नीति के लिए सहायता पृष्ठ देखें।`,
    },
  },
]

export async function seedLegalContent(): Promise<void> {
  const now = Date.now()
  const all = [...PAGES, ...FAQ_ARTICLES]

  for (const page of all) {
    const ref = db.collection('cmsPages').doc(page.slug)
    const { id: _id, ...doc } = cmsPageSchema.parse({
      id: page.slug,
      slug: page.slug,
      type: page.type,
      title: page.title,
      body: page.body,
      metaDescription: page.metaDescription,
      status: 'published',
      createdAt: now,
      updatedAt: now,
    })
    await ref.set(doc)
  }

  console.log(`  cmsPages: ${PAGES.length} legal pages + ${FAQ_ARTICLES.length} FAQ articles written`)
}
