import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import prisma from '../prisma';

const personalNameHint = 'নাম লিখুন (যেমন: রাবেয়া আক্তার)';
const banglaDigits = (value: unknown) => String(value ?? '').replace(/^[৳\s]+/, '').replace(/[0-9]/g, digit => '০১২৩৪৫৬৭৮৯'[Number(digit)]);

function updateOffer(raw: string) {
  const document = JSON.parse(raw);
  let changed = false;
  const visit = (value: any): void => {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!value || typeof value !== 'object') return;
    if (value.type === 'offer-price') {
      const props = value.props || {};
      const next = {
        ...props,
        regularLabel: 'রেগুলার মূল্য',
        regularPrice: banglaDigits(props.regularPrice),
        currencyLabel: 'টাকা',
        offerLabel: 'অফার মূল্য মাত্র',
        offerPrice: banglaDigits(props.offerPrice),
        discount: '',
        highlight: '',
        animationStyle: 'cross',
        animationDuration: 3.6,
        strikeColor: '#ff1717',
        saleColor: '#22c33e',
      };
      if (JSON.stringify(props) !== JSON.stringify(next)) { value.props = next; changed = true; }
    }
    Object.values(value).forEach(visit);
  };
  visit(document.rootNodes);
  return changed ? JSON.stringify(document) : raw;
}

function updateCheckout(raw: string) {
  const blocks = JSON.parse(raw);
  let changed = false;
  for (const block of blocks) {
    if (block.type === 'CHECKOUT' && block.namePlaceholder === personalNameHint) {
      block.namePlaceholder = 'নাম লিখুন';
      changed = true;
    }
  }
  return changed ? JSON.stringify(blocks) : raw;
}

async function main() {
  const links = await prisma.builderLanding.findMany({ include: { builderPage: true, storePage: { include: { checkoutDraft: true } } } });
  const changes = links.map(link => {
    const builder = link.builderPage;
    const store = link.storePage;
    return {
      builder, store,
      draft: updateOffer(builder.draft),
      published: builder.published ? updateOffer(builder.published) : null,
      blocks: updateCheckout(store.blocks),
      checkoutDraft: store.checkoutDraft ? updateCheckout(store.checkoutDraft.blocks) : undefined,
    };
  }).filter(item => item.draft !== item.builder.draft || item.published !== item.builder.published || item.blocks !== item.store.blocks || item.checkoutDraft !== item.store.checkoutDraft?.blocks);
  if (!changes.length) { console.log('Landing presentation is already current.'); return; }

  const backupDir = join(process.cwd(), 'backups');
  mkdirSync(backupDir, { recursive: true });
  const backupPath = join(backupDir, `landing-offer-before-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(backupPath, JSON.stringify(changes.map(({ builder, store }) => ({ builder, store })), null, 2));
  await prisma.$transaction(async tx => {
    for (const item of changes) {
      const { builder, store, draft, published, blocks, checkoutDraft } = item;
      if (draft !== builder.draft || published !== builder.published) {
        const version = builder.version + 1;
        const result = await tx.builderPage.updateMany({ where: { id: builder.id, version: builder.version }, data: { draft, published, version, publishedVersion: published ? version : builder.publishedVersion } });
        if (!result.count) throw new Error(`Builder changed during update: ${builder.slug}`);
        await tx.builderRevision.create({ data: { id: randomUUID(), pageId: builder.id, version, document: published || draft, action: 'offer-presentation', authorId: builder.updatedBy, authorName: 'Landing presentation update' } });
      }
      if (blocks !== store.blocks) await tx.storePage.update({ where: { id: store.id }, data: { blocks } });
      if (store.checkoutDraft && checkoutDraft !== store.checkoutDraft.blocks && checkoutDraft) {
        await tx.landingCheckoutDraft.update({ where: { storePageId: store.id }, data: { blocks: checkoutDraft, version: { increment: 1 } } });
      }
    }
  });
  console.log(`Updated ${changes.length} landing pages. Backup: ${backupPath}`);
}

main().finally(() => prisma.$disconnect()).catch(error => { console.error(error); process.exitCode = 1; });
