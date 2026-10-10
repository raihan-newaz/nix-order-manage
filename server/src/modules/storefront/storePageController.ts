import { Request, Response } from 'express';
import { z } from 'zod';
import sanitizeHtml from 'sanitize-html';
import prisma from '../../prisma';

type PageBlock = z.infer<typeof blockSchema>;
const cleanHtml = (html: string) => sanitizeHtml(html, {
  allowedTags: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'div', 'section', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
  allowedAttributes: { a: ['href', 'title'], img: ['src', 'alt', 'width', 'height', 'loading'] },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowProtocolRelative: false,
  nonTextTags: ['style', 'script', 'textarea', 'option', 'noscript'],
});
const serializeBlocks = (blocks: PageBlock[]) => JSON.stringify(blocks.map((block) => block.type === 'HTML' ? { ...block, html: cleanHtml(block.html || '') } : block));
const text = (heading: string, body: string, index: number): PageBlock => ({ id: `initial-${index}`, type: 'TEXT', heading, text: body });
const initialPages = [
  { slug: 'about', title: 'Easy pieces for real life.', eyebrow: 'ABOUT {storeName}', excerpt: '{storeName} brings together considered products, clear information and straightforward service for a confident shopping experience.', blocks: [
    text('Our approach', 'We aim to make it easy to discover useful products, understand available options and see the full price before placing an order.', 1),
    text('Shop with clarity', 'Product pages show available variations, pricing and stock information. If an option is unavailable, it cannot be added to your order.', 2),
    text('Here to help', 'Our customer care team can help with order, delivery and product questions. Keep your order number and checkout phone number nearby.', 3),
  ] },
  { slug: 'delivery', title: 'Delivery that keeps you informed.', eyebrow: 'DELIVERY INFORMATION', excerpt: '{storeName} delivers across Bangladesh using our supported courier network. Your delivery area and charge are shown before you order.', blocks: [
    text('Our courier partners', 'Depending on destination, service coverage and operational availability, orders may be dispatched with Pathao Courier, SteadFast Courier or RedX. The assigned courier is confirmed when your parcel is prepared.', 1),
    text('Delivery areas & charges', 'Choose Outside Dhaka, Dhaka sub area or Dhaka city at checkout. The applicable delivery charge is shown beside each option and included in your order total before confirmation.', 2),
    text('Processing & delivery time', 'Orders are reviewed and confirmed before dispatch. Delivery estimates can vary by destination, courier workload, weather and other service conditions; an estimate is not a guaranteed arrival time.', 3),
    text('Tracking your parcel', 'After dispatch, courier tracking information is added to your order when available. Visit Track order and enter your order number and checkout mobile number to view the latest store update. You may also use the assigned courier’s tracking service.', 4),
    text('A successful delivery', 'Please provide a complete address and an active phone number, and ensure someone can receive the parcel. If your address or availability changes, contact us as soon as possible. Delivery attempts and return handling depend on the courier’s service rules.', 5),
  ] },
  { slug: 'returns', title: 'We are here to help.', eyebrow: 'EXCHANGE & RETURNS', excerpt: 'If something is not right with your order, contact customer care promptly so we can review the issue and explain the available options.', blocks: [
    text('How to request help', 'Share your order number, checkout mobile number, the item and a clear description or photo of the issue. Please contact us before sending an item back.', 1),
    text('Item condition', 'For a size or product exchange, items should be unused, unwashed and returned with original tags and packaging where applicable. Approval and available options depend on the item and its condition.', 2),
    text('Availability & delivery', 'Exchanges depend on replacement stock and delivery coverage. Any return or redelivery arrangements, including applicable courier charges, will be confirmed with you before proceeding.', 3),
    text('Exceptions', 'Items showing wear, washing, damage after delivery or missing original components may not qualify. We will review each request and explain the decision.', 4),
  ] },
  { slug: 'faq', title: 'Questions, answered.', eyebrow: 'HELP CENTRE', excerpt: 'Helpful details for ordering, payment and delivery from {storeName}.', blocks: [
    text('Which couriers deliver orders?', 'We use Pathao Courier, SteadFast Courier or RedX depending on destination coverage and operational availability. Your assigned courier and tracking details are shared after dispatch when available.', 1),
    text('How is delivery charge selected?', 'Choose Outside Dhaka, Dhaka sub area or Dhaka city in your cart or at checkout. The selected rate is added to the total immediately.', 2),
    text('Can I pay online?', 'Cash on delivery is available. If secure online payment is enabled at checkout, you can also pay through UddoktaPay.', 3),
    text('How do I track an order?', 'Open Track order and enter the order number from your confirmation and the mobile number used at checkout. Courier tracking information appears when it has been added to the order.', 4),
    text('Can I change or cancel an order?', 'Contact us as soon as possible. Changes may not be possible after the parcel has been prepared or dispatched.', 5),
    text('How do product options work?', 'Select the available colour, size or other variation before adding a variable product to your bag.', 6),
  ] },
  { slug: 'maintenance', title: 'We will be right back.', eyebrow: 'SITE MAINTENANCE', excerpt: 'We are making a few improvements to {storeName}. Please check back shortly. For an existing order or urgent question, contact us at {phone}.', blocks: [
    text('Thank you for your patience', 'Our team is working to bring the store back online as soon as possible. Your existing orders remain safe.', 1),
  ] },
  { slug: 'privacy', title: 'Your information, handled carefully.', eyebrow: 'PRIVACY POLICY', excerpt: '{storeName} uses personal information to operate the store, fulfill orders and provide customer support.', blocks: [
    text('Information you provide', 'When you order or create an account, we may collect your name, phone number, email, delivery address, order details and information you choose to share with customer care.', 1),
    text('How information is used', 'We use this information to confirm and fulfill orders, arrange delivery, process payment, provide tracking and support, maintain account features and protect the store from misuse.', 2),
    text('Service providers', 'When needed to complete your order, relevant details are shared with the courier assigned to your parcel, such as Pathao Courier, SteadFast Courier or RedX, and with the selected payment provider. We share only information needed for the service.', 3),
    text('Analytics & preferences', 'If enabled, analytics or advertising tools may collect site usage events according to your consent and browser settings. You can review available privacy choices using the link in the site footer.', 4),
    text('Retention & protection', 'Order and account information is retained as needed for store operations, support and applicable recordkeeping. We use access controls and operational safeguards, but no internet transmission or storage system can be guaranteed completely secure.', 5),
    text('Your choices & contact', 'You may contact us to request help with your account information or privacy questions. Some order records may need to be retained for operational or legal recordkeeping. Call {phone} for customer care.', 6),
  ] },
  { slug: 'terms', title: 'Clear terms for confident shopping.', eyebrow: 'TERMS & CONDITIONS', excerpt: 'These terms explain how orders, payment and delivery work when you shop with {storeName}. Placing an order means you have reviewed and accepted these store terms.', blocks: [
    text('Orders & confirmation', 'An order request is subject to product availability and review. We may contact you using the phone number provided to confirm details. An order is not considered dispatched until it has been prepared and handed to a courier.', 1),
    text('Product details & availability', 'We make reasonable efforts to keep product descriptions, images, variations and stock information accurate. Displayed colours may vary by device. If an item or selected variation becomes unavailable, we will contact you about the available options.', 2),
    text('Prices & payment', 'Product prices and the selected delivery charge are shown before order submission. Available payment methods are shown at checkout; online payment is offered only when enabled. For cash on delivery, payment is due to the courier or delivery representative upon receipt.', 3),
    text('Delivery', 'Orders may be delivered by Pathao Courier, SteadFast Courier or RedX depending on service coverage and availability. Delivery estimates are not guaranteed. Please provide an accurate address and reachable phone number. Tracking information is provided when available.', 4),
    text('Changes, cancellations & returns', 'Contact customer care promptly if you need to change or cancel an order. A request may not be possible once processing or dispatch has begun. Exchanges and return requests are reviewed under our Exchange & returns information.', 5),
    text('Accounts & acceptable use', 'Keep your sign-in details private and provide accurate information. Do not misuse the site, interfere with its operation or submit fraudulent orders. We may limit access where needed to protect customers and store operations.', 6),
    text('Policies & support', 'Our Privacy policy explains how information is handled, and our Delivery information and Exchange & returns pages provide additional service details. For help, contact {phone} with your order number where relevant.', 7),
  ] },
];

export const reservedSlugs = new Set(['shop', 'product', 'cart', 'checkout', 'payment', 'order', 'signin', 'signup', 'account', 'contact', 'track-order', 'pages', 'flow', 'api', 'uploads', 'about', 'delivery', 'returns', 'faq', 'privacy', 'terms']);
const slugSchema = z.string().trim().toLowerCase().min(2).max(100).regex(/^[\p{L}\p{N}\p{M}]+(?:-[\p{L}\p{N}\p{M}]+)*$/u, 'Use letters, numbers and hyphens');
const urlSchema = z.string().trim().max(500).refine((value) => value === '' || value.startsWith('/') && !value.startsWith('//') || /^https:\/\//i.test(value), 'Use a site path or HTTPS URL');
const youtubeVideoId = (value: string) => {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase().replace(/^(www\.|m\.)/, '');
    const segment = url.pathname.split('/').filter(Boolean);
    const id = host === 'youtu.be' ? segment[0]
      : host === 'youtube.com' ? (url.pathname === '/watch' ? url.searchParams.get('v') : ['shorts', 'live', 'embed'].includes(segment[0]) ? segment[1] : null)
        : host === 'youtube-nocookie.com' && segment[0] === 'embed' ? segment[1] : null;
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch { return null; }
};
const landingStyleSchema = z.object({
  background: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  hoverColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  align: z.enum(['left', 'center']).optional(),
  width: z.enum(['normal', 'wide']).optional(),
  spacing: z.enum(['compact', 'normal', 'spacious']).optional(),
  fontFamily: z.enum(['inherit', 'Manrope', 'Hind Siliguri']).optional(),
}).optional();
const landingBase = { id: z.string().uuid(), style: landingStyleSchema };
const landingImageRatioSchema = z.enum(['AUTO', '1:1', '4:5', '3:4', '16:9', '9:16']).optional();
const blockSchema = z.discriminatedUnion('type', [
  z.object({ id: z.string().min(1).max(80), type: z.literal('TEXT'), heading: z.string().trim().max(160), text: z.string().trim().max(10000) }),
  z.object({ id: z.string().min(1).max(80), type: z.literal('IMAGE'), url: urlSchema.refine(Boolean), alt: z.string().trim().max(200), text: z.string().trim().max(500).optional() }),
  z.object({ id: z.string().min(1).max(80), type: z.literal('BUTTON'), label: z.string().trim().min(1).max(80), url: urlSchema.refine(Boolean) }),
  z.object({ id: z.string().min(1).max(80), type: z.literal('HTML'), html: z.string().max(50000) }),
  z.object({ ...landingBase, type: z.literal('HERO'), eyebrow: z.string().max(80), heading: z.string().min(1).max(180), text: z.string().max(1200), image: urlSchema, imageRatio: landingImageRatioSchema, buttonText: z.string().trim().max(80).optional() }),
  z.object({ ...landingBase, type: z.literal('TEXT_SECTION'), heading: z.string().max(160), text: z.string().max(5000) }),
  z.object({ ...landingBase, type: z.literal('IMAGE_SECTION'), heading: z.string().max(160), image: urlSchema, images: z.array(urlSchema.refine(Boolean)).max(12).optional(), imageRatio: landingImageRatioSchema, display: z.enum(['SINGLE', 'CAROUSEL']).optional(), caption: z.string().max(500) }),
  z.object({ ...landingBase, type: z.literal('SIZE_CHART'), heading: z.string().max(160), columns: z.array(z.string().trim().min(1).max(60)).max(6), rows: z.array(z.array(z.string().trim().max(60)).max(6)).max(20), note: z.string().max(500) }),
  z.object({ ...landingBase, type: z.literal('VIDEO'), heading: z.string().max(160), url: z.string().trim().max(500).refine((value) => value === '' || Boolean(youtubeVideoId(value)), 'Use a valid HTTPS YouTube video URL'), autoplay: z.boolean().optional(), aspectRatio: z.enum(['AUTO', '16:9', '9:16', '4:3', '1:1']).optional() }),
  z.object({ ...landingBase, type: z.literal('GALLERY'), heading: z.string().max(160), images: z.array(urlSchema.refine(Boolean)).max(12), imageRatio: landingImageRatioSchema, display: z.enum(['GRID', 'CAROUSEL']).optional() }),
  z.object({ ...landingBase, type: z.literal('FEATURES'), heading: z.string().max(160), items: z.array(z.string().trim().min(1).max(240)).max(12) }),
  z.object({ ...landingBase, type: z.literal('TESTIMONIALS'), heading: z.string().max(160), items: z.array(z.object({ quote: z.string().trim().min(1).max(500), author: z.string().trim().max(80) })).max(12) }),
  z.object({ ...landingBase, type: z.literal('FAQ'), heading: z.string().max(160), items: z.array(z.object({ question: z.string().trim().min(1).max(180), answer: z.string().trim().max(900) })).max(12) }),
  z.object({ ...landingBase, type: z.literal('CTA'), heading: z.string().max(160), text: z.string().max(500), label: z.string().trim().min(1).max(80) }),
  z.object({ ...landingBase, type: z.literal('SPACER'), height: z.number().int().min(8).max(120) }),
  z.object({ ...landingBase, type: z.literal('COUNTDOWN'), heading: z.string().trim().min(1).max(160), endAt: z.string().datetime() }),
  z.object({ ...landingBase, type: z.literal('CHECKOUT'), heading: z.string().min(1).max(160), productIds: z.array(z.string().uuid()).max(12), selection: z.enum(['SINGLE', 'MULTI']), minProducts: z.number().int().min(1).max(12).optional(), maxProducts: z.number().int().min(1).max(12).optional(), couponEnabled: z.boolean().optional(), freeDeliveryMinQuantity: z.number().int().min(0).max(200).optional(), paymentMethods: z.array(z.enum(['COD', 'UDDOKTAPAY'])).min(1).max(2).optional(), buttonText: z.string().trim().min(1).max(80), nameLabel: z.string().trim().max(80).optional(), namePlaceholder: z.string().trim().max(100).optional(), phoneLabel: z.string().trim().max(80).optional(), phonePlaceholder: z.string().trim().max(100).optional(), addressLabel: z.string().trim().max(80).optional(), addressPlaceholder: z.string().trim().max(120).optional(), billingHeading: z.string().trim().max(120).optional(), productsHeading: z.string().trim().max(120).optional(), footerTitle: z.string().trim().max(120).optional(), footerDeliveryText: z.string().trim().max(160).optional(), footerPrivacyText: z.string().trim().max(100).optional() }),
]);
export const pageSchema = z.object({
  title: z.string().trim().min(2).max(120), slug: slugSchema,
  eyebrow: z.string().trim().max(80).optional().default(''), excerpt: z.string().trim().max(1200).optional().default(''),
  coverImage: urlSchema.optional().default(''), blocks: z.array(blockSchema).max(50),
  metaTitle: z.string().trim().max(160).optional().default(''), metaDescription: z.string().trim().max(320).optional().default(''),
  status: z.enum(['DRAFT', 'PUBLISHED']),
  isActive: z.boolean().optional(),
});
export const validateLanding = (page: z.infer<typeof pageSchema>) => {
  if (!page.slug.startsWith('flow-')) return null;
  const checkoutBlocks = page.blocks.filter((block) => block.type === 'CHECKOUT');
  if (checkoutBlocks.length !== 1 || page.blocks.at(-1)?.type !== 'CHECKOUT') return 'Landing pages need one checkout block at the end';
  if (page.status === 'PUBLISHED' && checkoutBlocks[0].type === 'CHECKOUT' && checkoutBlocks[0].productIds.length === 0) return 'Choose at least one product before publishing';
  const checkout = checkoutBlocks[0];
  if (checkout?.type === 'CHECKOUT') {
    const min = checkout.minProducts ?? 1;
    const max = checkout.selection === 'SINGLE' ? 1 : checkout.maxProducts ?? checkout.productIds.length;
    if (min > max || max > Math.max(1, checkout.productIds.length)) return 'Product selection limits must fit the selected products';
    if (checkout.selection === 'SINGLE' && min !== 1) return 'Choose-one checkout requires one product';
  }
  if (page.status === 'PUBLISHED' && page.blocks.some((block) => block.type === 'VIDEO' && !block.url)) return 'Add a YouTube URL or remove the empty video section before publishing';
  if (page.status === 'PUBLISHED' && page.blocks.some((block) => block.type === 'IMAGE_SECTION' && (block.display === 'CAROUSEL' ? !(block.images?.length || block.image) : !block.image))) return 'Add an image or remove the empty image section before publishing';
  if (page.status === 'PUBLISHED' && page.blocks.some((block) => block.type === 'GALLERY' && block.display === 'CAROUSEL' && block.images.length === 0)) return 'Add images or remove the empty carousel before publishing';
  if (page.status === 'PUBLISHED' && page.blocks.some((block) => block.type === 'SIZE_CHART' && (block.columns.length < 2 || block.rows.some((row) => row.length !== block.columns.length)))) return 'Each size chart row must match at least two columns';
  return null;
};
export const validateLandingProducts = async (page: z.infer<typeof pageSchema>) => {
  if (!page.slug.startsWith('flow-') || page.status !== 'PUBLISHED') return null;
  const checkout = page.blocks.find((block) => block.type === 'CHECKOUT');
  if (!checkout || checkout.type !== 'CHECKOUT') return 'Choose a checkout section';
  if (new Set(checkout.productIds).size !== checkout.productIds.length) return 'Remove duplicate checkout products';
  const count = await prisma.product.count({ where: { id: { in: checkout.productIds }, status: 'ACTIVE' } });
  return count === checkout.productIds.length ? null : 'One or more checkout products are not active';
};

let seedPromise: Promise<void> | null = null;
const ensureInitialPages = () => {
  if (!seedPromise) seedPromise = Promise.all(initialPages.map((page) => prisma.storePage.upsert({
    where: { systemKey: page.slug }, update: {}, create: { ...page, systemKey: page.slug, blocks: JSON.stringify(page.blocks), status: 'PUBLISHED', isSystem: true },
  }))).then(() => undefined).catch((error) => { seedPromise = null; throw error; });
  return seedPromise;
};
const parsePage = (page: any) => ({ ...page, blocks: (JSON.parse(page.blocks || '[]') as PageBlock[]).map((block) => block.type === 'HTML' ? { ...block, html: cleanHtml(block.html || '') } : block), aliases: JSON.parse(page.aliases || '[]') as string[] });
const fail = (res: Response, error: any) => res.status(500).json({ success: false, message: error.message || 'Page request failed' });
const slugInUse = async (slug: string, exceptId?: string) => {
  const pages = await prisma.storePage.findMany({ select: { id: true, slug: true, aliases: true } });
  return pages.some((page) => page.id !== exceptId && (page.slug === slug || (JSON.parse(page.aliases || '[]') as string[]).includes(slug)));
};

export const listAdminPages = async (_req: Request, res: Response) => {
  try { await ensureInitialPages(); const pages = await prisma.storePage.findMany({ orderBy: [{ isSystem: 'desc' }, { updatedAt: 'desc' }] }); res.json({ success: true, pages: pages.map(parsePage) }); }
  catch (error) { fail(res, error); }
};
export const getAdminPage = async (req: Request, res: Response) => {
  try { await ensureInitialPages(); const page = await prisma.storePage.findUnique({ where: { id: String(req.params.id) } }); if (!page) return res.status(404).json({ success: false, message: 'Page not found' }); res.json({ success: true, page: parsePage(page) }); }
  catch (error) { fail(res, error); }
};
export const getPublicPage = async (req: Request, res: Response) => {
  try {
    const slug = String(req.params.slug).toLowerCase();
    if (reservedSlugs.has(slug)) await ensureInitialPages();
    // Look up canonical and landing slugs together; aliases need the slower fallback only.
    const [canonical, landing] = await Promise.all([
      prisma.storePage.findUnique({ where: { slug } }),
      reservedSlugs.has(slug) ? Promise.resolve(null) : prisma.storePage.findUnique({ where: { slug: `flow-${slug}` } }),
    ]);
    let page = canonical || landing;
    if (!page) { const matches = await prisma.storePage.findMany({ where: { aliases: { contains: slug } } }); page = matches.find((row) => (JSON.parse(row.aliases || '[]') as string[]).includes(slug)) || null; }
    if (!page || page.status !== 'PUBLISHED' || !page.isActive) return res.status(404).json({ success: false, message: 'Page not found' });
    res.json({ success: true, page: parsePage(page) });
  } catch (error) { fail(res, error); }
};
export const createPage = async (req: Request, res: Response) => {
  const parsed = pageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message });
  const landingError = validateLanding(parsed.data);
  if (landingError) return res.status(400).json({ success: false, message: landingError });
  if (reservedSlugs.has(parsed.data.slug)) return res.status(400).json({ success: false, message: 'This slug is reserved for a storefront feature' });
  try {
    await ensureInitialPages();
    const productError = await validateLandingProducts(parsed.data);
    if (productError) return res.status(400).json({ success: false, message: productError });
    if (parsed.data.slug.startsWith('flow-')) {
      const publicSlug = parsed.data.slug.slice('flow-'.length);
      if (reservedSlugs.has(publicSlug)) return res.status(400).json({ success: false, message: 'This landing URL is reserved for a storefront feature' });
      if (await slugInUse(publicSlug)) return res.status(409).json({ success: false, message: 'This landing URL is already in use' });
    }
    if (await slugInUse(parsed.data.slug)) return res.status(409).json({ success: false, message: 'This page slug is already in use' });
    const page = await prisma.storePage.create({ data: { ...parsed.data, isActive: parsed.data.isActive ?? true, blocks: serializeBlocks(parsed.data.blocks) } });
    res.status(201).json({ success: true, page: parsePage(page) });
  } catch (error) { fail(res, error); }
};
export const updatePage = async (req: Request, res: Response) => {
  const parsed = pageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message });
  const landingError = validateLanding(parsed.data);
  if (landingError) return res.status(400).json({ success: false, message: landingError });
  if (reservedSlugs.has(parsed.data.slug)) return res.status(400).json({ success: false, message: 'This slug is reserved for a storefront feature' });
  try {
    const existing = await prisma.storePage.findUnique({ where: { id: String(req.params.id) } });
    if (!existing) return res.status(404).json({ success: false, message: 'Page not found' });
    if (await prisma.builderLanding.findUnique({ where: { storePageId: existing.id }, select: { id: true } })) return res.status(409).json({ success: false, message: 'This landing page is managed in Visual Studio. Save checkout settings there and publish the complete page.' });
    const productError = await validateLandingProducts(parsed.data);
    if (productError) return res.status(400).json({ success: false, message: productError });
    if (parsed.data.slug.startsWith('flow-')) {
      const publicSlug = parsed.data.slug.slice('flow-'.length);
      if (reservedSlugs.has(publicSlug)) return res.status(400).json({ success: false, message: 'This landing URL is reserved for a storefront feature' });
      if (await slugInUse(publicSlug, existing.id)) return res.status(409).json({ success: false, message: 'This landing URL is already in use' });
    }
    if (await slugInUse(parsed.data.slug, existing.id)) return res.status(409).json({ success: false, message: 'This page slug is already in use' });
    const previous = JSON.parse(existing.aliases || '[]') as string[];
    const aliases = existing.slug !== parsed.data.slug ? [...new Set([...previous.filter((slug) => slug !== parsed.data.slug), existing.slug])] : previous;
    const page = await prisma.storePage.update({ where: { id: existing.id }, data: { ...parsed.data, isActive: parsed.data.isActive ?? existing.isActive, blocks: serializeBlocks(parsed.data.blocks), aliases: JSON.stringify(aliases) } });
    res.json({ success: true, page: parsePage(page) });
  } catch (error) { fail(res, error); }
};
export const trashPage = async (req: Request, res: Response) => {
  try { const page = await prisma.storePage.update({ where: { id: String(req.params.id) }, data: { status: 'TRASH' } }); res.json({ success: true, page: parsePage(page) }); }
  catch (error: any) { if (error.code === 'P2025') return res.status(404).json({ success: false, message: 'Page not found' }); fail(res, error); }
};
export const setPageActive = async (req: Request, res: Response) => {
  const parsed = z.object({ isActive: z.boolean() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Choose Active or Inactive' });
  try {
    const existing = await prisma.storePage.findUnique({ where: { id: String(req.params.id) } });
    if (!existing || existing.status === 'TRASH') return res.status(404).json({ success: false, message: 'Page not found' });
    if (await prisma.builderLanding.findUnique({ where: { storePageId: existing.id }, select: { id: true } })) return res.status(409).json({ success: false, message: 'This landing page is managed in Visual Studio. Publish or unpublish it there.' });
    const page = await prisma.storePage.update({ where: { id: existing.id }, data: { isActive: parsed.data.isActive } });
    res.json({ success: true, page: parsePage(page) });
  } catch (error) { fail(res, error); }
};
export const restorePage = async (req: Request, res: Response) => {
  try { const page = await prisma.storePage.update({ where: { id: String(req.params.id), status: 'TRASH' }, data: { status: 'DRAFT' } }); res.json({ success: true, page: parsePage(page) }); }
  catch (error: any) { if (error.code === 'P2025') return res.status(404).json({ success: false, message: 'Trashed page not found' }); fail(res, error); }
};
export const deletePage = async (req: Request, res: Response) => {
  try {
    const page = await prisma.storePage.findUnique({ where: { id: String(req.params.id) } });
    if (!page || page.status !== 'TRASH') return res.status(400).json({ success: false, message: 'Move the page to Trash first' });
    if (page.isSystem) return res.status(400).json({ success: false, message: 'Built-in pages can be hidden or restored, but not permanently deleted' });
    await prisma.$transaction(async (tx) => {
      const linked = await tx.builderLanding.findUnique({ where: { storePageId: page.id }, select: { builderPageId: true } });
      await tx.storePage.delete({ where: { id: page.id } });
      if (linked) await tx.builderPage.delete({ where: { id: linked.builderPageId } });
    });
    res.json({ success: true });
  } catch (error) { fail(res, error); }
};
