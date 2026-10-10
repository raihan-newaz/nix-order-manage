import { Prisma } from '@prisma/client';
import sanitizeHtml from 'sanitize-html';
import prisma from '../../prisma';
import { config } from '../../config';
import { documentLoops, type LoopData, type LoopItem, type LoopQuery } from './core/loops';
import type { PageDocument } from './core/schema';

export interface DataProvider { id: LoopQuery['provider']; resolve: (query: LoopQuery) => Promise<LoopItem[]> }
const providers = new Map<string, DataProvider>();
export function registerDataProvider(provider: DataProvider) {
  if (providers.has(provider.id)) throw new Error('Duplicate data provider');
  providers.set(provider.id, provider);
}
const plainText = (value: string | null) => sanitizeHtml(value || '', { allowedTags: [], allowedAttributes: {} }).slice(0, 500);
registerDataProvider({ id: 'products', resolve: async query => {
  const orderBy: Prisma.ProductOrderByWithRelationInput = query.sort === 'title' ? { name: 'asc' } : { createdAt: query.sort === 'oldest' ? 'asc' : 'desc' };
  const products = await prisma.product.findMany({ where: { status: 'ACTIVE', ...(query.category ? { category: query.category } : {}), ...(query.search ? { name: { contains: query.search } } : {}) }, orderBy: [orderBy, { id: 'asc' }], take: query.limit, select: { id: true, name: true, description: true, image: true, regularPrice: true, salePrice: true, sku: true, category: true } });
  return products.map(product => ({ title: product.name, excerpt: plainText(product.description), image: product.image || '', url: `${config.builderStorefrontOrigin}/product/${encodeURIComponent(product.id)}`, price: `৳${(product.salePrice > 0 ? product.salePrice : product.regularPrice).toLocaleString('en-BD', { maximumFractionDigits: 2 })}`, sku: product.sku, category: product.category || '' }));
} });
registerDataProvider({ id: 'pages', resolve: async query => {
  const orderBy: Prisma.StorePageOrderByWithRelationInput = query.sort === 'title' ? { title: 'asc' } : { createdAt: query.sort === 'oldest' ? 'asc' : 'desc' };
  const pages = await prisma.storePage.findMany({ where: { status: 'PUBLISHED', isActive: true, ...(query.search ? { title: { contains: query.search } } : {}) }, orderBy: [orderBy, { id: 'asc' }], take: query.limit, select: { title: true, slug: true, excerpt: true, coverImage: true } });
  return pages.map(page => ({ title: page.title, excerpt: plainText(page.excerpt), image: page.coverImage || '', url: `${config.builderStorefrontOrigin}/${encodeURIComponent(page.slug.startsWith('flow-') ? page.slug.slice(5) : page.slug)}`, price: '', sku: '', category: '' }));
} });
export async function resolveLoopData(doc: PageDocument): Promise<LoopData> {
  const queries = documentLoops(doc); const result: LoopData = {};
  // At most five bounded queries. No user-supplied SQL, relations or selected fields.
  await Promise.all(queries.map(async ({ id, query }) => {
    const provider = providers.get(query.provider); if (!provider) throw new Error('Data provider is unavailable');
    result[id] = await provider.resolve(query);
  }));
  return result;
}
