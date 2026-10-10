import { z } from 'zod';

export const productSlug = (name: string, fallback = 'product') => name.trim().normalize('NFKC').toLowerCase()
  .replace(/[^\p{L}\p{N}\p{M}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 160).replace(/-$/g, '') || fallback;

export const productSlugSchema = z.string().trim().toLowerCase().min(1).max(160)
  .regex(/^[\p{L}\p{N}\p{M}]+(?:-[\p{L}\p{N}\p{M}]+)*$/u, 'Use letters, numbers and hyphens for the product URL');

const amount = z.number().finite().min(0).max(100000000);
const stock = z.number().int().min(0).max(2147483647);
const numericFields = z.object({
  buyPrice: amount.optional(), regularPrice: amount.optional(), salePrice: amount.optional(),
  stockQuantity: stock.optional(), minStockThreshold: stock.optional(),
}).passthrough();

export const productInputSchema = numericFields.extend({
  name: z.string().trim().min(1).max(191).optional(),
  slug: productSlugSchema.optional(),
  variants: z.array(numericFields.extend({
    id: z.string().uuid().optional(),
    status: z.enum(['ACTIVE', 'OUT_OF_STOCK', 'DRAFT']).optional(),
  })).max(500).optional(),
}).superRefine((input, ctx) => {
  const ids = (input.variants || []).flatMap(variant => variant.id ? [variant.id] : []);
  if (ids.length !== new Set(ids).size) ctx.addIssue({ code: 'custom', message: 'A variation cannot be submitted twice', path: ['variants'] });
});
