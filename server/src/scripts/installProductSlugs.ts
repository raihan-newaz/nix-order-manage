import 'dotenv/config';
import prisma from '../prisma';
import { productSlug } from '../modules/inventory/productValidation';

async function main() {
  const columns = await prisma.$queryRaw<Array<{ Field: string }>>`SHOW COLUMNS FROM Product LIKE 'slug'`;
  if (!columns.length) await prisma.$executeRaw`ALTER TABLE Product ADD COLUMN slug VARCHAR(160) NULL, ADD UNIQUE INDEX Product_slug_key (slug)`;
  const products = await prisma.product.findMany({ select: { id: true, name: true, slug: true }, orderBy: { createdAt: 'asc' } });
  const used = new Set(products.flatMap(product => product.slug ? [product.slug.toLowerCase()] : []));
  let updated = 0;
  for (const product of products) {
    if (product.slug) continue;
    const base = productSlug(product.name, product.id);
    let slug = base;
    let suffix = 2;
    while (used.has(slug)) slug = `${base.slice(0, 150)}-${suffix++}`;
    await prisma.product.update({ where: { id: product.id }, data: { slug } });
    used.add(slug); updated++;
  }
  console.log(`Product URL migration complete: ${updated} URLs assigned.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
