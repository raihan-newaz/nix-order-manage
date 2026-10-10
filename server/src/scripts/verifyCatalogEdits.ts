import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import prisma from '../prisma';
import { createProduct, updateProduct } from '../modules/inventory/inventoryController';

async function main() {
  const ids: string[] = [];
  const suffix = randomUUID().slice(0, 8);
  const invoke = async (handler: typeof createProduct, body: unknown, id?: string) => {
    let status = 200; let data: any;
    const response = { status(code: number) { status = code; return this; }, json(value: unknown) { data = value; return this; } };
    await handler({ body, params: { id }, headers: {}, ip: '127.0.0.1' } as any, response as any);
    return { status, data };
  };
  try {
    const first = await invoke(createProduct, { name: 'Temporary catalog regression fixture', slug: `audit-product-${suffix}`, sku: `AUDIT-${suffix}`, barcode: `AUDIT-${suffix}`, status: 'DRAFT', regularPrice: 100, stockQuantity: 7, variants: [] });
    assert.equal(first.status, 201); ids.push(first.data.product.id);
    const second = await invoke(createProduct, { name: 'Temporary variation regression fixture', slug: `audit-variant-${suffix}`, sku: `AUDIT-V-${suffix}`, barcode: `AUDIT-V-${suffix}`, status: 'DRAFT', regularPrice: 100, variants: [{ sku: `AUDIT-V1-${suffix}`, barcode: `AUDIT-V1-${suffix}`, stockQuantity: 5, regularPrice: 100, attributes: { Size: 'M' } }] });
    assert.equal(second.status, 201); ids.push(second.data.product.id);
    const simple = await invoke(updateProduct, { slug: `audit-edited-${suffix}`, stockQuantity: 9, variants: [] }, ids[0]);
    assert.equal(simple.status, 200); assert.equal(simple.data.product.stockQuantity, 9); assert.equal(simple.data.product.slug, `audit-edited-${suffix}`);
    const variant = second.data.product.variants[0];
    const bad = await invoke(updateProduct, { variants: [{ ...variant, stockQuantity: -5 }] }, ids[1]);
    assert.equal(bad.status, 400);
    const collision = await invoke(updateProduct, { slug: `audit-edited-${suffix}`, variants: [{ ...variant, stockQuantity: 99, attributes: { Size: 'M' } }] }, ids[1]);
    assert.equal(collision.status, 409);
    assert.equal((await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).stockQuantity, 5);
    console.log('PASS: editable unique URLs, simple stock retention, negative variant rejection, atomic rollback on URL collision.');
  } finally {
    // Only remove the unpublished fixtures created by this invocation.
    await prisma.auditLog.deleteMany({ where: { entity: 'PRODUCT', entityId: { in: ids } } });
    await prisma.productVariant.deleteMany({ where: { productId: { in: ids } } });
    await prisma.product.deleteMany({ where: { id: { in: ids }, status: 'DRAFT' } });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
