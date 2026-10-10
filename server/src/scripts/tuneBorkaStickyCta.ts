import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import prisma from '../prisma';

const pageSlug = 'borka-dubai-cherry';
function tune(raw: string) {
  const document = JSON.parse(raw);
  const index = document.rootNodes.findIndex((node: any) => node.name === 'Floating Mobile Bar');
  if (index < 0) throw new Error(`Could not find the floating CTA in ${pageSlug}`);
  const [bar] = document.rootNodes.splice(index, 1);
  bar.styles = { ...bar.styles, position: 'sticky', top: '0' };
  delete bar.styles.zIndex;
  delete bar.styles.bottom;
  const button = bar.children?.find((node: any) => node.type === 'button');
  if (button) button.props.text = 'এখনই অর্ডার করুন';
  document.rootNodes.unshift(bar);
  return JSON.stringify(document);
}

async function main() {
  const link = await prisma.builderLanding.findFirst({
    where: { storePage: { slug: `flow-${pageSlug}` } },
    include: { builderPage: true },
  });
  if (!link) throw new Error(`Published landing ${pageSlug} was not found`);
  const page = link.builderPage;
  const publishedDocument = page.published;
  if (!publishedDocument) throw new Error(`Published landing ${pageSlug} was not found`);
  const removeTopCta = (raw: string) => {
    const document = JSON.parse(raw);
    const index = document.rootNodes.findIndex((node: any) => node.name === 'Floating Mobile Bar');
    if (index < 0) return raw;
    document.rootNodes.splice(index, 1);
    return JSON.stringify(document);
  };
  const draft = removeTopCta(page.draft);
  const published = removeTopCta(publishedDocument);
  if (draft === page.draft && published === publishedDocument) {
    console.log('Borka top CTA is already removed.');
    return;
  }
  const version = page.version + 1;
  const author = await prisma.user.findUnique({ where: { id: page.updatedBy }, select: { name: true } });
  await prisma.$transaction(async tx => {
    const result = await tx.builderPage.updateMany({
      where: { id: page.id, version: page.version },
      data: { draft, published, version, publishedVersion: version, updatedBy: page.updatedBy },
    });
    if (!result.count) throw new Error('Landing changed during update; reload and retry.');
    await tx.builderRevision.create({ data: {
      id: randomUUID(), pageId: page.id, version, document: published,
      action: 'move-cta-to-top', authorId: page.updatedBy,
      authorName: author?.name || 'Landing update',
    } });
  });
  console.log(`Removed the top CTA bar from ${pageSlug}.`);
}

main().finally(() => prisma.$disconnect()).catch(error => { console.error(error); process.exitCode = 1; });
