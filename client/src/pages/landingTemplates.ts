export type LandingStyle = { background?: string; color?: string; accent?: string; hoverColor?: string; align?: 'left' | 'center'; width?: 'normal' | 'wide'; spacing?: 'compact' | 'normal' | 'spacious'; fontFamily?: 'inherit' | 'Manrope' | 'Hind Siliguri' };
export type LandingImageRatio = 'AUTO' | '1:1' | '4:5' | '3:4' | '16:9' | '9:16';
export const imageRatioValue = (ratio?: LandingImageRatio) => ratio && ratio !== 'AUTO' ? ratio.replace(':', ' / ') : undefined;
export const youtubeId = (value: string) => { try { const url = new URL(value); if (url.protocol !== 'https:') return null; const host = url.hostname.toLowerCase().replace(/^(www\.|m\.)/, ''); const segment = url.pathname.split('/').filter(Boolean); const id = host === 'youtu.be' ? segment[0] : host === 'youtube.com' ? (url.pathname === '/watch' ? url.searchParams.get('v') : ['shorts', 'live', 'embed'].includes(segment[0]) ? segment[1] : null) : host === 'youtube-nocookie.com' && segment[0] === 'embed' ? segment[1] : null; return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null; } catch { return null; } };
export type LandingBlock =
  | { id: string; type: 'HERO'; eyebrow: string; heading: string; text: string; image: string; imageRatio?: LandingImageRatio; buttonText?: string; style?: LandingStyle }
  | { id: string; type: 'TEXT_SECTION'; heading: string; text: string; style?: LandingStyle }
  | { id: string; type: 'IMAGE_SECTION'; heading: string; image: string; images?: string[]; imageRatio?: LandingImageRatio; display?: 'SINGLE' | 'CAROUSEL'; caption: string; style?: LandingStyle }
  | { id: string; type: 'SIZE_CHART'; heading: string; columns: string[]; rows: string[][]; note: string; style?: LandingStyle }
  | { id: string; type: 'VIDEO'; heading: string; url: string; autoplay?: boolean; aspectRatio?: 'AUTO' | '16:9' | '9:16' | '4:3' | '1:1'; style?: LandingStyle }
  | { id: string; type: 'GALLERY'; heading: string; images: string[]; imageRatio?: LandingImageRatio; display?: 'GRID' | 'CAROUSEL'; style?: LandingStyle }
  | { id: string; type: 'FEATURES'; heading: string; items: string[]; style?: LandingStyle }
  | { id: string; type: 'TESTIMONIALS'; heading: string; items: Array<{ quote: string; author: string }>; style?: LandingStyle }
  | { id: string; type: 'FAQ'; heading: string; items: Array<{ question: string; answer: string }>; style?: LandingStyle }
  | { id: string; type: 'CTA'; heading: string; text: string; label: string; style?: LandingStyle }
  | { id: string; type: 'COUNTDOWN'; heading: string; endAt: string; style?: LandingStyle }
  | { id: string; type: 'SPACER'; height: number; style?: LandingStyle }
  | { id: string; type: 'CHECKOUT'; heading: string; productIds: string[]; selection: 'SINGLE' | 'MULTI'; minProducts?: number; maxProducts?: number; couponEnabled?: boolean; freeDeliveryMinQuantity?: number; paymentMethods?: Array<'COD' | 'UDDOKTAPAY'>; buttonText: string; billingHeading?: string; productsHeading?: string; nameLabel?: string; namePlaceholder?: string; phoneLabel?: string; phonePlaceholder?: string; addressLabel?: string; addressPlaceholder?: string; footerTitle?: string; footerDeliveryText?: string; footerPrivacyText?: string; style?: LandingStyle };

export const createLandingBlock = (type: LandingBlock['type']): LandingBlock => {
  const id = crypto.randomUUID();
  switch (type) {
    case 'HERO': return { id, type, eyebrow: 'LIMITED OFFER', heading: 'A product your customers will love', text: 'Describe the main value in a few clear sentences.', image: '', imageRatio: 'AUTO', buttonText: 'এখনই বুকিং করুন', style: { background: '#f8fafc', color: '#0f172a', accent: '#e11d48', spacing: 'spacious' } };
    case 'TEXT_SECTION': return { id, type, heading: 'The details that matter', text: 'Share your product story, materials, care instructions or delivery information here.' };
    case 'IMAGE_SECTION': return { id, type, heading: 'See the details', image: '', images: [], imageRatio: '4:5', display: 'SINGLE', caption: '' };
    case 'SIZE_CHART': return { id, type, heading: 'Size guide', columns: ['Size', 'Chest', 'Length'], rows: [['S', '36 in', '27 in'], ['M', '38 in', '28 in'], ['L', '40 in', '29 in']], note: 'Measurements are approximate.' };
    case 'VIDEO': return { id, type, heading: 'ভিডিওতে পণ্যটি দেখুন', url: '', autoplay: false, aspectRatio: 'AUTO' };
    case 'GALLERY': return { id, type, heading: 'Take a closer look', images: [], imageRatio: '1:1', display: 'GRID' };
    case 'FEATURES': return { id, type, heading: 'Why customers choose this', items: ['Comfortable everyday use', 'Quality you can see', 'Easy and secure ordering'] };
    case 'TESTIMONIALS': return { id, type, heading: 'Customer feedback', items: [{ quote: 'Add a verified customer review here.', author: 'Customer' }] };
    case 'FAQ': return { id, type, heading: 'Questions answered', items: [{ question: 'How long does delivery take?', answer: 'We will confirm the expected delivery time when your order is processed.' }] };
    case 'CTA': return { id, type, heading: 'Ready to order?', text: 'Choose your option and complete the form below.', label: 'Order now', style: { background: '#0f172a', color: '#ffffff', accent: '#facc15', align: 'center' } };
    case 'COUNTDOWN': return { id, type, heading: 'সীমিত সময়ের অফার', endAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), style: { background: '#161616', color: '#ffffff', accent: '#ef5b18', align: 'center', spacing: 'compact', fontFamily: 'Hind Siliguri' } };
    case 'SPACER': return { id, type, height: 32 };
    case 'CHECKOUT': return { id, type, heading: 'Complete your order', productIds: [], selection: 'SINGLE', minProducts: 1, maxProducts: 1, couponEnabled: true, paymentMethods: ['COD'], buttonText: 'Place order', style: { background: '#f8fafc', color: '#0f172a', accent: '#0f766e' } };
  }
};

type Template = { id: string; name: string; description: string; color: string; recipe: LandingBlock['type'][] };
export const landingTemplates: Template[] = [
  { id: 'hajj-combo', name: 'হজ্জ কম্বো প্যাকেজ', description: 'আপনার screenshot-এর mobile offer, video, সুবিধা, package ও এক পৃষ্ঠার checkout', color: '#ef4b17', recipe: ['COUNTDOWN', 'VIDEO', 'CTA', 'IMAGE_SECTION', 'IMAGE_SECTION', 'TEXT_SECTION', 'FEATURES', 'CTA', 'IMAGE_SECTION', 'FEATURES', 'SIZE_CHART', 'CTA', 'TESTIMONIALS', 'CTA', 'CHECKOUT'] },
  { id: 'service', name: 'DevPro সার্ভিস', description: 'সার্ভিস হাইলাইট, কাজের ধাপ ও enquiry checkout', color: '#173b6c', recipe: ['HERO', 'IMAGE_SECTION', 'FEATURES', 'TEXT_SECTION', 'TESTIMONIALS', 'FAQ', 'CTA', 'CHECKOUT'] },
  { id: 'organic-beauty', name: 'অর্গানিক বিউটি প্রোডাক্ট', description: 'Product gallery, ingredients ও ব্যবহারবিধি', color: '#547a3b', recipe: ['HERO', 'GALLERY', 'FEATURES', 'TEXT_SECTION', 'TESTIMONIALS', 'FAQ', 'CTA', 'CHECKOUT'] },
  { id: 'rice-serum', name: 'Rice Skin Beauty Serum', description: 'Beauty product story ও multi-image carousel', color: '#a85d42', recipe: ['HERO', 'GALLERY', 'TEXT_SECTION', 'FEATURES', 'IMAGE_SECTION', 'FAQ', 'CTA', 'CHECKOUT'] },
  { id: 'three-piece-dress', name: 'থ্রি-পিস ড্রেস', description: 'Fashion photos, size guide ও order form', color: '#873c71', recipe: ['HERO', 'GALLERY', 'FEATURES', 'SIZE_CHART', 'TESTIMONIALS', 'CTA', 'CHECKOUT'] },
  { id: 'classy-combo', name: 'The Classy Combo', description: 'Combo carousel, benefits ও product selection', color: '#9a6a25', recipe: ['HERO', 'IMAGE_SECTION', 'FEATURES', 'GALLERY', 'FAQ', 'CTA', 'CHECKOUT'] },
  { id: 'henna-pack', name: 'মেহেদী হেয়ার প্যাক', description: 'Product photos, ingredients ও ব্যবহারবিধি', color: '#7a5136', recipe: ['HERO', 'GALLERY', 'TEXT_SECTION', 'FEATURES', 'TESTIMONIALS', 'CTA', 'CHECKOUT'] },
  { id: 'pitha-collection', name: 'দেশি পিঠা কালেকশন', description: 'Food photos, ingredients ও delivery details', color: '#a74727', recipe: ['HERO', 'GALLERY', 'FEATURES', 'TEXT_SECTION', 'FAQ', 'CTA', 'CHECKOUT'] },
  { id: 'sajone-powder', name: 'সজনে পাতার গুঁড়া', description: 'Product story, preparation details ও FAQ', color: '#4b7042', recipe: ['HERO', 'IMAGE_SECTION', 'TEXT_SECTION', 'FEATURES', 'FAQ', 'CTA', 'CHECKOUT'] },
  { id: 'loafer-shoe', name: 'Loafer Shoe', description: 'Shoe gallery, size chart ও product details', color: '#35495f', recipe: ['HERO', 'GALLERY', 'FEATURES', 'SIZE_CHART', 'TESTIMONIALS', 'FAQ', 'CHECKOUT'] },
  { id: 'combo-polo', name: '3 pcs Combo Polo', description: 'তিনটি matching colour, swipeable carousel, size chart ও এক পাতার checkout', color: '#176b50', recipe: ['COUNTDOWN', 'HERO', 'IMAGE_SECTION', 'FEATURES', 'TEXT_SECTION', 'SIZE_CHART', 'FAQ', 'CTA', 'CHECKOUT'] },
];

export const blocksFromTemplate = (id: string): LandingBlock[] => {
  const template = landingTemplates.find((item) => item.id === id);
  const blocks = (template?.recipe || ['HERO', 'CHECKOUT']).map(createLandingBlock);
  const hero = blocks.find((block): block is Extract<LandingBlock, { type: 'HERO' }> => block.type === 'HERO');
  const headlines: Record<string, [string, string, string]> = {
    'hajj-combo': ['বিশেষ প্যাকেজ', 'আপনার প্যাকেজের নাম লিখুন', 'প্যাকেজে কী কী থাকছে, যাত্রার সময় ও প্রয়োজনীয় তথ্য এখানে যোগ করুন।'],
    service: ['আপনার কাজ সহজ করি', 'সার্ভিসের মূল সুবিধাটি লিখুন', 'আপনার কাজের ধরন, delivery process ও যোগাযোগের তথ্য এখানে দিন।'],
    'organic-beauty': ['যত্নের ছোঁয়া', 'আপনার beauty product পরিচয় করান', 'উপাদান, ব্যবহারবিধি ও প্রযোজ্য সতর্কতা পরিষ্কারভাবে লিখুন।'],
    'rice-serum': ['SKINCARE EDIT', 'আপনার serum-এর গল্প বলুন', 'Product details, ingredients ও ব্যবহারবিধি ক্রেতার কাছে তুলে ধরুন।'],
    'three-piece-dress': ['নতুন কালেকশন', 'আপনার পছন্দের থ্রি-পিস খুঁজে নিন', 'কাপড়, ডিজাইন, মাপ ও যত্নের তথ্য ছবির সঙ্গে দেখান।'],
    'classy-combo': ['কম্বো অফার', 'আপনার combo-তে কী কী আছে দেখুন', 'প্রতিটি item ও combo option-এর বিবরণ দিন।'],
    'henna-pack': ['প্রাকৃতিক যত্ন', 'আপনার হেয়ার প্যাক পরিচয় করান', 'উপাদান, প্রস্তুতপ্রণালী ও ব্যবহারের নির্দেশনা যোগ করুন।'],
    'pitha-collection': ['ঘরের স্বাদ', 'আপনার পিঠার আয়োজন দেখুন', 'পিঠার ধরন, ingredients, পরিমাণ ও delivery তথ্য লিখুন।'],
    'sajone-powder': ['খাঁটি পণ্যের পরিচয়', 'আপনার সজনে পাতা পাউডার দেখুন', 'উপাদান, সংরক্ষণ ও ব্যবহারবিধি লিখুন। স্বাস্থ্য দাবি থাকলে যাচাই করা তথ্য ব্যবহার করুন।'],
    'loafer-shoe': ['নতুন জুতা', 'আপনার loafer-এর design দেখান', 'Material, fit, available size ও exchange info যোগ করুন।'],
    'combo-polo': ['৩ পিস · ৩টি রঙ', 'এক সেটে তিন রঙের Polo Shirt', 'Navy, Forest Green ও Burgundy—একই design-এর তিনটি Polo Shirt-এর combo। নিজের মাপ অনুযায়ী size chart দেখে অর্ডার করুন।'],
  };
  if (hero && template) {
    [hero.eyebrow, hero.heading, hero.text] = headlines[id] || headlines['video-first'];
    hero.style = { ...hero.style, accent: template.color, background: id === 'loafer-shoe' ? '#f1f5f9' : id === 'three-piece-dress' ? '#fff7fb' : id === 'pitha-collection' ? '#fff7ed' : '#f8fafc', fontFamily: ['hajj-combo', 'service', 'organic-beauty', 'rice-serum', 'three-piece-dress', 'henna-pack', 'pitha-collection', 'sajone-powder'].includes(id) ? 'Hind Siliguri' : 'inherit' };
  }
  const sectionCopy: Record<string, Partial<Record<LandingBlock['type'], string>>> = {
    'hajj-combo': { COUNTDOWN: 'সীমিত সময়ের অফার', VIDEO: 'এক প্যাকেজেই হজ্জের সব আয়োজন', IMAGE_SECTION: 'প্যাকেজের এক ঝলক', TEXT_SECTION: 'এই হজ্জ প্যাকেজে কী কী পাবেন?', FEATURES: 'প্যাকেজে যা থাকছে', SIZE_CHART: 'প্যাকেজ ও মূল্য তালিকা', TESTIMONIALS: 'হজ্জ যাত্রীদের অভিজ্ঞতা', CTA: 'আপনার আসন বুক করুন', CHECKOUT: 'আপনার বুকিং সম্পন্ন করুন' },
    service: { IMAGE_SECTION: 'আমাদের কাজ', FEATURES: 'সার্ভিসে যা পাবেন', TEXT_SECTION: 'কাজের প্রক্রিয়া', TESTIMONIALS: 'ক্লায়েন্ট মতামত', FAQ: 'সার্ভিস FAQ', CTA: 'কাজ শুরু করি', CHECKOUT: 'আপনার তথ্য দিন' },
    'organic-beauty': { GALLERY: 'পণ্যের ছবি', FEATURES: 'পণ্যের বৈশিষ্ট্য', TEXT_SECTION: 'উপাদান ও ব্যবহারবিধি', TESTIMONIALS: 'গ্রাহকের মতামত', FAQ: 'ব্যবহার নিয়ে প্রশ্ন', CTA: 'অর্ডার করতে নিচে যান', CHECKOUT: 'অর্ডার সম্পন্ন করুন' },
    'rice-serum': { GALLERY: 'পণ্যের বিস্তারিত ছবি', TEXT_SECTION: 'উপাদান ও ব্যবহারবিধি', FEATURES: 'পণ্যের বৈশিষ্ট্য', IMAGE_SECTION: 'ব্যবহারের ধাপ', FAQ: 'সাধারণ প্রশ্ন', CTA: 'অর্ডার করুন', CHECKOUT: 'অর্ডার সম্পন্ন করুন' },
    'three-piece-dress': { GALLERY: 'ডিজাইন ও রঙ দেখুন', FEATURES: 'ড্রেসের বিবরণ', SIZE_CHART: 'সাইজ গাইড', TESTIMONIALS: 'ক্রেতাদের মতামত', CTA: 'আপনার পছন্দ বাছুন', CHECKOUT: 'পছন্দের ড্রেস অর্ডার করুন' },
    'classy-combo': { IMAGE_SECTION: 'কম্বোতে যা থাকছে', FEATURES: 'কম্বোর সুবিধা', GALLERY: 'প্রতিটি item দেখুন', FAQ: 'অর্ডারের আগে জানুন', CTA: 'কম্বো বেছে নিন', CHECKOUT: 'কম্বো অর্ডার করুন' },
    'henna-pack': { GALLERY: 'পণ্যের ছবি', TEXT_SECTION: 'উপাদান ও ব্যবহারের নিয়ম', FEATURES: 'পণ্যের বিবরণ', TESTIMONIALS: 'ক্রেতাদের মতামত', CTA: 'অর্ডার করতে নিচে যান', CHECKOUT: 'অর্ডার সম্পন্ন করুন' },
    'pitha-collection': { GALLERY: 'পিঠার আয়োজন', FEATURES: 'কালেকশনে যা পাবেন', TEXT_SECTION: 'উপাদান ও delivery info', FAQ: 'অর্ডার ও delivery প্রশ্ন', CTA: 'আপনার পিঠা বাছুন', CHECKOUT: 'অর্ডার সম্পন্ন করুন' },
    'sajone-powder': { IMAGE_SECTION: 'পণ্যের ছবি', TEXT_SECTION: 'উপাদান ও ব্যবহারবিধি', FEATURES: 'পণ্যের বিবরণ', FAQ: 'সাধারণ প্রশ্ন', CTA: 'অর্ডার করুন', CHECKOUT: 'অর্ডার সম্পন্ন করুন' },
    'loafer-shoe': { GALLERY: 'রঙ ও design দেখুন', FEATURES: 'জুতার বিবরণ', SIZE_CHART: 'সাইজ বাছাই গাইড', TESTIMONIALS: 'ক্রেতাদের মতামত', FAQ: 'সাইজ ও exchange FAQ', CHECKOUT: 'আপনার size বেছে অর্ডার করুন' },
    'combo-polo': { COUNTDOWN: 'কম্বো অফার শেষ হতে বাকি', IMAGE_SECTION: 'একই design, তিনটি colour', FEATURES: '৩ পিস Combo-তে যা থাকছে', TEXT_SECTION: 'আপনার দৈনন্দিন style-এর জন্য', SIZE_CHART: 'সাইজ চার্ট · মাপ মিলিয়ে নিন', FAQ: 'অর্ডারের আগে জেনে নিন', CTA: 'আপনার ৩ পিস Combo নিন', CHECKOUT: '৩ pcs Combo Polo অর্ডার করুন' },
  };
  const copy = sectionCopy[id] || {};
  blocks.forEach((block, index) => {
    const heading = copy[block.type];
    if ('heading' in block && heading) block.heading = heading;
    if (block.type === 'GALLERY' && ['rice-serum', 'pitha-collection'].includes(id)) block.display = 'CAROUSEL';
    if (block.type === 'IMAGE_SECTION' && id === 'classy-combo') block.display = 'CAROUSEL';
    if (block.style && template) block.style = { ...block.style, accent: template.color };
    if (block.type === 'CTA' && template) block.style = { ...block.style, background: '#17221d', color: '#ffffff', accent: template.color, align: 'center' };
    if ((block.type === 'FEATURES' || block.type === 'TEXT_SECTION') && index % 2 === 0) block.style = { ...block.style, background: '#f7f8f5', accent: template?.color };
    if (block.type === 'CHECKOUT') block.style = { ...block.style, background: '#f8fafc', accent: template?.color };
    if (block.type === 'CTA' && heading) block.text = 'Product, offer ও delivery সংক্রান্ত তথ্য লিখুন।';
    if (block.type === 'CHECKOUT' && heading) block.buttonText = 'অর্ডার কনফার্ম করুন';
  });
  if (id === 'hajj-combo') {
    const countdown = blocks.find((block): block is Extract<LandingBlock, { type: 'COUNTDOWN' }> => block.type === 'COUNTDOWN');
    if (countdown) countdown.style = { ...countdown.style, background: '#171717', color: '#fff', accent: '#f25418', align: 'center', fontFamily: 'Hind Siliguri' };
    const video = blocks.find((block): block is Extract<LandingBlock, { type: 'VIDEO' }> => block.type === 'VIDEO');
    if (video) { video.heading = 'এক প্যাকেজেই হজ্জের সব আয়োজন'; video.style = { background: '#171717', color: '#fff', accent: '#f25418', align: 'center', spacing: 'compact', fontFamily: 'Hind Siliguri' }; }
    const ctas = blocks.filter((block): block is Extract<LandingBlock, { type: 'CTA' }> => block.type === 'CTA');
    ctas.forEach((block, index) => { block.label = index === ctas.length - 1 ? 'এখনই বুকিং করতে চাই' : 'এখনই বুকিং করুন'; block.text = index === ctas.length - 1 ? 'বিস্তারিত জানতে বা বুকিং করতে কল করুন' : 'আসন সীমিত—আজই আপনার বুকিং নিশ্চিত করুন'; block.style = { background: '#fff', color: '#171717', accent: '#ef3c20', align: 'center', spacing: 'compact', fontFamily: 'Hind Siliguri' }; });
    const images = blocks.filter((block): block is Extract<LandingBlock, { type: 'IMAGE_SECTION' }> => block.type === 'IMAGE_SECTION');
    images.forEach((block, index) => { block.heading = index === 0 ? 'বিশেষ অফার!' : index === 1 ? 'আপনার হজ্জ যাত্রা হোক সহজ' : 'প্যাকেজের আরও কিছু তথ্য'; block.caption = 'আপনার প্যাকেজের ছবি যোগ করুন'; block.style = { background: index === 2 ? '#191919' : '#f7f7f7', color: index === 2 ? '#fff' : '#171717', accent: '#ef3c20', align: 'center', spacing: 'compact', fontFamily: 'Hind Siliguri' }; });
    const features = blocks.filter((block): block is Extract<LandingBlock, { type: 'FEATURES' }> => block.type === 'FEATURES');
    features.forEach((block, index) => { block.heading = index === 0 ? 'এই হজ্জ প্যাকেজে কী কী পাবেন?' : 'কেন আমাদের প্যাকেজ নেবেন?'; block.items = ['অন্তর্ভুক্ত সেবার বিবরণ এখানে লিখুন', 'যাতায়াত ও অবস্থানের তথ্য যোগ করুন', 'গাইড সংক্রান্ত তথ্য সম্পাদনা করুন', 'বুকিংয়ের শর্ত ও নিয়ম লিখুন']; block.style = { background: index === 0 ? '#f7f7f7' : '#191919', color: index === 0 ? '#171717' : '#fff', accent: '#f25418', spacing: 'compact', fontFamily: 'Hind Siliguri' }; });
    const info = blocks.find((block): block is Extract<LandingBlock, { type: 'TEXT_SECTION' }> => block.type === 'TEXT_SECTION');
    if (info) { info.text = 'যাত্রার সময়, প্যাকেজে অন্তর্ভুক্ত সেবা, প্রয়োজনীয় কাগজপত্র এবং বুকিংয়ের শর্ত এখানে নিজের তথ্য দিয়ে সম্পাদনা করুন।'; info.style = { background: '#fff', color: '#171717', align: 'center', spacing: 'compact', fontFamily: 'Hind Siliguri' }; }
    const table = blocks.find((block): block is Extract<LandingBlock, { type: 'SIZE_CHART' }> => block.type === 'SIZE_CHART');
    if (table) { table.columns = ['প্যাকেজ', 'যা থাকছে', 'মূল্য']; table.rows = [['Premium', 'আপনার package details', '৳—'], ['Basic', 'আপনার package details', '৳—']]; table.note = 'চূড়ান্ত মূল্য ও অন্তর্ভুক্ত সেবা এখানে লিখুন।'; table.style = { background: '#f2f6f9', color: '#171717', spacing: 'compact', fontFamily: 'Hind Siliguri' }; }
    const reviews = blocks.find((block): block is Extract<LandingBlock, { type: 'TESTIMONIALS' }> => block.type === 'TESTIMONIALS');
    if (reviews) { reviews.items = [{ quote: 'যাত্রীর অনুমতি নিয়ে আসল মতামত এখানে যোগ করুন।', author: 'হজ্জ যাত্রী' }]; reviews.style = { background: '#f7f7f7', align: 'center', spacing: 'compact', fontFamily: 'Hind Siliguri' }; }
    const checkout = blocks.find((block): block is Extract<LandingBlock, { type: 'CHECKOUT' }> => block.type === 'CHECKOUT');
    if (checkout) checkout.style = { background: '#f2f5f8', color: '#171717', accent: '#ef4b17', spacing: 'compact', fontFamily: 'Hind Siliguri' };
  }
  if (id === 'combo-polo') {
    const imagePaths = ['/images/3pcs-combo-polo/navy.png', '/images/3pcs-combo-polo/forest.png', '/images/3pcs-combo-polo/burgundy.png'];
    const countdown = blocks.find((block): block is Extract<LandingBlock, { type: 'COUNTDOWN' }> => block.type === 'COUNTDOWN');
    if (countdown) countdown.style = { background: '#10231f', color: '#ffffff', accent: '#e7b65c', align: 'center', spacing: 'compact', fontFamily: 'Hind Siliguri' };
    if (hero) {
      hero.eyebrow = '3 PCS · 3 COLOURS';
      hero.heading = 'এক সেটে তিন রঙের Polo Shirt';
      hero.text = 'Navy, Forest Green ও Burgundy—একই design-এর তিনটি Polo Shirt-এর combo। নিজের মাপ অনুযায়ী size chart দেখে অর্ডার করুন।';
      hero.image = imagePaths[0];
      hero.buttonText = 'কম্বো অর্ডার করুন';
      hero.style = { background: '#f3f6f3', color: '#10231f', accent: '#176b50', hoverColor: '#0f513d', spacing: 'normal', fontFamily: 'Hind Siliguri' };
    }
    const carousel = blocks.find((block): block is Extract<LandingBlock, { type: 'IMAGE_SECTION' }> => block.type === 'IMAGE_SECTION');
    if (carousel) { carousel.display = 'CAROUSEL'; carousel.images = imagePaths; carousel.image = imagePaths[0]; carousel.caption = 'Navy · Forest Green · Burgundy'; carousel.style = { background: '#ffffff', color: '#10231f', spacing: 'normal', width: 'normal', fontFamily: 'Hind Siliguri' }; }
    const benefits = blocks.find((block): block is Extract<LandingBlock, { type: 'FEATURES' }> => block.type === 'FEATURES');
    if (benefits) { benefits.items = ['এক সেটে ৩টি Polo Shirt', 'Navy, Forest Green ও Burgundy—তিনটি colour', 'একই classic Polo design', 'অর্ডারের আগে size chart-এ মাপ মিলিয়ে নিন']; benefits.style = { background: '#f3f6f3', color: '#10231f', accent: '#176b50', spacing: 'normal', fontFamily: 'Hind Siliguri' }; }
    const details = blocks.find((block): block is Extract<LandingBlock, { type: 'TEXT_SECTION' }> => block.type === 'TEXT_SECTION');
    if (details) { details.text = 'এক সেটে Navy, Forest Green ও Burgundy—তিনটি সহজে পরা যায় এমন colour।\nছবি swipe করে প্রতিটি Polo-এর রং ও design কাছ থেকে দেখুন।\nঅর্ডারের আগে size chart-এর সঙ্গে নিজের মাপ মিলিয়ে নিন।\nCheckout-এ ডেলিভারি এলাকা বেছে নিলে চার্জসহ মোট মূল্য দেখতে পাবেন।'; details.style = { background: '#ffffff', color: '#24332d', spacing: 'normal', width: 'normal', fontFamily: 'Hind Siliguri' }; }
    const sizeChart = blocks.find((block): block is Extract<LandingBlock, { type: 'SIZE_CHART' }> => block.type === 'SIZE_CHART');
    if (sizeChart) { sizeChart.columns = ['সাইজ', 'বুক (ইঞ্চি)', 'লম্বা (ইঞ্চি)']; sizeChart.rows = [['M', '38', '27'], ['L', '40', '28'], ['XL', '42', '29'], ['XXL', '44', '30']]; sizeChart.note = 'এগুলো প্রাথমিক নমুনা মাপ। Publish করার আগে আসল পোশাক মেপে size chart যাচাই/সংশোধন করুন।'; sizeChart.style = { background: '#f3f6f3', color: '#10231f', accent: '#176b50', align: 'center', spacing: 'normal', fontFamily: 'Hind Siliguri' }; }
    const faq = blocks.find((block): block is Extract<LandingBlock, { type: 'FAQ' }> => block.type === 'FAQ');
    if (faq) { faq.items = [
      { question: 'কম্বোতে কয়টি Polo Shirt থাকবে?', answer: 'এই offer-এ Navy, Forest Green ও Burgundy—মোট ৩টি Polo Shirt থাকবে।' },
      { question: 'কোন size বেছে নেব?', answer: 'Size chart-এর বুক ও লম্বার মাপের সঙ্গে নিজের মাপ মিলিয়ে নিন। চার্টটি publish করার আগে আসল পোশাকের মাপ যাচাই করুন।' },
      { question: 'Delivery charge কোথায় দেখব?', answer: 'Checkout-এ delivery area বেছে নিলে প্রযোজ্য charge এবং total দেখা যাবে।' },
      { question: 'কীভাবে অর্ডার করব?', answer: 'নিচের checkout form-এ নাম, mobile number ও সম্পূর্ণ ঠিকানা দিয়ে অর্ডার সম্পন্ন করুন।' },
    ]; faq.style = { background: '#ffffff', color: '#24332d', spacing: 'normal', fontFamily: 'Hind Siliguri' }; }
    const cta = blocks.find((block): block is Extract<LandingBlock, { type: 'CTA' }> => block.type === 'CTA');
    if (cta) { cta.heading = '৩টি colour একসাথে নিন'; cta.text = 'Size chart-এ মাপ মিলিয়ে নিচের checkout form পূরণ করুন।'; cta.label = 'এখনই অর্ডার করুন'; cta.style = { background: '#10231f', color: '#ffffff', accent: '#176b50', hoverColor: '#0f513d', align: 'center', spacing: 'normal', fontFamily: 'Hind Siliguri' }; }
    const checkout = blocks.find((block): block is Extract<LandingBlock, { type: 'CHECKOUT' }> => block.type === 'CHECKOUT');
    if (checkout) { checkout.heading = '৩ pcs Combo Polo অর্ডার করতে নিচের ফর্মটি পূরণ করুন'; checkout.selection = 'SINGLE'; checkout.buttonText = 'অর্ডার কনফার্ম করুন'; checkout.style = { background: '#f7f8f6', color: '#10231f', accent: '#176b50', hoverColor: '#0f513d', spacing: 'normal', fontFamily: 'Hind Siliguri' }; }
  }
  const checkout = blocks.find((block): block is Extract<LandingBlock, { type: 'CHECKOUT' }> => block.type === 'CHECKOUT');
  if (checkout && template) {
    checkout.style = { ...checkout.style, accent: template.color };
    if (id === 'classy-combo') checkout.selection = 'MULTI';
  }
  return blocks;
};
