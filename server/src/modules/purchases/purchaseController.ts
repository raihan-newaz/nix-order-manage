import { Request, Response } from 'express';
import prisma from '../../prisma';
import { AuthRequest } from '../../middlewares/auth';

export const listSuppliers = async (req: Request, res: Response): Promise<void> => {
  try {
    const suppliers = await prisma.supplier.findMany({
      include: { _count: { select: { purchaseOrders: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, suppliers });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createSupplier = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, company, phone, email, address } = req.body;
    if (!name || !phone) {
      res.status(400).json({ success: false, message: 'Supplier name and phone are required' });
      return;
    }

    const supplier = await prisma.supplier.create({
      data: { name, company, phone, email, address },
    });

    res.status(201).json({ success: true, message: 'Supplier created', supplier });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const listPurchases = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, Number.parseInt(String(req.query.page || 1), 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit || 20), 10) || 20));
    const search = String(req.query.search || '').trim().slice(0, 100);
    const status = String(req.query.status || '').trim();
    const where: any = {};
    if (search) where.OR = [{ invoiceNumber: { contains: search } }, { supplier: { is: { name: { contains: search } } } }];
    if (['RECEIVED', 'DRAFT', 'CANCELLED'].includes(status)) where.status = status;
    const [purchases, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        include: { supplier: true, items: { include: { product: { select: { name: true, sku: true } }, variant: { select: { name: true, sku: true } } } } },
        orderBy: [{ purchaseDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.purchaseOrder.count({ where }),
    ]);
    res.json({ success: true, purchases, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPurchaseById = async (req: Request, res: Response): Promise<void> => {
  try {
    const purchase = await prisma.purchaseOrder.findUnique({
      where: { id: String(req.params.id) },
      include: {
        supplier: true, warehouse: true, createdBy: { select: { id: true, name: true } },
        items: { include: { product: { select: { id: true, name: true, sku: true, image: true } }, variant: { select: { id: true, name: true, sku: true, color: true, size: true } } } },
      },
    });
    if (!purchase) { res.status(404).json({ success: false, message: 'Purchase not found' }); return; }
    const payments = await prisma.transaction.findMany({ where: { referenceType: 'PURCHASE', referenceId: purchase.id }, include: { account: { select: { id: true, name: true } } }, orderBy: { date: 'desc' } });
    res.json({ success: true, purchase, payments });
  } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
};

export { createPurchaseOrder } from './purchaseCreateController';
