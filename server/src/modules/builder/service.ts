import { Prisma } from '@prisma/client';
import prisma from '../../prisma';
import { migrateDocument } from './core/migrations';
import { renderPage } from './core/renderer';
import type { PageDocument } from './core/schema';
import { documentForms } from './core/forms';

export const failure = (status: number, message: string) => Object.assign(new Error(message), { status });
export function validatedDocument(input: unknown): PageDocument {
  try { const doc = migrateDocument(input); renderPage(doc); return doc; }
  catch (error) { throw failure(400, error instanceof Error ? error.message : 'Invalid document'); }
}
export interface Author { id: string; name: string }
export async function saveVersion(id: string, baseVersion: number, author: Author, action: 'save' | 'publish' | 'restore' | 'unpublish', input?: unknown, revisionId?: string) {
  return prisma.$transaction(async tx => {
    const page = await tx.builderPage.findUnique({ where: { id } });
    if (!page) throw failure(404, 'Page not found');
    if (page.version !== baseVersion) throw failure(409, 'Another editor saved a newer version. Export your local changes before reloading.');
    let document = input === undefined ? validatedDocument(JSON.parse(page.draft)) : validatedDocument(input);
    if (action === 'restore') {
      const revision = await tx.builderRevision.findFirst({ where: { id: revisionId, pageId: id } });
      if (!revision) throw failure(404, 'Revision not found');
      document = validatedDocument(JSON.parse(revision.document));
    }
    if (action === 'publish' && await tx.builderLanding.findUnique({ where: { builderPageId: id }, select: { id: true } })) {
      if (documentForms(document).length) throw failure(400, 'Landing designs cannot contain a separate Studio form. Use the existing checkout section.');
      const nodes = [...document.rootNodes, ...Object.values(document.components).flatMap(component => component.nodes)];
      while (nodes.length) {
        const node = nodes.pop()!;
        if (node.attributes.id === 'order' || node.type === 'anchor' && node.props.anchor === 'order') throw failure(400, 'The #order anchor is reserved for the landing checkout.');
        nodes.push(...node.children);
      }
    }
    const serialized = JSON.stringify(document); const version = baseVersion + 1;
    const data: Prisma.BuilderPageUpdateManyMutationInput = { title: document.title, slug: document.slug, draft: serialized, version, updatedBy: author.id };
    if (action === 'publish') Object.assign(data, { published: serialized, publishedVersion: version, publishedSlug: document.slug });
    if (action === 'unpublish') Object.assign(data, { published: null, publishedVersion: null, publishedSlug: null });
    const result = await tx.builderPage.updateMany({ where: { id, version: baseVersion }, data });
    if (result.count !== 1) throw failure(409, 'The document has changed. Reload before saving.');
    await tx.builderRevision.create({ data: { pageId: id, version, document: serialized, action, authorId: author.id, authorName: author.name } });
    return { version, publishedVersion: action === 'publish' ? version : action === 'unpublish' ? null : page.publishedVersion, document };
  });
}
