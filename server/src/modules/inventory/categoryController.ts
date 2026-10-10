import { Request, Response } from 'express';
import prisma from '../../prisma';
import { AuthRequest } from '../../middlewares/auth';
import { logAudit } from '../audit/auditService';

const slugify = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const listCategories = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [categories, counts] = await Promise.all([
      prisma.category.findMany({ orderBy: { name: 'asc' } }),
      prisma.product.groupBy({ by: ['category'], _count: { _all: true } }),
    ]);
    const productCounts = new Map(counts.map((entry) => [entry.category || '', entry._count._all]));
    res.json({ success: true, categories: categories.map((category) => ({ ...category, productCount: productCounts.get(category.name) || 0 })) });
  } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
};

export const createCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) { res.status(400).json({ success: false, message: 'Category name is required' }); return; }
    const slug = slugify(String(req.body.slug || name));
    if (!slug) { res.status(400).json({ success: false, message: 'Enter a valid category name' }); return; }
    const category = await prisma.category.create({ data: { name, slug, description: String(req.body.description || '').trim() || null, image: String(req.body.image || '').trim() || null, parentId: String(req.body.parentId || '').trim() || null } });
    await logAudit({ userId: req.user?.id, userName: req.user?.name, action: 'CREATE', entity: 'PRODUCT', entityId: category.id, details: { resource: 'CATEGORY', name: category.name }, ipAddress: req.ip, userAgent: req.headers['user-agent'] as string | undefined });
    res.status(201).json({ success: true, category: { ...category, productCount: 0 } });
  } catch (error: any) { res.status(400).json({ success: false, message: error.message.includes('Unique constraint') ? 'Category name or slug already exists' : error.message }); }
};

export const updateCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) { res.status(400).json({ success: false, message: 'Category name is required' }); return; }
    const category = await prisma.category.update({ where: { id: String(req.params.id) }, data: { name, slug: slugify(String(req.body.slug || name)), description: String(req.body.description || '').trim() || null, image: String(req.body.image || '').trim() || null, parentId: String(req.body.parentId || '').trim() || null } });
    await logAudit({ userId: req.user?.id, userName: req.user?.name, action: 'UPDATE', entity: 'PRODUCT', entityId: category.id, details: { resource: 'CATEGORY', name: category.name }, ipAddress: req.ip, userAgent: req.headers['user-agent'] as string | undefined });
    res.json({ success: true, category });
  } catch (error: any) { res.status(400).json({ success: false, message: error.message.includes('Unique constraint') ? 'Category name or slug already exists' : 'Could not update category' }); }
};

export const deleteCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const category = await prisma.category.findUnique({ where: { id: String(req.params.id) } });
    if (!category) { res.status(404).json({ success: false, message: 'Category not found' }); return; }
    const productCount = await prisma.product.count({ where: { category: category.name } });
    if (productCount) { res.status(409).json({ success: false, message: `Move or recategorize ${productCount} product(s) before deleting this category` }); return; }
    await prisma.category.delete({ where: { id: category.id } });
    await logAudit({ userId: req.user?.id, userName: req.user?.name, action: 'DELETE', entity: 'PRODUCT', entityId: category.id, details: { resource: 'CATEGORY', name: category.name }, ipAddress: req.ip, userAgent: req.headers['user-agent'] as string | undefined });
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
};
