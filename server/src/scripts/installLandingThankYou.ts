import 'dotenv/config';
import prisma from '../prisma';
import { thankYouDocument } from '../modules/builder/thankYouDocument';
import { renderPage } from '../modules/builder/core/renderer';

async function main() {
  const columns = await prisma.$queryRaw<Array<{ Field: string }>>`SHOW COLUMNS FROM BuilderLanding LIKE 'thankYouPageId'`;
  if (!columns.length) await prisma.$executeRaw`ALTER TABLE BuilderLanding ADD COLUMN thankYouPageId VARCHAR(191) NULL, ADD UNIQUE INDEX BuilderLanding_thankYouPageId_key (thankYouPageId), ADD CONSTRAINT BuilderLanding_thankYouPageId_fkey FOREIGN KEY (thankYouPageId) REFERENCES BuilderPage(id) ON DELETE SET NULL ON UPDATE CASCADE`;
  const links = await prisma.builderLanding.findMany({ include: { storePage: true } });
  let updated = 0;
  for (const link of links) {
    if (link.thankYouPageId || !JSON.parse(link.storePage.blocks || '[]').some((block: { type: string }) => block.type === 'CHECKOUT')) continue;
    await prisma.$transaction(async tx => {
      const legacySlug = `${link.storePage.slug}-thank-you`;
      const legacy = await tx.builderPage.findUnique({ where: { slug: legacySlug } });
      const doc = thankYouDocument(link.storePage.title, `thank-you-${link.storePageId}`);
      renderPage(doc);
      const serialized = JSON.stringify(doc);
      const author = { authorId: link.createdBy, authorName: 'Landing migration' };
      let pageId: string;
      if (legacy) {
        // Preserve the old document in revision history before repairing the generated copy.
        const version = legacy.version + 1;
        await tx.builderRevision.upsert({ where: { pageId_version: { pageId: legacy.id, version: legacy.version } }, create: { pageId: legacy.id, version: legacy.version, document: legacy.draft, action: 'before-repair', ...author }, update: {} });
        await tx.builderPage.update({ where: { id: legacy.id }, data: { title: doc.title, slug: doc.slug, publishedSlug: doc.slug, draft: serialized, published: serialized, version, publishedVersion: version, updatedBy: link.createdBy } });
        await tx.builderRevision.create({ data: { pageId: legacy.id, version, document: serialized, action: 'repair-thank-you', ...author } });
        const oldLink = await tx.builderLanding.findUnique({ where: { builderPageId: legacy.id } });
        if (oldLink) {
          await tx.builderLanding.delete({ where: { id: oldLink.id } });
          await tx.storePage.update({ where: { id: oldLink.storePageId }, data: { status: 'TRASH', isActive: false } });
        }
        pageId = legacy.id;
      } else {
        const page = await tx.builderPage.create({ data: { title: doc.title, slug: doc.slug, publishedSlug: doc.slug, draft: serialized, published: serialized, publishedVersion: 1, createdBy: link.createdBy, updatedBy: link.createdBy, revisions: { create: { version: 1, document: serialized, action: 'create-thank-you', ...author } } } });
        pageId = page.id;
      }
      await tx.builderLanding.update({ where: { id: link.id }, data: { thankYouPageId: pageId } });
    });
    updated++;
  }
  console.log(`Thank You pages connected: ${updated}.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
