import { Request, Response } from 'express';
import prisma from '../../prisma';
import { AuthRequest } from '../../middlewares/auth';
import { logAudit } from '../audit/auditService';

const slugify = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const normalizeOptions = (value: unknown): string[] => {
  const source = Array.isArray(value) ? value : String(value || '').split(/[\n,|]/);
  return [...new Set(source.map((item) => String(item).trim()).filter(Boolean))];
};
const parseOptions = (value: string) => { try { return JSON.parse(value) as string[]; } catch { return []; } };
const orderModes = new Set(['MENU_ORDER', 'NAME', 'NAME_NUM', 'ID']);
const orderedOptions = (options: string[], orderBy: string) => {
  if (orderBy === 'NAME') return [...options].sort((a, b) => a.localeCompare(b));
  if (orderBy === 'NAME_NUM') return [...options].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  if (orderBy === 'ID') return [...options];
  return options;
};
const toResponse = (attribute: { id: string; name: string; slug: string; options: string; type: string; displayStyle: string; optionColors: string | null; orderBy: string; createdAt: Date; updatedAt: Date }) => {
  const options = parseOptions(attribute.options);
  let optionColors = {}; try { optionColors = JSON.parse(attribute.optionColors || '{}'); } catch { /* invalid legacy color map */ }
  return { ...attribute, options, optionColors, orderedOptions: orderedOptions(options, attribute.orderBy) };
};

export const listAttributes = async (_req: Request, res: Response): Promise<void> => {
  try {
    const attributes = await prisma.productAttribute.findMany({ orderBy: { name: 'asc' } });
    const products = await prisma.product.findMany({ select: { attributes: true } });
    const usage = new Map<string, number>();
    for (const product of products) {
      try {
        const definitions = JSON.parse(product.attributes || '[]');
        if (Array.isArray(definitions)) for (const definition of definitions) {
          if (definition.attributeId) usage.set(definition.attributeId, (usage.get(definition.attributeId) || 0) + 1);
        }
      } catch { /* ignore legacy attribute payloads */ }
    }
    res.json({ success: true, attributes: attributes.map((attribute) => ({ ...toResponse(attribute), productCount: usage.get(attribute.id) || 0 })) });
  } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
};

export const createAttribute = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const name = String(req.body.name || '').trim();
    const options = normalizeOptions(req.body.options);
    const slug = slugify(String(req.body.slug || name));
    const orderBy = String(req.body.orderBy || 'MENU_ORDER');
    const type = ['COLOR', 'SIZE_TEXT', 'SIZE_NUMBER', 'TEXT', 'NUMBER'].includes(req.body.type) ? req.body.type : 'TEXT';
    const displayStyle = ['SOFT', 'CIRCLE', 'SQUARE'].includes(req.body.displayStyle) ? req.body.displayStyle : 'SOFT';
    const optionColors = req.body.optionColors && typeof req.body.optionColors === 'object' ? req.body.optionColors : {};
    if (!name || !slug) { res.status(400).json({ success: false, message: 'Attribute name is required' }); return; }
    if (options.length < 1) { res.status(400).json({ success: false, message: 'Add at least one option' }); return; }
    if (!orderModes.has(orderBy)) { res.status(400).json({ success: false, message: 'Invalid attribute sort order' }); return; }
    const attribute = await prisma.productAttribute.create({ data: { name, slug, options: JSON.stringify(options), orderBy, type, displayStyle, optionColors: JSON.stringify(optionColors) } });
    await logAudit({ userId: req.user?.id, userName: req.user?.name, action: 'CREATE', entity: 'PRODUCT', entityId: attribute.id, details: { resource: 'PRODUCT_ATTRIBUTE', name, optionCount: options.length }, ipAddress: req.ip, userAgent: req.headers['user-agent'] as string | undefined });
    res.status(201).json({ success: true, attribute: { ...toResponse(attribute), productCount: 0 } });
  } catch (error: any) { res.status(400).json({ success: false, message: error.message.includes('Unique constraint') ? 'Attribute name or slug already exists' : error.message }); }
};

export const updateAttribute = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const name = String(req.body.name || '').trim();
    const slug = slugify(String(req.body.slug || name));
    const options = normalizeOptions(req.body.options);
    const orderBy = String(req.body.orderBy || 'MENU_ORDER');
    const type = ['COLOR', 'SIZE_TEXT', 'SIZE_NUMBER', 'TEXT', 'NUMBER'].includes(req.body.type) ? req.body.type : 'TEXT';
    const displayStyle = ['SOFT', 'CIRCLE', 'SQUARE'].includes(req.body.displayStyle) ? req.body.displayStyle : 'SOFT';
    const optionColors = req.body.optionColors && typeof req.body.optionColors === 'object' ? req.body.optionColors : {};
    if (!name || !slug) { res.status(400).json({ success: false, message: 'Attribute name is required' }); return; }
    if (options.length < 1) { res.status(400).json({ success: false, message: 'Add at least one option' }); return; }
    if (!orderModes.has(orderBy)) { res.status(400).json({ success: false, message: 'Invalid attribute sort order' }); return; }
    const attribute = await prisma.productAttribute.update({ where: { id }, data: { name, slug, options: JSON.stringify(options), orderBy, type, displayStyle, optionColors: JSON.stringify(optionColors) } });
    await logAudit({ userId: req.user?.id, userName: req.user?.name, action: 'UPDATE', entity: 'PRODUCT', entityId: id, details: { resource: 'PRODUCT_ATTRIBUTE', name, optionCount: options.length }, ipAddress: req.ip, userAgent: req.headers['user-agent'] as string | undefined });
    res.json({ success: true, attribute: toResponse(attribute) });
  } catch (error: any) { res.status(400).json({ success: false, message: error.message.includes('Unique constraint') ? 'Attribute name or slug already exists' : 'Could not update attribute' }); }
};

export const deleteAttribute = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const attribute = await prisma.productAttribute.findUnique({ where: { id } });
    if (!attribute) { res.status(404).json({ success: false, message: 'Attribute not found' }); return; }
    await prisma.productAttribute.delete({ where: { id } });
    await logAudit({ userId: req.user?.id, userName: req.user?.name, action: 'DELETE', entity: 'PRODUCT', entityId: id, details: { resource: 'PRODUCT_ATTRIBUTE', name: attribute.name }, ipAddress: req.ip, userAgent: req.headers['user-agent'] as string | undefined });
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
};
