import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../../prisma';
import { AuthRequest } from '../../middlewares/auth';
import { logAudit } from '../audit/auditService';

// Explicit allowlist: authentication fields must never enter CRM responses.
const customerSelect = {
  id: true, name: true, phone: true, alternativePhone: true, email: true,
  accountStatus: true, address: true, district: true, city: true, zone: true, area: true,
  totalOrders: true, completedOrders: true, cancelledOrders: true, returnedOrders: true,
  totalSpent: true, successRate: true, riskScore: true, isBlacklisted: true,
  tags: true, notes: true, createdAt: true, updatedAt: true,
} satisfies Prisma.CustomerSelect;

export const listCustomers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, tag, isBlacklisted, page = '1', limit = '25' } = req.query;

    const pageNum = Math.max(parseInt(page as string, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit as string, 10) || 25, 1), 100);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (isBlacklisted === 'true') {
      where.isBlacklisted = true;
    }
    if (tag) {
      where.tags = { contains: tag as string };
    }
    if (search) {
      const q = String(search).trim();
      where.OR = [
        { name: { contains: q } },
        { phone: { contains: q } },
        { email: { contains: q } },
        { city: { contains: q } },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        select: {
          ...customerSelect,
          _count: { select: { orders: true } },
        },
        orderBy: { totalOrders: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.customer.count({ where }),
    ]);

    res.json({
      success: true,
      customers,
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

export const getCustomerProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const customer = await prisma.customer.findUnique({
      where: { id },
      select: {
        ...customerSelect,
        orders: {
          include: { items: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!customer) {
      res.status(404).json({ success: false, message: 'Customer not found' });
      return;
    }

    const totalOrders = customer.orders.length;
    const completedOrders = customer.orders.filter((o: any) => o.status === 'DELIVERED').length;
    const returnedOrders = customer.orders.filter((o: any) => o.status === 'RETURNED').length;
    const cancelledOrders = customer.orders.filter((o: any) => o.status === 'CANCELLED').length;
    const totalSpent = customer.orders
      .filter((o: any) => o.status === 'DELIVERED')
      .reduce((sum: number, o: any) => sum + o.grandTotal, 0);

    const successRate = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 100;

    res.json({
      success: true,
      customer: {
        ...customer,
        stats: {
          totalOrders,
          completedOrders,
          returnedOrders,
          cancelledOrders,
          totalSpent,
          successRate: Math.round(successRate * 10) / 10,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateCustomer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { name, alternativePhone, email, address, district, city, zone, area, isBlacklisted, tags, notes } = req.body;

    const updated = await prisma.customer.update({
      select: customerSelect,
      where: { id },
      data: {
        name,
        alternativePhone,
        email,
        address,
        district,
        city,
        zone,
        area,
        isBlacklisted,
        tags: Array.isArray(tags) ? JSON.stringify(tags) : tags,
        notes,
      },
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name,
      action: 'UPDATE',
      entity: 'CUSTOMER',
      entityId: id,
      details: { name, isBlacklisted, tags },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });

    res.json({ success: true, message: 'Customer updated', customer: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
