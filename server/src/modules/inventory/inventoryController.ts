import { randomUUID } from 'node:crypto';
import { Request, Response } from 'express';
import prisma from '../../prisma';
import { AuthRequest } from '../../middlewares/auth';
import { logAudit } from '../audit/auditService';
import { productInputSchema, productSlug } from './productValidation';

const asJson = (value: unknown): string | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  return typeof value === 'string' ? value : JSON.stringify(value);
};

const variationAttributes = (variant: any) => {
  if (variant.attributes && typeof variant.attributes === 'object') return variant.attributes;
  return {
    ...(variant.color ? { Color: String(variant.color).trim() } : {}),
    ...(variant.size ? { Size: String(variant.size).trim() } : {}),
  };
};

const variationKey = (variant: any) =>
  Object.entries(variationAttributes(variant))
    .map(([key, value]) => `${key.trim().toLowerCase()}:${String(value).trim().toLowerCase()}`)
    .sort()
    .join('|');

const assertUniqueVariations = (variants: any[]) => {
  const seenSkus = new Set<string>();
  const seenCombinations = new Set<string>();
  for (const variant of variants) {
    const sku = String(variant.sku || '').trim().toLowerCase();
    const combination = variationKey(variant);
    if (sku && seenSkus.has(sku)) throw new Error(`Duplicate variation SKU: ${variant.sku}`);
    if (combination && seenCombinations.has(combination)) throw new Error('Each attribute combination can only be created once');
    if (sku) seenSkus.add(sku);
    if (combination) seenCombinations.add(combination);
  }
};

const isNonNegativeNumber = (value: unknown) => Number.isFinite(Number(value)) && Number(value) >= 0;
const allowedProductStatuses = new Set(['ACTIVE', 'DRAFT', 'OUT_OF_STOCK']);

export const listProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, category, status, lowStock, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(parseInt(String(page), 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(String(limit), 10) || 20, 1), 100);

    const where: any = { status: { not: 'ARCHIVED' } };
    if (category) {
      where.category = category as string;
    }
    if (status && allowedProductStatuses.has(String(status))) {
      where.status = String(status);
    }
    if (String(status || '') === 'ARCHIVED') where.status = 'ARCHIVED';
    if (search) {
      const q = String(search).trim();
      where.OR = [
        { name: { contains: q } },
        { sku: { contains: q } },
        { barcode: { contains: q } },
        {
          variants: {
            some: {
              OR: [
                { sku: { contains: q } },
                { color: { contains: q } },
                { size: { contains: q } },
              ],
            },
          },
        },
      ];
    }
    // Low-stock filtering involves variation thresholds, so it is applied after
    // loading the matching catalogue. Normal catalogue browsing stays paginated
    // at the database level.
    const catalog = await prisma.product.findMany({
      where,
      include: {
        variants: {
          orderBy: [{ color: 'asc' }, { size: 'asc' }],
        },
      },
      orderBy: { createdAt: 'desc' },
      ...(lowStock === 'true' ? {} : { skip: (pageNum - 1) * limitNum, take: limitNum }),
    });

    const filteredProducts = lowStock === 'true'
      ? catalog.filter((product) =>
          product.stockQuantity <= product.minStockThreshold ||
          product.variants.some((variant) =>
            variant.status !== 'ARCHIVED' && variant.stockQuantity <= variant.minStockThreshold,
          ),
        )
      : catalog;

    const total = lowStock === 'true'
      ? filteredProducts.length
      : await prisma.product.count({ where });
    const products = lowStock === 'true'
      ? filteredProducts.slice((pageNum - 1) * limitNum, pageNum * limitNum)
      : filteredProducts;

    res.json({
      success: true,
      products,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.max(1, Math.ceil(total / limitNum)) },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const bulkUpdateProducts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { productIds, action } = req.body;
    if (!Array.isArray(productIds) || productIds.length < 1 || productIds.length > 100) {
      res.status(400).json({ success: false, message: 'Select between 1 and 100 products' });
      return;
    }

    const statusByAction: Record<string, string> = {
      ACTIVATE: 'ACTIVE',
      DRAFT: 'DRAFT',
      OUT_OF_STOCK: 'OUT_OF_STOCK',
      ARCHIVE: 'ARCHIVED',
    };
    if (!statusByAction[action]) {
      res.status(400).json({ success: false, message: 'Invalid bulk product action' });
      return;
    }

    const ids = [...new Set(productIds.map(String))];
    const result = await prisma.product.updateMany({
      where: { id: { in: ids }, status: { not: 'ARCHIVED' } },
      data: { status: statusByAction[action] },
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name,
      action: action === 'ARCHIVE' ? 'DELETE' : 'UPDATE',
      entity: 'PRODUCT',
      entityId: ids.join(','),
      details: { bulk: true, action, requested: ids.length, updated: result.count },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    res.json({ success: true, message: `${result.count} product${result.count === 1 ? '' : 's'} updated`, count: result.count });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getProductById = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: String(req.params.id) },
      include: {
        variants: { orderBy: [{ color: 'asc' }, { size: 'asc' }, { createdAt: 'asc' }] },
      },
    });
    if (!product || product.status === 'ARCHIVED') {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }
    res.json({ success: true, product });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const input = productInputSchema.safeParse(req.body);
    if (!input.success) { res.status(400).json({ success: false, message: input.error.issues[0]?.message || 'Invalid product data' }); return; }
    req.body = input.data;
    const {
      name,
      slug,
      sku,
      barcode,
      description,
      category = 'Fashion',
      buyPrice = 0,
      regularPrice = 0,
      salePrice = 0,
      stockQuantity = 0,
      minStockThreshold = 5,
      image,
      gallery,
      metaTitle,
      metaDescription,
      status = 'DRAFT',
      variants = [],
      attributes,
    } = req.body;

    if (!name) {
      res.status(400).json({ success: false, message: 'Product name is required' });
      return;
    }
    if (![buyPrice, regularPrice, salePrice, stockQuantity, minStockThreshold].every(isNonNegativeNumber)) { res.status(400).json({ success: false, message: 'Prices and stock values must be valid non-negative numbers' }); return; }
    if (!allowedProductStatuses.has(status)) { res.status(400).json({ success: false, message: 'Invalid product status' }); return; }

    const generatedSku = sku || `NX-FSH-${Date.now().toString().slice(-6)}`;
    const generatedBarcode = barcode || `880${Date.now().toString().slice(-9)}`;
    const isVariableProduct = Array.isArray(variants) && variants.length > 0;
    if (isVariableProduct) assertUniqueVariations(variants);

    // If variants are provided, calculate total stock as sum of variants
    let totalStock = Number(stockQuantity);
    if (isVariableProduct) {
      totalStock = variants.reduce((sum: number, v: any) => sum + (Number(v.stockQuantity) || 0), 0);
    }

    const product = await prisma.product.create({
      data: {
        name,
        slug: slug || `${productSlug(name).slice(0, 120)}-${randomUUID().slice(0, 8)}`,
        sku: generatedSku,
        barcode: generatedBarcode,
        description,
        category,
        buyPrice: Number(buyPrice),
        regularPrice: Number(regularPrice),
        salePrice: Number(salePrice || regularPrice),
        stockQuantity: totalStock,
        minStockThreshold: Number(minStockThreshold),
        image,
        gallery: asJson(gallery),
        metaTitle,
        metaDescription,
        status,
        productType: isVariableProduct ? 'VARIABLE' : 'SIMPLE',
        attributes: asJson(attributes),
        variants:
          isVariableProduct
            ? {
                create: variants.map((v: any, idx: number) => {
                  const colorStr = v.color ? String(v.color).trim() : '';
                  const sizeStr = v.size ? String(v.size).trim() : '';
                  const attributes = variationAttributes(v);
                  const colorCode = colorStr ? colorStr.slice(0, 3).toUpperCase() : 'DEF';
                  const attributeCode = Object.values(attributes).map((value) => String(value).replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase()).filter(Boolean).join('-');
                  const sizeCode = sizeStr ? sizeStr.toUpperCase() : attributeCode || `V${idx + 1}`;
                  const vSku = v.sku || `${generatedSku}-${colorCode}-${sizeCode}-${idx + 1}`;
                  const vName = `${name} — ${Object.values(attributes).join(' / ')}`;

                  return {
                    name: vName,
                    sku: vSku,
                    barcode: v.barcode || `880${Date.now().toString().slice(-8)}${idx}`,
                    color: colorStr || undefined,
                    size: sizeStr || undefined,
                    attributes: asJson(attributes),
                    buyPrice: Number(v.buyPrice || buyPrice),
                    regularPrice: Number(v.regularPrice || regularPrice),
                    salePrice: Number(v.salePrice || salePrice || regularPrice),
                    stockQuantity: Number(v.stockQuantity || 0),
                    minStockThreshold: Number(v.minStockThreshold ?? 3),
                    image: v.image || undefined,
                    status: v.status || 'ACTIVE',
                  };
                }),
              }
            : undefined,
      },
      include: { variants: true },
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name,
      action: 'CREATE',
      entity: 'PRODUCT',
      entityId: product.id,
      details: { name: product.name, sku: product.sku, productType: product.productType, variantCount: variants.length, totalStock },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });

    res.status(201).json({ success: true, message: 'Fashion product created successfully', product });
  } catch (error: any) {
    res.status(error.code === 'P2002' ? 409 : 400).json({ success: false, message: error.code === 'P2002' ? 'This product URL, SKU or barcode is already used. Choose another.' : 'Could not create product. Check variation combinations, prices and stock.' });
  }
};

export const updateProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const input = productInputSchema.safeParse(req.body);
    if (!input.success) { res.status(400).json({ success: false, message: input.error.issues[0]?.message || 'Invalid product data' }); return; }
    req.body = input.data;
    const id = req.params.id as string;
    const {
      name,
      slug,
      sku,
      barcode,
      description,
      category,
      buyPrice,
      regularPrice,
      salePrice,
      stockQuantity,
      minStockThreshold,
      image,
      gallery,
      metaTitle,
      metaDescription,
      status,
      variants,
      attributes,
    } = req.body;

    const existingProduct = await prisma.product.findUnique({ where: { id }, include: { variants: true } });
    if (!existingProduct) {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }
    if (status !== undefined && !allowedProductStatuses.has(status)) { res.status(400).json({ success: false, message: 'Invalid product status' }); return; }
    if ([buyPrice, regularPrice, salePrice, stockQuantity, minStockThreshold].filter((value) => value !== undefined).some((value) => !isNonNegativeNumber(value))) { res.status(400).json({ success: false, message: 'Prices and stock values must be valid non-negative numbers' }); return; }

    const updated = await prisma.$transaction(async (tx) => {
    // A supplied variation array is an authoritative catalogue edit. Removed
    // variations are archived (not deleted), preserving historic order links.
    if (Array.isArray(variants)) {
      assertUniqueVariations(variants);
      const existingIds = new Set(existingProduct.variants.map((variant) => variant.id));
      const suppliedIds = new Set(variants.filter((variant: any) => variant.id).map((variant: any) => variant.id));
      if ([...suppliedIds].some((variantId) => !existingIds.has(variantId))) {
        throw new Error('A variation does not belong to this product');
      }

        for (const oldVariant of existingProduct.variants) {
          if (!suppliedIds.has(oldVariant.id)) {
            await tx.productVariant.update({ where: { id: oldVariant.id }, data: { status: 'ARCHIVED' } });
          }
        }

        for (let index = 0; index < variants.length; index += 1) {
          const variant = variants[index];
          const color = variant.color ? String(variant.color).trim() : undefined;
          const size = variant.size ? String(variant.size).trim() : undefined;
          const attributes = variationAttributes(variant);
          const optionCode = Object.values(attributes).map((value) => String(value).replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase()).filter(Boolean).join('-') || 'VAR';
          const fallbackSku = `${sku || existingProduct.sku}-${optionCode}-${index + 1}`;
          const variantData = {
            name: variant.name || `${name || existingProduct.name} - ${Object.values(attributes).join(' / ')}`,
            sku: variant.sku || fallbackSku,
            barcode: variant.barcode || undefined,
            color,
            size,
            attributes: asJson(attributes),
            buyPrice: Number(variant.buyPrice ?? buyPrice ?? existingProduct.buyPrice),
            regularPrice: Number(variant.regularPrice ?? regularPrice ?? existingProduct.regularPrice),
            salePrice: Number(variant.salePrice ?? salePrice ?? existingProduct.salePrice),
            stockQuantity: Number(variant.stockQuantity ?? 0),
            minStockThreshold: Number(variant.minStockThreshold ?? 3),
            image: variant.image || undefined,
            status: variant.status || 'ACTIVE',
          };
          if (variant.id) {
            await tx.productVariant.update({ where: { id: variant.id }, data: variantData });
          } else {
            await tx.productVariant.create({ data: { productId: id, ...variantData } });
          }
        }
    }

    const activeVariants = Array.isArray(variants)
      ? await tx.productVariant.findMany({ where: { productId: id, status: { not: 'ARCHIVED' } } })
      : existingProduct.variants.filter((variant) => variant.status !== 'ARCHIVED');
    const aggregateVariantStock = activeVariants.reduce((sum, variant) => sum + variant.stockQuantity, 0);

    return tx.product.update({
      where: { id },
      data: {
        name,
        slug,
        sku,
        barcode,
        description,
        category,
        buyPrice: buyPrice !== undefined ? Number(buyPrice) : undefined,
        regularPrice: regularPrice !== undefined ? Number(regularPrice) : undefined,
        salePrice: salePrice !== undefined ? Number(salePrice) : undefined,
        minStockThreshold: minStockThreshold !== undefined ? Number(minStockThreshold) : undefined,
        image,
        gallery: gallery !== undefined ? asJson(gallery) : undefined,
        metaTitle,
        metaDescription,
        status,
        productType: Array.isArray(variants) ? (variants.length ? 'VARIABLE' : 'SIMPLE') : undefined,
        attributes: attributes !== undefined ? asJson(attributes) : undefined,
        stockQuantity: Array.isArray(variants) && variants.length ? aggregateVariantStock : stockQuantity !== undefined ? Number(stockQuantity) : undefined,
      },
      include: { variants: true },
    });

    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name,
      action: 'UPDATE',
      entity: 'PRODUCT',
      entityId: id,
      details: { name: updated.name, sku: updated.sku, productType: updated.productType, variantCount: updated.variants.length },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });

    res.json({ success: true, message: 'Product updated successfully', product: updated });
  } catch (error: any) {
    res.status(error.code === 'P2002' ? 409 : 400).json({ success: false, message: error.code === 'P2002' ? 'This product URL, SKU or barcode is already used. Choose another.' : 'Could not save product. Check variation combinations, prices and stock.' });
  }
};

export const deleteProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) { res.status(404).json({ success: false, message: 'Product not found' }); return; }
    if (product.status === 'ARCHIVED') { res.json({ success: true, message: 'Product is already in Trash', productId: id }); return; }
    await prisma.product.update({ where: { id }, data: { status: 'ARCHIVED' } });
    await logAudit({ userId: req.user?.id, userName: req.user?.name, action: 'DELETE', entity: 'PRODUCT', entityId: id, details: { name: product.name, sku: product.sku }, ipAddress: req.ip, userAgent: req.headers['user-agent'] as string | undefined });
    res.json({ success: true, message: 'Product moved to Trash', productId: id, status: 'ARCHIVED' });
  } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
};

export const restoreProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) { res.status(404).json({ success: false, message: 'Product not found' }); return; }
    if (product.status !== 'ARCHIVED') { res.status(409).json({ success: false, message: 'Product is not archived' }); return; }
    await prisma.product.update({ where: { id }, data: { status: 'DRAFT' } });
    await logAudit({ userId: req.user?.id, userName: req.user?.name, action: 'STATUS_CHANGE', entity: 'PRODUCT', entityId: id, details: { name: product.name, restoredAs: 'DRAFT' }, ipAddress: req.ip, userAgent: req.headers['user-agent'] as string | undefined });
    res.json({ success: true, message: 'Product restored as draft', productId: id, status: 'DRAFT' });
  } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
};

export const restoreProducts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { productIds } = req.body;
    if (!Array.isArray(productIds) || productIds.length < 1 || productIds.length > 100) {
      res.status(400).json({ success: false, message: 'Select between 1 and 100 products' });
      return;
    }
    const ids = [...new Set(productIds.map(String))];
    const result = await prisma.product.updateMany({ where: { id: { in: ids }, status: 'ARCHIVED' }, data: { status: 'DRAFT' } });
    await logAudit({ userId: req.user?.id, userName: req.user?.name, action: 'STATUS_CHANGE', entity: 'PRODUCT', entityId: ids.join(','), details: { bulk: true, action: 'RESTORE', requested: ids.length, restored: result.count }, ipAddress: req.ip, userAgent: req.headers['user-agent'] as string | undefined });
    res.json({ success: true, message: `${result.count} product${result.count === 1 ? '' : 's'} restored as draft`, count: result.count });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const permanentlyDeleteProducts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { productIds } = req.body;
    if (!Array.isArray(productIds) || productIds.length < 1 || productIds.length > 100) {
      res.status(400).json({ success: false, message: 'Select between 1 and 100 products' });
      return;
    }
    const ids = [...new Set(productIds.map(String))];
    const result = await prisma.$transaction(async (tx) => {
      const deleted: Array<{ id: string; name: string; sku: string }> = [];
      for (const id of ids) {
        const product = await tx.product.findUnique({ where: { id }, select: { id: true, name: true, sku: true, status: true, variants: { select: { id: true, name: true, sku: true } } } });
        if (!product || product.status !== 'ARCHIVED') continue;
        const variantsById = new Map(product.variants.map((variant) => [variant.id, variant]));
        const purchaseItems = await tx.purchaseOrderItem.findMany({ where: { productId: id }, select: { id: true, variantId: true, productName: true, productSku: true, variantName: true, variantSku: true } });
        for (const item of purchaseItems) {
          const variant = item.variantId ? variantsById.get(item.variantId) : undefined;
          await tx.purchaseOrderItem.update({ where: { id: item.id }, data: {
            productName: item.productName || product.name,
            productSku: item.productSku || product.sku,
            variantName: item.variantName || variant?.name,
            variantSku: item.variantSku || variant?.sku,
            productId: null,
            variantId: null,
          } });
        }
        const movements = await tx.stockMovement.findMany({ where: { productId: id }, select: { id: true, variantId: true, productName: true, productSku: true, variantName: true, variantSku: true } });
        for (const movement of movements) {
          const variant = movement.variantId ? variantsById.get(movement.variantId) : undefined;
          await tx.stockMovement.update({ where: { id: movement.id }, data: {
            productName: movement.productName || product.name,
            productSku: movement.productSku || product.sku,
            variantName: movement.variantName || variant?.name,
            variantSku: movement.variantSku || variant?.sku,
            productId: null,
            variantId: null,
          } });
        }
        await tx.product.delete({ where: { id } });
        deleted.push({ id, name: product.name, sku: product.sku });
      }
      return { deleted, blocked: [] as Array<{ id: string; name: string; reason: string }> };
    });
    for (const product of result.deleted) {
      await logAudit({ userId: req.user?.id, userName: req.user?.name, action: 'DELETE', entity: 'PRODUCT', entityId: product.id, details: { name: product.name, sku: product.sku, permanent: true }, ipAddress: req.ip, userAgent: req.headers['user-agent'] as string | undefined });
    }
    res.json({ success: true, count: result.deleted.length, blocked: result.blocked, message: `${result.deleted.length} product${result.deleted.length === 1 ? '' : 's'} permanently deleted` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const adjustStock = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { productId, variantId, warehouseId, type, quantity, note } = req.body;

    if (!productId || !type || quantity === undefined) {
      res.status(400).json({ success: false, message: 'productId, type, and quantity are required' });
      return;
    }
    const allowedMovementTypes = new Set(['PURCHASE_IN', 'SALE_DEDUCTION', 'RETURN_RESTOCK', 'MANUAL_ADJUSTMENT', 'DAMAGE_LOSS']);
    const requestedQuantity = Number(quantity);
    if (!allowedMovementTypes.has(type) || !Number.isInteger(requestedQuantity) || requestedQuantity === 0 || Math.abs(requestedQuantity) > 100000) {
      res.status(400).json({ success: false, message: 'Invalid stock movement type or quantity' });
      return;
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { variants: true },
    });

    if (!product) {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }

    const qtyChange = requestedQuantity;

    let prevStock = product.stockQuantity;
    let newStock = Math.max(0, prevStock + qtyChange);

    // If specific variant adjustment
    if (variantId) {
      const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
      if (variant && variant.productId === productId && variant.status !== 'ARCHIVED') {
        const vPrev = variant.stockQuantity;
        const vNew = Math.max(0, vPrev + qtyChange);
        await prisma.productVariant.update({
          where: { id: variantId },
          data: { stockQuantity: vNew },
        });

        prevStock = vPrev;
        // Recalculate parent product stock from active sellable variations.
        const allVars = await prisma.productVariant.findMany({ where: { productId, status: { not: 'ARCHIVED' } } });
        newStock = allVars.reduce((sum, v) => sum + v.stockQuantity, 0);
      } else {
        res.status(404).json({ success: false, message: 'Active product variation not found' });
        return;
      }
    }

    await prisma.product.update({
      where: { id: productId },
      data: { stockQuantity: newStock },
    });

    const movement = await prisma.stockMovement.create({
      data: {
        productId,
        variantId: variantId || null,
        warehouseId: warehouseId || null,
        type,
        quantity: qtyChange,
        previousStock: prevStock,
        currentStock: newStock,
        note,
        createdById: req.user?.id,
      },
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name,
      action: 'UPDATE',
      entity: 'INVENTORY',
      entityId: productId,
      details: { type, quantity: qtyChange, prevStock, newStock, variantId },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });

    res.json({
      success: true,
      message: 'Stock adjusted successfully',
      currentStock: newStock,
      movement,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const listStockMovements = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { productId, variantId, limit = '50', page = '1' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (productId) where.productId = String(productId);
    if (variantId) where.variantId = String(variantId);

    const [movements, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, sku: true } },
          variant: { select: { id: true, name: true, sku: true, color: true, size: true } },
          createdBy: { select: { id: true, name: true } },
          warehouse: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.stockMovement.count({ where }),
    ]);

    res.json({
      success: true,
      movements,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const listWarehouses = async (req: Request, res: Response): Promise<void> => {
  try {
    const warehouses = await prisma.warehouse.findMany({
      orderBy: { createdAt: 'asc' },
    });
    res.json({ success: true, warehouses });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
