import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import prisma from '../../prisma';
import { authenticateToken, requireRole, type AuthRequest } from '../../middlewares/auth';
import { builderPermissions, capabilities, readPermissionOverrides, requireBuilder } from './permissions';
import { emptyDocument, type BuilderNode } from './core/schema';
import { renderHtml, renderPage, type RenderResult } from './core/renderer';
import { failure, saveVersion, validatedDocument } from './service';
import { formRenderContext } from './formService';
import submissionRoutes from './submissionRoutes';
import { resolveLoopData } from './dataProviders';
import { documentLoops } from './core/loops';
import { documentForms } from './core/forms';
import { parseTheme, selectThemeRule } from './core/theme';
import { readTheme, saveTheme } from './themeService';
import { connectBuilderPageToLanding, connectLanding, createLandingWithStudio, duplicateLandingWithStudio, findLandingByBuilder, listLandingLinks, readLandingCheckout, saveLandingCheckout, publishLanding, unpublishLanding } from './landingService';

const wrap = (fn: (req: AuthRequest, res: Response) => Promise<void>) => (req: AuthRequest, res: Response, next: NextFunction) => { fn(req, res).catch(next); };
const uuid = (value: unknown) => z.string().uuid().parse(value);
const base = z.object({ baseVersion: z.number().int().positive() });
const router = Router();
router.use(authenticateToken, requireBuilder('access'));
router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
router.get('/capabilities', (_req, res) => { res.json({ permissions: res.locals.builderPermissions }); });
router.get('/context', wrap(async (_req, res) => {
  const settings = await prisma.storefrontSettings.findUnique({ where: { id: 'default' }, select: { storeName: true, phone: true } });
  res.json({ siteName: settings?.storeName || 'NIX', sitePhone: settings?.phone || '' });
}));
router.post('/render-context', wrap(async (req, res) => {
  const payload = z.object({ document: z.unknown() }).strict().parse(req.body);
  const document = validatedDocument(payload.document);
  res.json({ loops: await resolveLoopData(document) });
}));
router.get('/permissions', requireRole(['SUPER_ADMIN']), wrap(async (_req, res) => {
  const users = await prisma.user.findMany({ take: 200, orderBy: { name: 'asc' }, select: { id: true, name: true, role: true, permissions: true, updatedAt: true } });
  res.json({ users: users.map(({ permissions, ...user }) => ({ ...user, effective: builderPermissions(user.role, readPermissionOverrides(permissions)) })) });
}));
router.put('/permissions/:id', requireRole(['SUPER_ADMIN']), wrap(async (req, res) => {
  const payload = z.object({ updatedAt: z.string().datetime(), permissions: z.record(z.enum(capabilities), z.boolean()) }).strict().parse(req.body);
  const id = uuid(req.params.id);
  const result = await prisma.$transaction(async tx => {
    const user = await tx.user.findUnique({ where: { id }, select: { role: true, permissions: true } });
    if (!user) throw failure(404, 'Staff member not found');
    if (user.role === 'SUPER_ADMIN') throw failure(400, 'Super administrators always retain builder access');
    const overrides = readPermissionOverrides(user.permissions);
    for (const key of capabilities) { delete overrides[`builder.${key}`]; if (payload.permissions[key] !== undefined) overrides[`builder.${key}`] = payload.permissions[key]; }
    const changed = await tx.user.updateMany({ where: { id, updatedAt: new Date(payload.updatedAt) }, data: { permissions: JSON.stringify(overrides) } });
    if (changed.count !== 1) throw failure(409, 'This staff member changed. Reload access settings before saving.');
    await tx.auditLog.create({ data: { userId: req.user!.id, userName: req.user!.name, action: 'UPDATE', entity: 'USER', entityId: id, details: JSON.stringify({ builderPermissions: payload.permissions }) } });
    return tx.user.findUniqueOrThrow({ where: { id }, select: { updatedAt: true } });
  });
  res.json(result);
}));
router.get('/pages', wrap(async (_req, res) => {
  const pages = await prisma.builderPage.findMany({ orderBy: { updatedAt: 'desc' }, take: 200, select: { id: true, title: true, slug: true, version: true, publishedVersion: true, publishedSlug: true, updatedAt: true } });
  res.json({ pages });
}));
router.get('/landings', wrap(async (_req, res) => { res.json({ links: await listLandingLinks() }); }));
router.get('/landings/by-builder/:id', wrap(async (req, res) => {
  const link = await findLandingByBuilder(uuid(req.params.id));
  if (!link) throw failure(404, 'This Studio page is not a landing design');
  res.json({ link });
}));
router.get('/landings/by-builder/:id/checkout', wrap(async (req, res) => {
  res.json(await readLandingCheckout(uuid(req.params.id)));
}));
router.put('/landings/by-builder/:id/checkout', requireBuilder('edit'), requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER']), wrap(async (req, res) => {
  res.json(await saveLandingCheckout(uuid(req.params.id), req.body));
}));
router.post('/landings/from-builder/:id', requireBuilder('edit'), requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER']), wrap(async (req, res) => {
  res.status(201).json(await connectBuilderPageToLanding(uuid(req.params.id), req.user!));
}));
router.post('/landings', requireBuilder('edit'), requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER']), wrap(async (req, res) => {
  const payload = z.object({ title: z.string().trim().min(2).max(120), slug: z.string().regex(/^[\p{L}\p{N}\p{M}]+(?:-[\p{L}\p{N}\p{M}]+)*$/u).min(2).max(90) }).strict().parse(req.body);
  res.status(201).json(await createLandingWithStudio(payload.title, payload.slug, req.user!));
}));
router.post('/landings/:id/connect', requireBuilder('edit'), requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER']), wrap(async (req, res) => {
  res.json(await connectLanding(uuid(req.params.id), req.user!));
}));
router.post('/landings/:id/duplicate', requireBuilder('edit'), requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER']), wrap(async (req, res) => {
  const payload = z.object({ title: z.string().trim().min(2).max(120), slug: z.string().regex(/^[\p{L}\p{N}\p{M}]+(?:-[\p{L}\p{N}\p{M}]+)*$/u).min(2).max(90) }).strict().parse(req.body);
  res.status(201).json(await duplicateLandingWithStudio(uuid(req.params.id), payload.title, payload.slug, req.user!));
}));
router.get('/theme', wrap(async (_req, res) => { res.json(await readTheme()); }));
router.put('/theme/draft', requireBuilder('edit'), wrap(async (req, res) => {
  const payload = z.object({ baseVersion: z.number().int().min(0), document: z.unknown() }).strict().parse(req.body);
  res.json(await saveTheme(payload.baseVersion, req.user!, 'save', payload.document));
}));
router.post('/theme/publish', requireBuilder('publish'), wrap(async (req, res) => {
  const payload = z.object({ baseVersion: z.number().int().min(0) }).strict().parse(req.body);
  res.json(await saveTheme(payload.baseVersion, req.user!, 'publish'));
}));
router.get('/theme/revisions', wrap(async (_req, res) => {
  res.json({ revisions: await prisma.builderThemeRevision.findMany({ orderBy: { version: 'desc' }, take: 100, select: { id: true, version: true, action: true, authorName: true, createdAt: true } }) });
}));
router.post('/theme/restore', requireBuilder('edit'), wrap(async (req, res) => {
  const payload = z.object({ baseVersion: z.number().int().min(0), revisionId: z.string().uuid() }).strict().parse(req.body);
  res.json(await saveTheme(payload.baseVersion, req.user!, 'restore', undefined, payload.revisionId));
}));
router.get('/theme/preview/:id', wrap(async (req, res) => {
  const page = await prisma.builderPage.findUnique({ where: { id: uuid(req.params.id) }, select: { draft: true } });
  if (!page) throw failure(404, 'Page not found');
  const doc = validatedDocument(JSON.parse(page.draft));
  const theme = (await readTheme()).document;
  const path = `/b/${doc.slug}`;
  const rules = (['header', 'footer'] as const).map(area => selectThemeRule(theme, area, path));
  const templateIds = [...new Set(rules.filter(rule => rule).map(rule => rule!.pageId))];
  const templates = templateIds.length ? await prisma.builderPage.findMany({ where: { id: { in: templateIds } }, select: { id: true, draft: true } }) : [];
  const byId = new Map(templates.map(item => [item.id, item]));
  const settings = await prisma.storefrontSettings.findUnique({ where: { id: 'default' }, select: { storeName: true, phone: true } });
  const fragments: Partial<Record<'header' | 'footer', Pick<RenderResult, 'html' | 'css'>>> = {};
  for (const rule of rules) {
    if (!rule) continue;
    const template = byId.get(rule.pageId);
    if (!template) continue;
    const templateDoc = validatedDocument(JSON.parse(template.draft));
    fragments[rule.area] = renderPage(templateDoc, { region: rule.area, editor: true, siteName: settings?.storeName, sitePhone: settings?.phone, loops: await resolveLoopData(templateDoc) });
  }
  htmlHeaders(res); res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.type('html').send(renderHtml(doc, { editor: true, siteName: settings?.storeName, sitePhone: settings?.phone, loops: await resolveLoopData(doc), header: fragments.header, footer: fragments.footer }));
}));
router.post('/pages', requireBuilder('edit'), wrap(async (req, res) => {
  const payload = z.object({ title: z.string().trim().min(1).max(120), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120) }).strict().parse(req.body);
  const document = emptyDocument(payload.title, payload.slug);
  const page = await prisma.builderPage.create({ data: { ...payload, draft: JSON.stringify(document), createdBy: req.user!.id, updatedBy: req.user!.id, revisions: { create: { version: 1, document: JSON.stringify(document), action: 'create', authorId: req.user!.id, authorName: req.user!.name } } } });
  res.status(201).json({ id: page.id, version: page.version, document });
}));
router.get('/pages/:id', wrap(async (req, res) => {
  const page = await prisma.builderPage.findUnique({ where: { id: uuid(req.params.id) } });
  if (!page) throw failure(404, 'Page not found');
  res.json({ id: page.id, version: page.version, publishedVersion: page.publishedVersion, publishedSlug: page.publishedSlug, document: validatedDocument(JSON.parse(page.draft)) });
}));
router.put('/pages/:id/draft', requireBuilder('edit'), wrap(async (req, res) => {
  const payload = base.extend({ document: z.unknown() }).strict().parse(req.body);
  if (!payload.document) throw failure(400, 'Document is required');
  res.json(await saveVersion(uuid(req.params.id), payload.baseVersion, req.user!, 'save', payload.document));
}));
for (const action of ['publish', 'unpublish'] as const) router.post(`/pages/:id/${action}`, requireBuilder('publish'), wrap(async (req, res) => {
  const payload = base.strict().parse(req.body);
  const id = uuid(req.params.id);
  const linked = await prisma.builderLanding.findUnique({ where: { builderPageId: id }, select: { id: true } });
  if (linked) {
    if (!['SUPER_ADMIN', 'OPERATIONS_MANAGER'].includes(req.user!.role)) throw failure(403, 'You cannot publish landing checkout pages');
    res.json(action === 'publish' ? await publishLanding(id, payload.baseVersion, req.user!) : await unpublishLanding(id, payload.baseVersion, req.user!));
    return;
  }
  res.json(await saveVersion(id, payload.baseVersion, req.user!, action));
}));
router.delete('/pages/:id', requireBuilder('edit'), wrap(async (req, res) => {
  const id = uuid(req.params.id);
  if (await prisma.builderLanding.findFirst({ where: { OR: [{ builderPageId: id }, { thankYouPageId: id }] }, select: { id: true } })) throw failure(409, 'This landing is linked to a public checkout. Manage its publication in Studio; deleting only its design would leave the landing incomplete.');
  await prisma.builderRevision.deleteMany({ where: { pageId: id } });
  await prisma.builderPage.delete({ where: { id } });
  res.sendStatus(204);
}));
router.get('/pages/:id/revisions', wrap(async (req, res) => {
  const revisions = await prisma.builderRevision.findMany({ where: { pageId: uuid(req.params.id) }, orderBy: { version: 'desc' }, take: 100, select: { id: true, version: true, action: true, authorName: true, createdAt: true } });
  res.json({ revisions });
}));
router.post('/pages/:id/restore', requireBuilder('edit'), wrap(async (req, res) => {
  const payload = base.extend({ revisionId: z.string().uuid() }).strict().parse(req.body);
  res.json(await saveVersion(uuid(req.params.id), payload.baseVersion, req.user!, 'restore', undefined, payload.revisionId));
}));
router.get('/pages/:id/preview', wrap(async (req, res) => {
  const page = await prisma.builderPage.findUnique({ where: { id: uuid(req.params.id) } });
  if (!page) throw failure(404, 'Page not found');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow'); htmlHeaders(res);
  const doc = validatedDocument(JSON.parse(page.draft)); doc.seo.noindex = true;
  const settings = await prisma.storefrontSettings.findUnique({ where: { id: 'default' }, select: { storeName: true, phone: true } });
  res.type('html').send(renderHtml(doc, { siteName: settings?.storeName, sitePhone: settings?.phone, loops: await resolveLoopData(doc) }));
}));
router.get('/templates', wrap(async (_req, res) => {
  res.json({ templates: await prisma.builderTemplate.findMany({ orderBy: { updatedAt: 'desc' }, take: 200, select: { id: true, name: true, updatedAt: true } }) });
}));
router.get('/templates/:id', wrap(async (req, res) => {
  const template = await prisma.builderTemplate.findUnique({ where: { id: uuid(req.params.id) } });
  if (!template) throw failure(404, 'Template not found');
  res.json({ document: validatedDocument(JSON.parse(template.document)) });
}));
router.post('/templates', requireBuilder('templates'), wrap(async (req, res) => {
  const payload = z.object({ name: z.string().trim().min(1).max(120), document: z.unknown() }).strict().parse(req.body);
  const document = validatedDocument(payload.document);
  const template = await prisma.builderTemplate.create({ data: { name: payload.name, document: JSON.stringify(document), createdBy: req.user!.id } });
  res.status(201).json({ id: template.id, name: template.name });
}));
router.delete('/templates/:id', requireBuilder('templates'), wrap(async (req, res) => {
  await prisma.builderTemplate.delete({ where: { id: uuid(req.params.id) } }); res.sendStatus(204);
}));
router.use(submissionRoutes);
router.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (error instanceof z.ZodError) { res.status(400).json({ message: 'Invalid builder request', errors: error.issues }); return; }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') { res.status(409).json({ message: 'This URL is already used by another page' }); return; }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') { res.status(404).json({ message: 'Resource not found' }); return; }
  if (error instanceof Error && 'status' in error && typeof error.status === 'number' && error.status >= 400 && error.status < 500) { res.status(error.status).json({ message: error.message }); return; }
  next(error);
});
export default router;

export function htmlHeaders(res: Response) {
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' https: http:; media-src 'self' https: http:; script-src 'self'; style-src 'unsafe-inline'; font-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'");
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
}
const publicCache = new Map<string, string>();
export const publicBuilderPage = wrap(async (req, res) => {
  const slug = z.string().max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).safeParse(req.params.slug);
  if (!slug.success) { res.sendStatus(404); return; }
  const page = await prisma.builderPage.findUnique({ where: { publishedSlug: slug.data }, select: { id: true, published: true, publishedVersion: true, landingLink: { select: { id: true } } } });
  if (!page?.published || page.landingLink) { res.status(404).type('text').send('Page not found'); return; }
  const settings = await prisma.storefrontSettings.findUnique({ where: { id: 'default' }, select: { storeName: true, phone: true, updatedAt: true } });
  const document = validatedDocument(JSON.parse(page.published));
  const theme = await prisma.builderTheme.findUnique({ where: { id: 'default' }, select: { published: true, publishedVersion: true } });
  const path = `/b/${slug.data}`;
  const publishedTheme = theme?.published ? parseTheme(JSON.parse(theme.published)) : null;
  const rules = publishedTheme ? (['header', 'footer'] as const).map(area => selectThemeRule(publishedTheme, area, path)) : [];
  const referencedIds = [...new Set(rules.filter(rule => rule).map(rule => rule!.pageId))];
  const referenced = referencedIds.length ? await prisma.builderPage.findMany({ where: { id: { in: referencedIds }, published: { not: null } }, select: { id: true, published: true, publishedVersion: true } }) : [];
  const byId = new Map(referenced.map(item => [item.id, item]));
  const fragments: Partial<Record<'header' | 'footer', { result: Pick<RenderResult, 'html' | 'css'>; dynamic: boolean }>> = {};
  for (const rule of rules) {
    if (!rule) continue;
    const template = byId.get(rule.pageId);
    if (!template?.published) continue;
    const templateDocument = validatedDocument(JSON.parse(template.published));
    const templateForms = formRenderContext(req, res, template.id, template.publishedVersion!, templateDocument);
    const loops = documentLoops(templateDocument);
    fragments[rule.area] = { result: renderPage(templateDocument, { region: rule.area, siteName: settings?.storeName, sitePhone: settings?.phone, forms: templateForms, loops: loops.length ? await resolveLoopData(templateDocument) : undefined }), dynamic: Boolean(templateForms || loops.length) };
  }
  const forms = formRenderContext(req, res, page.id, page.publishedVersion!, document);
  if (forms || documentLoops(document).length || fragments.header?.dynamic || fragments.footer?.dynamic) {
    htmlHeaders(res); res.setHeader('Cache-Control', 'private, no-store');
    res.type('html').send(renderHtml(document, { siteName: settings?.storeName, sitePhone: settings?.phone, forms, loops: await resolveLoopData(document), header: fragments.header?.result, footer: fragments.footer?.result })); return;
  }
  const key = `${page.id}:${page.publishedVersion}:${settings?.updatedAt.toISOString()}:${new Date().getFullYear()}:${theme?.publishedVersion}:${referenced.map(item => `${item.id}:${item.publishedVersion}`).join(',')}`;
  let html = publicCache.get(key);
  if (!html) {
    html = renderHtml(document, { siteName: settings?.storeName, sitePhone: settings?.phone, header: fragments.header?.result, footer: fragments.footer?.result });
    if (publicCache.size >= 100) publicCache.delete(publicCache.keys().next().value!);
    publicCache.set(key, html);
  }
  htmlHeaders(res); res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  res.setHeader('ETag', `"${createHash('sha256').update(html).digest('hex')}"`);
  res.type('html').send(html);
});

const landingDesignCache = new Map<string, { html: string; css: string; footerHtml?: string; footerCss?: string; version: number | null }>();
export const publicLandingDesign = wrap(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const slug = z.string().regex(/^flow-[\p{L}\p{N}\p{M}]+(?:-[\p{L}\p{N}\p{M}]+)*$/u).max(120).safeParse(req.params.slug);
  if (!slug.success) { res.sendStatus(404); return; }
  const storePage = await prisma.storePage.findUnique({ where: { slug: slug.data }, select: { id: true, status: true, isActive: true, builderLink: { select: { builderPage: { select: { published: true, publishedVersion: true } }, thankYouPage: { select: { published: true, publishedVersion: true } } } } } });
  const thankYou = req.query.view === 'thank-you';
  const published = thankYou ? storePage?.builderLink?.thankYouPage : storePage?.builderLink?.builderPage;
  if (storePage?.status !== 'PUBLISHED' || !storePage.isActive || !published?.published) { res.sendStatus(404); return; }
  const settings = await prisma.storefrontSettings.findUnique({ where: { id: 'default' }, select: { storeName: true, phone: true } });
  const cacheKey = `${storePage.id}:${thankYou ? "thank-you" : "landing"}:${published.publishedVersion}:${settings?.storeName || ''}:${settings?.phone || ''}`;
  const cached = landingDesignCache.get(cacheKey);
  if (cached) { res.json(cached); return; }
  const document = validatedDocument(JSON.parse(published.published));
  if (thankYou) {
    const rendered = renderPage(document, { region: 'landing', siteName: settings?.storeName, sitePhone: settings?.phone, loops: await resolveLoopData(document) });
    res.json({ html: rendered.html, css: rendered.css, version: published.publishedVersion }); return;
  }
  const isFooter = (node: BuilderNode) => node.props.tag === 'footer' || /footer/i.test(node.name || '');
  const footerDoc = { ...document, rootNodes: document.rootNodes.filter(isFooter) };
  const removeForms = (nodes: BuilderNode[]): BuilderNode[] => nodes
    .filter(node => !['form', 'form-field', 'form-submit'].includes(node.type))
    .map(node => ({ ...node, children: removeForms(node.children) }));
  const containsForm = (node: BuilderNode): boolean => ['form', 'form-field', 'form-submit'].includes(node.type) || node.children.some(containsForm);
  document.rootNodes = removeForms(document.rootNodes.filter(node => {
    const name = node.name || '';
    return !isFooter(node) && !(containsForm(node) && /(?:order|checkout).*(?:form|section)|(?:form|section).*(?:order|checkout)/i.test(name));
  }));
  if (documentForms(document).length) throw failure(500, 'Invalid published landing design');
  const loops = documentLoops(document);
  const rendered = renderPage(document, { region: 'landing', siteName: settings?.storeName, sitePhone: settings?.phone, loops: loops.length ? await resolveLoopData(document) : undefined });
  const footer = footerDoc.rootNodes.length ? renderPage(footerDoc, { region: 'footer', siteName: settings?.storeName, sitePhone: settings?.phone, loops: await resolveLoopData(footerDoc) }) : null;
  const result = { html: rendered.html, css: rendered.css, footerHtml: footer?.html, footerCss: footer?.css, version: published.publishedVersion };
  if (!loops.length) {
    if (landingDesignCache.size >= 100) landingDesignCache.delete(landingDesignCache.keys().next().value!);
    landingDesignCache.set(cacheKey, result);
  }
  res.json(result);
});
