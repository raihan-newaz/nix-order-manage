import prisma from '../../prisma';
import { emptyTheme, parseTheme, type ThemeDocument } from './core/theme';
import { failure, type Author } from './service';

export async function readTheme() {
  const theme = await prisma.builderTheme.findUnique({ where: { id: 'default' } });
  return theme ? { version: theme.version, publishedVersion: theme.publishedVersion, document: parseTheme(JSON.parse(theme.draft)) } : { version: 0, publishedVersion: null, document: emptyTheme() };
}

export async function saveTheme(baseVersion: number, author: Author, action: 'save' | 'publish' | 'restore', input?: unknown, revisionId?: string) {
  return prisma.$transaction(async tx => {
    const current = await tx.builderTheme.findUnique({ where: { id: 'default' } });
    if ((current?.version || 0) !== baseVersion) throw failure(409, 'Theme rules changed. Reload before saving.');
    const validate = (value: unknown) => {
      try { return parseTheme(value); }
      catch (error) { throw failure(400, error instanceof Error ? error.message : 'Invalid theme rules'); }
    };
    let document: ThemeDocument = input === undefined ? current ? validate(JSON.parse(current.draft)) : emptyTheme() : validate(input);
    if (action === 'restore') {
      const revision = await tx.builderThemeRevision.findUnique({ where: { id: revisionId } });
      if (!revision) throw failure(404, 'Theme revision not found');
      document = validate(JSON.parse(revision.document));
    }
    if (action === 'publish' && document.rules.length) {
      const ids = [...new Set(document.rules.map(rule => rule.pageId))];
      const pages = await tx.builderPage.findMany({ where: { id: { in: ids }, published: { not: null } }, select: { id: true } });
      if (pages.length !== ids.length) throw failure(400, 'Publish every referenced header or footer page first.');
    }
    const version = baseVersion + 1;
    const serialized = JSON.stringify(document);
    if (current) {
      const updated = await tx.builderTheme.updateMany({ where: { id: 'default', version: baseVersion }, data: { draft: serialized, version, updatedBy: author.id, ...(action === 'publish' ? { published: serialized, publishedVersion: version } : {}) } });
      if (updated.count !== 1) throw failure(409, 'Theme rules changed. Reload before saving.');
    } else {
      await tx.builderTheme.create({ data: { id: 'default', draft: serialized, version, updatedBy: author.id, ...(action === 'publish' ? { published: serialized, publishedVersion: version } : {}) } });
    }
    await tx.builderThemeRevision.create({ data: { version, document: serialized, action, authorId: author.id, authorName: author.name } });
    return { version, publishedVersion: action === 'publish' ? version : current?.publishedVersion || null, document };
  });
}
