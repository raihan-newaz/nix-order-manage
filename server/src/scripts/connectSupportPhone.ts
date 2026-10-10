import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import prisma from '../prisma';

const token = '{{site.phone}}';
const phoneIcon = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';

function connect(raw: string) {
  const document = JSON.parse(raw);
  let changed = false;
  const visit = (nodes: any[]): void => {
    for (const node of nodes) {
      if ((node.type === 'button' || node.type === 'link') && node.name === 'Helpline Badge' &&
          (String(node.props?.text || '').includes('01XXXXXXXXX') || String(node.props?.url || '').includes(token))) {
        const next = { ...node.props, text: `${phoneIcon} হেল্পলাইন: ${token}`, icon: '', url: `tel:${token}` };
        if (JSON.stringify(next) !== JSON.stringify(node.props)) { node.props = next; changed = true; }
      } else if ((node.type === 'button' || node.type === 'link') && node.name === 'Call Helpline CTA' &&
                 (node.props?.href === 'tel:01700000000' || node.props?.href === `tel:${token}`)) {
        const next = { ...node.props, href: `tel:${token}`, text: `${phoneIcon} সরাসরি কল করুন`, icon: '' };
        if (JSON.stringify(next) !== JSON.stringify(node.props)) { node.props = next; changed = true; }
      }
      visit(node.children || []);
    }
  };
  visit(document.rootNodes || []);
  return changed ? JSON.stringify(document) : raw;
}

async function main() {
  const pages = await prisma.builderPage.findMany();
  const changes = pages.map(page => ({ page, draft: connect(page.draft), published: page.published ? connect(page.published) : null }))
    .filter(item => item.draft !== item.page.draft || item.published !== item.page.published);
  if (!changes.length) { console.log('Support links already use Storefront Settings.'); return; }
  const backupDir = join(process.cwd(), 'backups');
  mkdirSync(backupDir, { recursive: true });
  const backupPath = join(backupDir, `support-phone-before-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(backupPath, JSON.stringify(changes.map(({ page }) => page), null, 2));
  await prisma.$transaction(async tx => {
    for (const { page, draft, published } of changes) {
      const version = page.version + 1;
      const updated = await tx.builderPage.updateMany({ where: { id: page.id, version: page.version }, data: { draft, published, version, publishedVersion: published ? version : page.publishedVersion } });
      if (!updated.count) throw new Error(`Builder page changed during update: ${page.slug}`);
      await tx.builderRevision.create({ data: { id: randomUUID(), pageId: page.id, version, document: published || draft, action: 'dynamic-support-phone', authorId: page.updatedBy, authorName: 'Support phone update' } });
    }
  }, { timeout: 30000 });
  console.log(`Connected ${changes.length} builder pages to Storefront Settings. Backup: ${backupPath}`);
}

main().finally(() => prisma.$disconnect()).catch(error => { console.error(error); process.exitCode = 1; });
