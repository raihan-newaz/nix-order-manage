import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '../../prisma';
import { pageSchema, reservedSlugs, validateLanding, validateLandingProducts } from '../storefront/storePageController';
import { createNode } from './core/registry';
import { cloneNode } from './core/commands';
import { emptyDocument, type BuilderNode } from './core/schema';
import { convertLegacyLanding, missingLegacySections } from './landingConversion';
import { failure, validatedDocument, type Author } from './service';
import { thankYouDocument } from './thankYouDocument';

async function createThankYou(tx: Prisma.TransactionClient, storePageId: string, title: string, author: Author) {
  const doc = validatedDocument(thankYouDocument(title, `thank-you-${storePageId}`));
  const document = JSON.stringify(doc);
  const page = await tx.builderPage.create({ data: { title: doc.title, slug: doc.slug, draft: document, published: document, publishedSlug: doc.slug, publishedVersion: 1, createdBy: author.id, updatedBy: author.id, revisions: { create: { version: 1, document, action: 'create-thank-you', authorId: author.id, authorName: author.name } } } });
  return page.id;
}

export async function ensureLandingThankYou(builderPageId: string, author: Author) {
  return prisma.$transaction(async tx => {
    const link = await tx.builderLanding.findUnique({ where: { builderPageId }, include: { storePage: true } });
    if (!link) throw failure(404, 'Landing page not found');
    if (link.thankYouPageId) return link.thankYouPageId;
    const pageId = await createThankYou(tx, link.storePageId, link.storePage.title, author);
    await tx.builderLanding.update({ where: { id: link.id }, data: { thankYouPageId: pageId } });
    return pageId;
  });
}

const checkoutDraftInput = z.object({
  title: z.string().trim().min(2).max(120),
  metaTitle: z.string().trim().max(160),
  metaDescription: z.string().trim().max(320),
  checkout: z.unknown(),
  version: z.number().int().min(0),
}).strict();

const summary = { id: true, storePageId: true, builderPageId: true, thankYouPageId: true, storePage: { select: { title: true, slug: true, status: true, isActive: true, updatedAt: true } }, builderPage: { select: { version: true, publishedVersion: true } } } as const;

export async function listLandingLinks() { return prisma.builderLanding.findMany({ select: summary, take: 200, orderBy: { createdAt: 'desc' } }); }
export async function findLandingByBuilder(builderPageId: string) {
  const link = await prisma.builderLanding.findFirst({ where: { OR: [{ builderPageId }, { thankYouPageId: builderPageId }] }, select: summary });
  if (!link) return null;
  if (link.thankYouPageId === builderPageId) return { ...link, pageKind: 'thank-you', warnings: [], missingNodes: [] };
  const [page, builderPage] = await Promise.all([
    prisma.storePage.findUnique({ where: { id: link.storePageId }, select: { blocks: true } }),
    prisma.builderPage.findUnique({ where: { id: builderPageId }, select: { draft: true } }),
  ]);
  let blocks: unknown;
  try { blocks = JSON.parse(page?.blocks || '[]'); } catch { blocks = null; }
  const imported = convertLegacyLanding(link.storePage.title, `landing-${link.storePageId}`, blocks);
  const missing = missingLegacySections(blocks, validatedDocument(JSON.parse(builderPage?.draft || '{}')));
  return { ...link, pageKind: 'landing', warnings: [...imported.warnings, ...missing.warnings], missingNodes: missing.nodes };
}

/** Checkout drafts are separate from the StorePage configuration used for real orders. */
export async function readLandingCheckout(builderPageId: string) {
  const link = await prisma.builderLanding.findUnique({ where: { builderPageId }, include: { storePage: { include: { checkoutDraft: true } } } });
  if (!link || link.storePage.status === 'TRASH') throw failure(404, 'Landing page not found');
  const storePage = link.storePage;
  const blocks = JSON.parse(storePage.checkoutDraft?.blocks || storePage.blocks || '[]') as Array<Record<string, unknown>>;
  const checkout = blocks.find(block => block.type === 'CHECKOUT');
  if (!checkout) throw failure(400, 'This landing page has no checkout');
  return {
    storePageId: storePage.id, slug: storePage.slug.slice('flow-'.length),
    title: storePage.checkoutDraft?.title ?? storePage.title,
    metaTitle: storePage.checkoutDraft?.metaTitle ?? storePage.metaTitle ?? '',
    metaDescription: storePage.checkoutDraft?.metaDescription ?? storePage.metaDescription ?? '',
    checkout, version: storePage.checkoutDraft?.version ?? 0,
    status: storePage.status, isActive: storePage.isActive,
  };
}

export async function saveLandingCheckout(builderPageId: string, input: unknown) {
  const payload = checkoutDraftInput.parse(input);
  const link = await prisma.builderLanding.findUnique({ where: { builderPageId }, include: { storePage: true } });
  if (!link || link.storePage.status === 'TRASH') throw failure(404, 'Landing page not found');
  const validated = pageSchema.parse({
    title: payload.title, slug: link.storePage.slug, blocks: [payload.checkout],
    metaTitle: payload.metaTitle, metaDescription: payload.metaDescription,
    status: 'DRAFT', isActive: false,
  });
  if (validateLanding(validated)) throw failure(400, validateLanding(validated)!);
  const blocks = JSON.stringify(validated.blocks);
  const current = await prisma.landingCheckoutDraft.findUnique({ where: { storePageId: link.storePageId } });
  if ((current?.version ?? 0) !== payload.version) throw failure(409, 'Checkout settings changed. Reload before saving.');
  if (current) {
    const changed = await prisma.landingCheckoutDraft.updateMany({ where: { storePageId: link.storePageId, version: payload.version }, data: { blocks, title: validated.title, metaTitle: validated.metaTitle, metaDescription: validated.metaDescription, version: { increment: 1 } } });
    if (!changed.count) throw failure(409, 'Checkout settings changed. Reload before saving.');
  } else {
    try { await prisma.landingCheckoutDraft.create({ data: { storePageId: link.storePageId, blocks, title: validated.title, metaTitle: validated.metaTitle, metaDescription: validated.metaDescription } }); }
    catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw failure(409, 'Checkout settings changed. Reload before saving.'); throw error; }
  }
  return readLandingCheckout(builderPageId);
}

/** Publish design and the saved checkout draft in one database transaction. */
export async function publishLanding(builderPageId: string, baseVersion: number, author: Author) {
  const link = await prisma.builderLanding.findUnique({ where: { builderPageId }, include: { storePage: { include: { checkoutDraft: true } }, builderPage: true } });
  if (!link || link.storePage.status === 'TRASH') throw failure(404, 'Landing page not found');
  if (link.builderPage.version !== baseVersion) throw failure(409, 'Studio design changed. Reload before publishing.');
  const design = validatedDocument(JSON.parse(link.builderPage.draft));
  const draft = link.storePage.checkoutDraft;
  const draftBlocks = JSON.parse(draft?.blocks || link.storePage.blocks || '[]') as Array<Record<string, unknown>>;
  const checkout = draftBlocks.find(block => block.type === 'CHECKOUT');
  const configuration = pageSchema.parse({
    title: draft?.title ?? link.storePage.title, slug: link.storePage.slug,
    blocks: checkout ? [checkout] : [],
    metaTitle: draft?.metaTitle ?? link.storePage.metaTitle ?? '',
    metaDescription: draft?.metaDescription ?? link.storePage.metaDescription ?? '',
    status: 'PUBLISHED', isActive: true,
  });
  const validationError = validateLanding(configuration) || await validateLandingProducts(configuration);
  if (validationError) throw failure(400, validationError);
  const oldBlocks = JSON.parse(link.storePage.blocks || '[]') as Array<Record<string, unknown>>;
  const blocks = JSON.stringify([...oldBlocks.filter(block => block.type !== 'CHECKOUT'), configuration.blocks[0]]);
  const serialized = JSON.stringify(design);
  return prisma.$transaction(async tx => {
    if (draft) {
      const currentDraft = await tx.landingCheckoutDraft.findUnique({ where: { storePageId: link.storePageId }, select: { version: true } });
      if (currentDraft?.version !== draft.version) throw failure(409, 'Checkout settings changed. Reload before publishing.');
    }
    const changed = await tx.builderPage.updateMany({ where: { id: builderPageId, version: baseVersion }, data: {
      published: serialized, publishedVersion: baseVersion + 1, publishedSlug: design.slug,
      version: { increment: 1 }, updatedBy: author.id,
    } });
    if (!changed.count) throw failure(409, 'Studio design changed. Reload before publishing.');
    await tx.builderRevision.create({ data: { pageId: builderPageId, version: baseVersion + 1, document: serialized, action: 'publish', authorId: author.id, authorName: author.name } });
    await tx.storePage.update({ where: { id: link.storePageId }, data: {
      title: configuration.title, metaTitle: configuration.metaTitle,
      metaDescription: configuration.metaDescription, blocks,
      status: 'PUBLISHED', isActive: true,
    } });
    return { version: baseVersion + 1, publishedVersion: baseVersion + 1, status: 'PUBLISHED', isActive: true, url: `/${link.storePage.slug.slice('flow-'.length)}` };
  });
}

export async function unpublishLanding(builderPageId: string, baseVersion: number, author: Author) {
  return prisma.$transaction(async tx => {
    const link = await tx.builderLanding.findUnique({ where: { builderPageId }, include: { builderPage: true } });
    if (!link) throw failure(404, 'Landing page not found');
    if (link.builderPage.version !== baseVersion) throw failure(409, 'Studio design changed. Reload before unpublishing.');
    const changed = await tx.builderPage.updateMany({ where: { id: builderPageId, version: baseVersion }, data: {
      published: null, publishedVersion: null, publishedSlug: null, version: { increment: 1 }, updatedBy: author.id,
    } });
    if (!changed.count) throw failure(409, 'Studio design changed. Reload before unpublishing.');
    await tx.builderRevision.create({ data: { pageId: builderPageId, version: baseVersion + 1, document: link.builderPage.draft, action: 'unpublish', authorId: author.id, authorName: author.name } });
    await tx.storePage.update({ where: { id: link.storePageId }, data: { status: 'DRAFT', isActive: false } });
    return { version: baseVersion + 1, publishedVersion: null, status: 'DRAFT', isActive: false };
  });
}

export async function connectLanding(storePageId: string, author: Author) {
  const existing = await prisma.builderLanding.findUnique({ where: { storePageId }, select: summary });
  if (existing) return { link: existing, warnings: [] as string[] };
  const storePage = await prisma.storePage.findUnique({ where: { id: storePageId } });
  if (!storePage || !storePage.slug.startsWith('flow-') || storePage.status === 'TRASH') throw failure(404, 'Landing page not found');
  const { document, warnings } = convertLegacyLanding(storePage.title, `landing-${storePage.id}`, JSON.parse(storePage.blocks || '[]'));
  document.seo.title = storePage.metaTitle || '';
  document.seo.description = storePage.metaDescription || '';
  const validated = validatedDocument(document); const serialized = JSON.stringify(validated);
  try {
    const link = await prisma.$transaction(async tx => {
      const page = await tx.builderPage.create({ data: { title: validated.title, slug: validated.slug, draft: serialized, createdBy: author.id, updatedBy: author.id, revisions: { create: { version: 1, document: serialized, action: 'import-landing', authorId: author.id, authorName: author.name } } } });
      return tx.builderLanding.create({ data: { storePageId, builderPageId: page.id, thankYouPageId: await createThankYou(tx, storePageId, storePage.title, author), createdBy: author.id }, select: summary });
    });
    return { link, warnings };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const link = await prisma.builderLanding.findUnique({ where: { storePageId }, select: summary });
      if (link) return { link, warnings: [] as string[] };
    }
    throw error;
  }
}

/** Pair an existing Studio page with a new checkout-backed landing flow. */
export async function connectBuilderPageToLanding(builderPageId: string, author: Author) {
  const existing = await prisma.builderLanding.findUnique({ where: { builderPageId }, select: summary });
  if (existing) return { link: existing };
  const builderPage = await prisma.builderPage.findUnique({ where: { id: builderPageId }, select: { id: true, slug: true, title: true, draft: true } });
  if (!builderPage) throw failure(404, 'Studio page not found');

  const document = validatedDocument(JSON.parse(builderPage.draft));
  const slug = document.slug;
  if (reservedSlugs.has(slug)) throw failure(400, 'This Studio URL is reserved for a storefront feature');
  const storeSlug = `flow-${slug}`;
  const collision = await prisma.storePage.findUnique({ where: { slug: storeSlug }, select: { id: true } });
  if (collision) throw failure(409, 'A checkout landing already uses this URL. Open it from Landing Pages to connect its design.');

  const productIds = new Set<string>();
  const visit = (nodes: BuilderNode[]) => {
    for (const item of nodes) {
      if (item.type === 'form-field' && item.props.inputType === 'hidden' && item.props.fieldName === 'product_id') {
        const value = String(item.props.defaultValue || '');
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) productIds.add(value);
      }
      visit(item.children);
    }
  };
  visit(document.rootNodes);
  const activeProducts = productIds.size ? await prisma.product.findMany({ where: { id: { in: [...productIds] }, status: 'ACTIVE' }, select: { id: true } }) : [];
  const validProductIds = activeProducts.map(product => product.id);

  const checkout = {
    id: randomUUID(), type: 'CHECKOUT', heading: 'অর্ডার করতে, নিচের ফর্মটি পূরণ করুন।',
    productIds: validProductIds, selection: validProductIds.length === 1 ? 'SINGLE' : 'MULTI',
    minProducts: 1, maxProducts: Math.max(1, validProductIds.length), couponEnabled: true,
    paymentMethods: ['COD'], buttonText: 'অর্ডার সম্পূর্ণ করুন',
    style: { background: '#f8fafc', color: '#0f172a', accent: '#0f766e' }
  };
  const link = await prisma.$transaction(async tx => {
    const storePage = await tx.storePage.create({ data: {
      title: builderPage.title, slug: storeSlug, blocks: JSON.stringify([checkout]),
      metaTitle: document.seo.title || builderPage.title, metaDescription: document.seo.description,
      status: 'DRAFT', isActive: false,
    } });
    return tx.builderLanding.create({ data: { storePageId: storePage.id, builderPageId, thankYouPageId: await createThankYou(tx, storePage.id, storePage.title, author), createdBy: author.id }, select: summary });
  });
  return { link };
}

export async function createLandingWithStudio(title: string, slug: string, author: Author) {
  const storeSlug = `flow-${slug}`;
  if (reservedSlugs.has(slug)) throw failure(400, 'This slug is reserved for a storefront feature');
  const pages = await prisma.storePage.findMany({ select: { slug: true, aliases: true } });
  if (pages.some(page => page.slug === slug || page.slug === storeSlug || (JSON.parse(page.aliases || '[]') as string[]).some(alias => alias === slug || alias === storeSlug))) throw failure(409, 'This landing URL is already in use');
  const storePageId = randomUUID();
  const checkout = { id: randomUUID(), type: 'CHECKOUT', heading: 'Complete your order', productIds: [], selection: 'SINGLE', minProducts: 1, maxProducts: 1, couponEnabled: true, paymentMethods: ['COD'], buttonText: 'Place order', style: { background: '#f8fafc', color: '#0f172a', accent: '#0f766e' } };
  const document = emptyDocument(title, `landing-${storePageId}`);
  const hero = createNode('flex'); hero.props.tag = 'section'; hero.styles = { display: 'flex', 'flex-direction': 'column', gap: '24px', padding: 'clamp(40px,8vw,100px)', 'text-align': 'center' };
  const heading = createNode('heading'); heading.props.level = 'h1'; heading.props.text = title;
  const paragraph = createNode('paragraph'); paragraph.props.text = 'Describe the offer and why it matters to your customers.';
  const cta = createNode('button'); cta.props.text = 'Order now'; cta.props.href = '#order';
  hero.children = [heading, paragraph, cta]; document.rootNodes.push(hero);
  const validated = validatedDocument(document); const serialized = JSON.stringify(validated);
  return prisma.$transaction(async tx => {
    const storePage = await tx.storePage.create({ data: { id: storePageId, title, slug: storeSlug, blocks: JSON.stringify([checkout]), status: 'DRAFT', isActive: true, metaTitle: title, metaDescription: '' } });
    const page = await tx.builderPage.create({ data: { title, slug: validated.slug, draft: serialized, createdBy: author.id, updatedBy: author.id, revisions: { create: { version: 1, document: serialized, action: 'create-landing', authorId: author.id, authorName: author.name } } } });
    const link = await tx.builderLanding.create({ data: { storePageId: storePage.id, builderPageId: page.id, thankYouPageId: await createThankYou(tx, storePage.id, title, author), createdBy: author.id }, select: summary });
    return { link };
  });
}

export async function duplicateLandingWithStudio(storePageId: string, title: string, slug: string, author: Author) {
  const source = await prisma.builderLanding.findUnique({ where: { storePageId }, include: { storePage: true, builderPage: true } });
  if (!source || source.storePage.status === 'TRASH') throw failure(404, 'Landing page not found');
  const storeSlug = `flow-${slug}`;
  if (reservedSlugs.has(slug)) throw failure(400, 'This slug is reserved for a storefront feature');
  const pages = await prisma.storePage.findMany({ select: { slug: true, aliases: true } });
  if (pages.some(page => page.slug === slug || page.slug === storeSlug || (JSON.parse(page.aliases || '[]') as string[]).some(alias => alias === slug || alias === storeSlug))) throw failure(409, 'This landing URL is already in use');
  const newId = randomUUID();
  const blocks = JSON.parse(source.storePage.blocks || '[]') as Array<Record<string, unknown>>;
  const document = validatedDocument(JSON.parse(source.builderPage.draft));
  document.title = title; document.slug = `landing-${newId}`;
  document.rootNodes = document.rootNodes.map(cloneNode);
  document.components = Object.fromEntries(Object.entries(document.components).map(([key, component]) => [key, { ...component, nodes: component.nodes.map(cloneNode) }]));
  const serialized = JSON.stringify(validatedDocument(document));
  return prisma.$transaction(async tx => {
    const storePage = await tx.storePage.create({ data: { id: newId, title, slug: storeSlug, eyebrow: source.storePage.eyebrow, excerpt: source.storePage.excerpt, coverImage: source.storePage.coverImage, blocks: JSON.stringify(blocks.map(block => ({ ...block, id: randomUUID() }))), metaTitle: source.storePage.metaTitle, metaDescription: source.storePage.metaDescription, status: 'DRAFT', isActive: false } });
    const page = await tx.builderPage.create({ data: { title, slug: document.slug, draft: serialized, createdBy: author.id, updatedBy: author.id, revisions: { create: { version: 1, document: serialized, action: 'duplicate-landing', authorId: author.id, authorName: author.name } } } });
    const link = await tx.builderLanding.create({ data: { storePageId: storePage.id, builderPageId: page.id, thankYouPageId: await createThankYou(tx, storePage.id, title, author), createdBy: author.id }, select: summary });
    return { link };
  });
}
