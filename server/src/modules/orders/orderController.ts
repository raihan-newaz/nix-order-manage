import { Request, Response } from 'express';
import prisma from '../../prisma';
import { AuthRequest } from '../../middlewares/auth';
import { logAudit } from '../audit/auditService';
import { notifyOrderStatus, sendOrderNotification } from '../messaging/messageService';
import { revealSecret } from '../../utils/security';
import { getNextOrderNumber } from './orderNumberService';

export const listOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      status,
      search,
      courier,
      assignee,
      assignedToId,
      priority,
      orderAge,
      settlement,
      courierSettlementStatus,
      isFraudSuspect,
      isDuplicate,
      page = '1',
      limit = '25',
      sortBy = 'createdAt',
      sortOrder = 'desc',
      trash,
    } = req.query;

    const pageNum = Math.max(parseInt(page as string, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit as string, 10) || 25, 1), 100);
    const skip = (pageNum - 1) * limitNum;
    const allowedSortFields = new Set(['createdAt', 'updatedAt', 'orderNumber', 'grandTotal', 'status']);
    const safeSortBy = allowedSortFields.has(String(sortBy === 'total' ? 'grandTotal' : sortBy)) ? String(sortBy === 'total' ? 'grandTotal' : sortBy) : 'createdAt';

    const where: any = trash === 'true' ? { trashedAt: { not: null } } : { trashedAt: null };

    if (status && status !== 'ALL') {
      where.status = status as string;
    }

    if (courier && courier !== 'ALL') {
      where.courierName = courier as string;
    }

    const effectiveAssignee = assignee || assignedToId;
    if (effectiveAssignee && effectiveAssignee !== 'ALL') {
      if (effectiveAssignee === 'UNASSIGNED') {
        where.assignedToId = null;
      } else {
        where.assignedToId = String(effectiveAssignee).trim();
      }
    }

    if (priority && priority !== 'ALL') {
      where.priority = String(priority).trim();
    }

    const effectiveSettlement = settlement || courierSettlementStatus;
    if (effectiveSettlement && effectiveSettlement !== 'ALL') {
      where.courierSettlementStatus = String(effectiveSettlement).trim();
    }

    if (orderAge && orderAge !== 'ALL') {
      const now = Date.now();
      if (orderAge === '24h') {
        where.createdAt = { lte: new Date(now - 24 * 60 * 60 * 1000) };
      } else if (orderAge === '48h') {
        where.createdAt = { lte: new Date(now - 48 * 60 * 60 * 1000) };
      } else if (orderAge === '7d') {
        where.createdAt = { lte: new Date(now - 7 * 24 * 60 * 60 * 1000) };
      } else if (orderAge === 'today') {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        where.createdAt = { gte: startOfToday };
      } else if (orderAge === 'under24h') {
        where.createdAt = { gte: new Date(now - 24 * 60 * 60 * 1000) };
      }
    }

    if (isFraudSuspect === 'true') {
      where.isFraudSuspect = true;
    }

    if (isDuplicate === 'true') {
      where.isDuplicate = true;
    }

    if (search) {
      const q = String(search).trim();
      where.OR = [
        { orderNumber: { contains: q } },
        { customerName: { contains: q } },
        { customerPhone: { contains: q } },
        { courierTrackingCode: { contains: q } },
      ];
    }

    const [orders, total, counts, trashCount] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: true,
          customer: { select: { id: true, name: true, phone: true, alternativePhone: true, email: true, totalOrders: true, completedOrders: true, cancelledOrders: true, returnedOrders: true, totalSpent: true, successRate: true, riskScore: true, isBlacklisted: true } },
          assignedTo: { select: { id: true, name: true } },
        },
        orderBy: { [safeSortBy]: sortOrder === 'asc' ? 'asc' : 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.order.count({ where }),
      prisma.order.groupBy({
        where: { trashedAt: null },
        by: ['status'],
        _count: { _all: true },
      }),
      prisma.order.count({ where: { trashedAt: { not: null } } }),
    ]);

    const statusCounts: Record<string, number> = {
      ALL: 0,
      PENDING: 0,
      CONFIRMED: 0,
      PACKAGING: 0,
      HANDED_OVER: 0,
      IN_TRANSIT: 0,
      DELIVERED: 0,
      PARTIAL_DELIVERED: 0,
      CANCELLED: 0,
      RETURNED: 0,
      HOLD: 0,
      FAKE_TRASH: 0,
    };

    let allTotal = 0;
    counts.forEach((c) => {
      statusCounts[c.status] = c._count._all;
      allTotal += c._count._all;
    });
    statusCounts.ALL = allTotal;
    statusCounts.TRASH = trashCount;

    res.json({
      success: true,
      data: orders,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
      statusCounts,
    });
  } catch (error: any) {
    res.status(error.status === 409 ? 409 : 500).json({ success: false, message: error.message });
  }
};

const parseOrderIds = (body: any): string[] | null => {
  if (!Array.isArray(body?.orderIds) || body.orderIds.length < 1 || body.orderIds.length > 100) return null;
  return [...new Set<string>(body.orderIds.map((id: unknown) => String(id).trim()).filter(Boolean))];
};

export const trashOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orderIds = parseOrderIds(req.body);
    if (!orderIds) { res.status(400).json({ success: false, message: 'Select between 1 and 100 orders' }); return; }
    const result = await prisma.order.updateMany({ where: { id: { in: orderIds }, trashedAt: null }, data: { trashedAt: new Date() } });
    await logAudit({ userId: req.user?.id, userName: req.user?.name, action: 'DELETE', entity: 'ORDER', entityId: orderIds.join(','), details: { action: 'TRASH', requested: orderIds.length, trashed: result.count }, ipAddress: req.ip, userAgent: req.headers['user-agent'] as string | undefined });
    res.json({ success: true, count: result.count, message: `${result.count} order${result.count === 1 ? '' : 's'} moved to Trash` });
  } catch (error: any) { res.status(error.status === 409 ? 409 : 500).json({ success: false, message: error.message }); }
};

export const restoreOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orderIds = parseOrderIds(req.body);
    if (!orderIds) { res.status(400).json({ success: false, message: 'Select between 1 and 100 orders' }); return; }
    const result = await prisma.order.updateMany({ where: { id: { in: orderIds }, trashedAt: { not: null } }, data: { trashedAt: null } });
    await logAudit({ userId: req.user?.id, userName: req.user?.name, action: 'STATUS_CHANGE', entity: 'ORDER', entityId: orderIds.join(','), details: { action: 'RESTORE', requested: orderIds.length, restored: result.count }, ipAddress: req.ip, userAgent: req.headers['user-agent'] as string | undefined });
    res.json({ success: true, count: result.count, message: `${result.count} order${result.count === 1 ? '' : 's'} restored` });
  } catch (error: any) { res.status(error.status === 409 ? 409 : 500).json({ success: false, message: error.message }); }
};

export const permanentlyDeleteOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orderIds = parseOrderIds(req.body);
    if (!orderIds) { res.status(400).json({ success: false, message: 'Select between 1 and 100 orders' }); return; }
    const deleted = await prisma.$transaction(async (tx) => {
      const archived = await tx.order.findMany({ where: { id: { in: orderIds }, trashedAt: { not: null } }, select: { id: true, orderNumber: true, customerId: true, customerName: true, customerPhone: true, grandTotal: true } });
      const affectedCustomerIds = new Set<string>();
      for (const order of archived) {
        if (await tx.paymentAttempt.count({ where: { orderId: order.id } })) throw new Error('Online-payment orders must be retained for payment audit and cannot be permanently deleted');
        // Keep outbound communication logs and finance ledger entries, but unlink the deleted order.
        await tx.messageLog.updateMany({ where: { orderId: order.id }, data: { orderId: null } });
        const ledgerEntries = await tx.transaction.findMany({ where: { referenceType: 'ORDER', referenceId: order.id }, select: { id: true, note: true } });
        for (const entry of ledgerEntries) {
          const orderSnapshot = `[Deleted order ${order.orderNumber}; customer ${order.customerName}; phone ${order.customerPhone}; total ${order.grandTotal}]`;
          await tx.transaction.update({ where: { id: entry.id }, data: { note: entry.note ? `${entry.note}\n${orderSnapshot}` : orderSnapshot } });
        }
        await tx.order.delete({ where: { id: order.id } });
        if (order.customerId) affectedCustomerIds.add(order.customerId);
      }
      for (const customerId of affectedCustomerIds) {
        const remaining = await tx.order.findMany({ where: { customerId, trashedAt: null }, select: { status: true, grandTotal: true } });
        const completed = remaining.filter((order) => order.status === 'DELIVERED');
        await tx.customer.update({ where: { id: customerId }, data: {
          totalOrders: remaining.length,
          completedOrders: completed.length,
          cancelledOrders: remaining.filter((order) => order.status === 'CANCELLED').length,
          returnedOrders: remaining.filter((order) => order.status === 'RETURNED').length,
          totalSpent: completed.reduce((sum, order) => sum + order.grandTotal, 0),
          successRate: remaining.length ? (completed.length / remaining.length) * 100 : 100,
        } });
      }
      return archived;
    });
    for (const order of deleted) {
      await logAudit({ userId: req.user?.id, userName: req.user?.name, action: 'DELETE', entity: 'ORDER', entityId: order.id, details: { orderNumber: order.orderNumber, customerName: order.customerName, customerPhone: order.customerPhone, grandTotal: order.grandTotal, permanent: true }, ipAddress: req.ip, userAgent: req.headers['user-agent'] as string | undefined });
    }
    res.json({ success: true, count: deleted.length, message: `${deleted.length} order${deleted.length === 1 ? '' : 's'} permanently deleted; finance and message logs were preserved` });
  } catch (error: any) { res.status(/payment audit/.test(error.message) ? 409 : 500).json({ success: false, message: error.message }); }
};

export const getOrderById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
        customer: { select: { id: true, name: true, phone: true, alternativePhone: true, email: true, totalOrders: true, completedOrders: true, cancelledOrders: true, returnedOrders: true, totalSpent: true, successRate: true, riskScore: true, isBlacklisted: true } },
        assignedTo: { select: { id: true, name: true, phone: true } },
        warehouse: true,
        messageLogs: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    const historyWhere = {
      id: { not: order.id }, trashedAt: null,
      OR: [{ customerPhone: order.customerPhone }, ...(order.customerId ? [{ customerId: order.customerId }] : [])],
    };
    const [recentOrders, statusGroups, spent] = await Promise.all([
      prisma.order.findMany({ where: historyWhere, orderBy: { createdAt: 'desc' }, take: 10,
        select: { id: true, orderNumber: true, createdAt: true, status: true, grandTotal: true, items: { select: { productName: true, quantity: true }, take: 3 } } }),
      prisma.order.groupBy({ where: { ...historyWhere, status: { in: ['DELIVERED', 'CANCELLED', 'RETURNED', 'PARTIAL_DELIVERED'] } }, by: ['status'], _count: { _all: true } }),
      prisma.order.aggregate({ where: { ...historyWhere, status: 'DELIVERED' }, _sum: { grandTotal: true } }),
    ]);
    const countByStatus = Object.fromEntries(statusGroups.map((group) => [group.status, group._count._all]));
    const totalPrevious = await prisma.order.count({ where: historyWhere });
    res.json({ success: true, order, customerHistory: {
      totalPrevious, completed: countByStatus.DELIVERED || 0, cancelled: countByStatus.CANCELLED || 0,
      returned: countByStatus.RETURNED || 0, partial: countByStatus.PARTIAL_DELIVERED || 0,
      lifetimeSpent: spent._sum.grandTotal || 0, recentOrders,
    } });
  } catch (error: any) {
    res.status(error.status === 409 ? 409 : 500).json({ success: false, message: error.message });
  }
};

export const updateOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) { res.status(404).json({ success: false, message: 'Order not found' }); return; }
    if (order.trashedAt) { res.status(409).json({ success: false, message: 'Restore this order from Trash before editing it' }); return; }
    if (order.courierName || ['HANDED_OVER', 'IN_TRANSIT', 'DELIVERED', 'PARTIAL_DELIVERED', 'CANCELLED', 'RETURNED', 'FAKE_TRASH'].includes(order.status)) {
      res.status(409).json({ success: false, message: 'Booked, dispatched or closed orders cannot be edited. Use the dedicated status and courier workflows.' });
      return;
    }

    const body = req.body || {};
    const permitted = ['customerName', 'customerPhone', 'customerAddress', 'district', 'city', 'zone', 'area', 'paymentMethod', 'internalNote', 'customerNote', 'warehouseId', 'assignedToId', 'priority'];
    const data: Record<string, unknown> = {};
    for (const field of permitted) {
      if (body[field] !== undefined) data[field] = body[field] === '' && ['warehouseId', 'assignedToId'].includes(field) ? null : String(body[field]).trim();
    }
    if (data.priority !== undefined && !['NORMAL', 'URGENT'].includes(String(data.priority))) {
      res.status(400).json({ success: false, message: 'Priority must be NORMAL or URGENT' });
      return;
    }
    if (data.assignedToId) {
      const targetUser = await prisma.user.findUnique({ where: { id: String(data.assignedToId), status: 'ACTIVE' }, select: { id: true } });
      if (!targetUser) {
        res.status(400).json({ success: false, message: 'Assigned staff user not found or inactive' });
        return;
      }
    }
    if (!String(data.customerName ?? order.customerName).trim() || !String(data.customerPhone ?? order.customerPhone).trim() || !String(data.customerAddress ?? order.customerAddress).trim()) {
      res.status(400).json({ success: false, message: 'Customer name, phone, and address are required' });
      return;
    }
    if (String(data.customerName ?? order.customerName).length > 100 || String(data.customerAddress ?? order.customerAddress).length > 490 ||
      (data.customerPhone !== undefined && !/^01[3-9]\d{8}$/.test(String(data.customerPhone))) ||
      ['district', 'city', 'zone', 'area'].some((field) => String(data[field] || '').length > 100) ||
      ['internalNote', 'customerNote'].some((field) => String(data[field] || '').length > 2000) ||
      (data.paymentMethod !== undefined && !['COD', 'BKASH', 'NAGAD', 'BANK', 'PREPAID'].includes(String(data.paymentMethod)))) {
      res.status(400).json({ success: false, message: 'Check customer phone, field lengths and payment method' }); return;
    }
    if (data.customerPhone !== undefined && data.customerPhone !== order.customerPhone) {
      const matchingCustomer = await prisma.customer.findUnique({ where: { phone: String(data.customerPhone) }, select: { id: true } });
      data.customerId = matchingCustomer?.id || null;
    }

    const numericFields = ['deliveryCharge', 'discount', 'advancePaid'];
    for (const field of numericFields) {
      if (body[field] !== undefined) {
        const value = Number(body[field]);
        if (!Number.isFinite(value) || value < 0) { res.status(400).json({ success: false, message: `${field} must be a non-negative number` }); return; }
        data[field] = value;
      }
    }
    const deliveryCharge = Number(data.deliveryCharge ?? order.deliveryCharge);
    const discount = Number(data.discount ?? order.discount);
    const advancePaid = Number(data.advancePaid ?? order.advancePaid);
    const grandTotal = Math.max(0, order.subtotal + deliveryCharge - discount);
    data.grandTotal = grandTotal;
    data.codAmount = Math.max(0, grandTotal - advancePaid);
    data.paymentStatus = advancePaid >= grandTotal && grandTotal > 0 ? 'PAID' : advancePaid > 0 ? 'PARTIAL' : 'PENDING';

    const changed = await prisma.order.updateMany({ where: { id, courierName: null, trashedAt: null, status: { in: ['PENDING', 'CONFIRMED', 'PACKAGING', 'HOLD'] } }, data });
    if (!changed.count) { res.status(409).json({ success: false, message: 'Order changed during editing; reload before saving' }); return; }
    const updated = await prisma.order.findUniqueOrThrow({ where: { id } });
    await logAudit({
      userId: req.user?.id, userName: req.user?.name, action: 'UPDATE', entity: 'ORDER', entityId: id,
      details: { orderNumber: order.orderNumber, editedFields: Object.keys(data) }, ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    res.json({ success: true, order: updated, message: 'Order updated successfully' });
  } catch (error: any) { res.status(error.status === 409 ? 409 : 500).json({ success: false, message: error.message }); }
};

export const updateOrderAssignment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { assignedToId } = req.body;
    const order = await prisma.order.findUnique({
      where: { id },
      select: { id: true, orderNumber: true, assignedToId: true, trashedAt: true },
    });
    if (!order) { res.status(404).json({ success: false, message: 'Order not found' }); return; }
    if (order.trashedAt) { res.status(409).json({ success: false, message: 'Restore this order from Trash before assigning' }); return; }

    let targetUser: { id: string; name: string } | null = null;
    if (assignedToId && assignedToId !== 'UNASSIGNED') {
      targetUser = await prisma.user.findUnique({
        where: { id: String(assignedToId).trim(), status: 'ACTIVE' },
        select: { id: true, name: true },
      });
      if (!targetUser) {
        res.status(400).json({ success: false, message: 'Assigned staff user not found or inactive' });
        return;
      }
    }

    const newAssignedToId = targetUser ? targetUser.id : null;
    const updated = await prisma.order.update({
      where: { id },
      data: { assignedToId: newAssignedToId },
      include: { assignedTo: { select: { id: true, name: true, phone: true } } },
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name,
      action: 'ASSIGNMENT',
      entity: 'ORDER',
      entityId: order.id,
      details: {
        orderNumber: order.orderNumber,
        previousAssignedToId: order.assignedToId,
        newAssignedToId,
        assignedToName: targetUser?.name || 'Unassigned',
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });

    res.json({
      success: true,
      order: updated,
      message: targetUser ? `Order assigned to ${targetUser.name}` : 'Order unassigned',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateOrderPriority = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { priority } = req.body;
    if (!['NORMAL', 'URGENT'].includes(String(priority))) {
      res.status(400).json({ success: false, message: 'Priority must be NORMAL or URGENT' });
      return;
    }

    const order = await prisma.order.findUnique({
      where: { id },
      select: { id: true, orderNumber: true, priority: true, trashedAt: true },
    });
    if (!order) { res.status(404).json({ success: false, message: 'Order not found' }); return; }
    if (order.trashedAt) { res.status(409).json({ success: false, message: 'Restore this order from Trash before modifying priority' }); return; }

    const updated = await prisma.order.update({
      where: { id },
      data: { priority },
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name,
      action: 'PRIORITY_CHANGE',
      entity: 'ORDER',
      entityId: order.id,
      details: {
        orderNumber: order.orderNumber,
        previousPriority: order.priority,
        newPriority: priority,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });

    res.json({ success: true, order: updated, message: `Priority updated to ${priority}` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const bulkAssignOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orderIds = parseOrderIds(req.body);
    if (!orderIds) { res.status(400).json({ success: false, message: 'Select between 1 and 100 orders' }); return; }
    const { assignedToId } = req.body;

    let targetUser: { id: string; name: string } | null = null;
    if (assignedToId && assignedToId !== 'UNASSIGNED') {
      targetUser = await prisma.user.findUnique({
        where: { id: String(assignedToId).trim(), status: 'ACTIVE' },
        select: { id: true, name: true },
      });
      if (!targetUser) {
        res.status(400).json({ success: false, message: 'Assigned staff user not found or inactive' });
        return;
      }
    }

    const newAssignedToId = targetUser ? targetUser.id : null;
    const result = await prisma.order.updateMany({
      where: { id: { in: orderIds }, trashedAt: null },
      data: { assignedToId: newAssignedToId },
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name,
      action: 'ASSIGNMENT',
      entity: 'ORDER',
      entityId: orderIds.join(','),
      details: { action: 'BULK_ASSIGN', count: result.count, assignedToId: newAssignedToId, staffName: targetUser?.name || 'Unassigned' },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });

    res.json({
      success: true,
      count: result.count,
      message: `${result.count} order${result.count === 1 ? '' : 's'} ${targetUser ? `assigned to ${targetUser.name}` : 'unassigned'}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const bulkSetPriority = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orderIds = parseOrderIds(req.body);
    if (!orderIds) { res.status(400).json({ success: false, message: 'Select between 1 and 100 orders' }); return; }
    const { priority } = req.body;
    if (!['NORMAL', 'URGENT'].includes(String(priority))) {
      res.status(400).json({ success: false, message: 'Priority must be NORMAL or URGENT' });
      return;
    }

    const result = await prisma.order.updateMany({
      where: { id: { in: orderIds }, trashedAt: null },
      data: { priority },
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name,
      action: 'PRIORITY_CHANGE',
      entity: 'ORDER',
      entityId: orderIds.join(','),
      details: { action: 'BULK_PRIORITY', count: result.count, priority },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });

    res.json({
      success: true,
      count: result.count,
      message: `${result.count} order${result.count === 1 ? '' : 's'} marked as ${priority}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      customerName,
      customerPhone,
      customerAddress,
      district,
      city,
      zone,
      area,
      items,
      deliveryCharge = 0,
      discount = 0,
      advancePaid = 0,
      paymentMethod = 'COD',
      internalNote,
      customerNote,
      warehouseId,
      assignedToId,
    } = req.body;

    if (!customerName || !customerPhone || !items || !items.length) {
      res.status(400).json({
        success: false,
        message: 'Customer name, phone, and at least one item are required',
      });
      return;
    }
    if (!Array.isArray(items) || items.length > 50) { res.status(400).json({ success: false, message: 'An order can contain at most 50 items' }); return; }
    for (const item of items) {
      const quantity = Number(item.quantity || 1);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) { res.status(400).json({ success: false, message: 'Every item quantity must be between 1 and 100' }); return; }
      if (!item.productId) continue;
      const product = await prisma.product.findUnique({ where: { id: item.productId }, include: { variants: true } });
      if (!product || product.status === 'ARCHIVED') { res.status(409).json({ success: false, message: 'A selected product is no longer available' }); return; }
      const variant = item.variantId ? product.variants.find((entry) => entry.id === item.variantId && entry.status !== 'ARCHIVED') : null;
      if (item.variantId && !variant) { res.status(409).json({ success: false, message: 'A selected variation is no longer available' }); return; }
      const available = variant ? variant.stockQuantity : product.stockQuantity;
      if (available < quantity) { res.status(409).json({ success: false, message: `Only ${available} item(s) left for ${product.name}` }); return; }
    }

    let customer = await prisma.customer.findUnique({
      where: { phone: customerPhone },
    });

    let isFraudSuspect = false;
    let isDuplicate = false;

    if (customer) {
      if (customer.isBlacklisted || customer.riskScore > 60 || customer.returnedOrders > 2) {
        isFraudSuspect = true;
      }
      const recentOrders = await prisma.order.findMany({
        where: {
          customerPhone,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      });
      if (recentOrders.length > 0) {
        isDuplicate = true;
      }
    } else {
      customer = await prisma.customer.create({
        data: {
          name: customerName,
          phone: customerPhone,
          address: customerAddress,
          district,
          city,
          zone,
          area,
        },
      });
    }

    let subtotal = 0;
    let totalCogs = 0;

    const orderItemsData = [];

    for (const it of items) {
      const qty = it.quantity || 1;
      const unitP = it.unitPrice || 0;
      const unitBuy = it.unitBuyPrice || 0;
      const itemSub = qty * unitP;
      const itemCogs = qty * unitBuy;

      subtotal += itemSub;
      totalCogs += itemCogs;

      orderItemsData.push({
        productId: it.productId || null,
        variantId: it.variantId || null,
        productName: it.productName || 'Product',
        variantName: it.variantName || null,
        color: it.color || null,
        size: it.size || null,
        productSku: it.productSku || '',
        quantity: qty,
        unitPrice: unitP,
        unitBuyPrice: unitBuy,
        totalPrice: itemSub,
        totalBuyPrice: itemCogs,
      });

      if (it.variantId) {
        await prisma.productVariant.update({
          where: { id: it.variantId },
          data: { stockQuantity: { decrement: qty } },
        });
      }

      if (it.productId) {
        await prisma.product.update({
          where: { id: it.productId },
          data: { stockQuantity: { decrement: qty } },
        });

        await prisma.stockMovement.create({
          data: {
            productId: it.productId,
            variantId: it.variantId || null,
            warehouseId: warehouseId || null,
            type: 'SALE_DEDUCTION',
            quantity: -qty,
            previousStock: 0,
            currentStock: 0,
            note: `Order creation sale deduction`,
            createdById: req.user?.id,
          },
        });
      }
    }

    const grandTotal = Math.max(0, subtotal + Number(deliveryCharge) - Number(discount));
    const codAmount = Math.max(0, grandTotal - Number(advancePaid));

    const orderNumber = await getNextOrderNumber();

    const newOrder = await prisma.order.create({
      data: {
        orderNumber,
        customerId: customer.id,
        customerName,
        customerPhone,
        customerAddress: customerAddress || '',
        district,
        city,
        zone,
        area,
        status: 'PENDING',
        paymentMethod,
        paymentStatus: advancePaid >= grandTotal ? 'PAID' : advancePaid > 0 ? 'PARTIAL' : 'PENDING',
        subtotal,
        discount: Number(discount),
        deliveryCharge: Number(deliveryCharge),
        grandTotal,
        advancePaid: Number(advancePaid),
        codAmount,
        cogsCost: totalCogs,
        warehouseId,
        assignedToId,
        internalNote,
        customerNote,
        isFraudSuspect,
        isDuplicate,
        items: {
          create: orderItemsData,
        },
      },
      include: {
        items: true,
      },
    });

    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        totalOrders: { increment: 1 },
      },
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name,
      action: 'CREATE',
      entity: 'ORDER',
      entityId: newOrder.id,
      details: { orderNumber, grandTotal, itemsCount: items.length },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });

    try {
      await sendOrderNotification({
        eventTrigger: 'ORDER_PLACED',
        order: newOrder,
      });
    } catch (msgErr) {
      console.error(msgErr);
    }

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order: newOrder,
    });
  } catch (error: any) {
    res.status(error.status === 409 ? 409 : 500).json({ success: false, message: error.message });
  }
};

export const updateOrderStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { status, note } = req.body;

    const currentOrder = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!currentOrder) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }
    if (currentOrder.trashedAt) { res.status(409).json({ success: false, message: 'Restore this order from Trash before changing its status' }); return; }

    const allowedStatuses = new Set(['PENDING', 'CONFIRMED', 'PACKAGING', 'HANDED_OVER', 'IN_TRANSIT', 'DELIVERED', 'PARTIAL_DELIVERED', 'CANCELLED', 'RETURNED', 'HOLD', 'FAKE_TRASH']);
    if (!allowedStatuses.has(status)) { res.status(400).json({ success: false, message: 'Invalid order status' }); return; }
    if (currentOrder.status === status) { res.json({ success: true, message: 'Order status is unchanged', order: currentOrder }); return; }
    if (['CANCELLED', 'RETURNED'].includes(currentOrder.status)) {
      res.status(409).json({ success: false, message: 'A cancelled or returned order cannot be reopened because its stock has already been restored' });
      return;
    }

    if (currentOrder.status === 'DELIVERED' && status !== 'RETURNED') {
      res.status(409).json({ success: false, message: 'A delivered order can only move to Returned' });
      return;
    }
    const prevStatus = currentOrder.status;
    const updateData: any = { status };

    if (status === 'DELIVERED') {
      updateData.deliveredAt = new Date();
      updateData.paymentStatus = 'PAID';
      updateData.courierStatus = 'DELIVERED';
    } else if (status === 'CANCELLED') {
      updateData.cancelledAt = new Date();
    } else if (status === 'RETURNED') {
      updateData.returnedAt = new Date();
    }

    const updated = await prisma.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({ where: { id, status: currentOrder.status, trashedAt: null }, data: updateData });
      if (claimed.count !== 1) throw Object.assign(new Error('Order changed. Refresh before updating its status.'), { status: 409 });
      if (status === 'CANCELLED' || status === 'RETURNED') {
        for (const item of currentOrder.items) {
          if (!item.productId) continue;
          const restoredProduct = await tx.product.update({ where: { id: item.productId }, data: { stockQuantity: { increment: item.quantity } } });
          const restoredStock = item.variantId ? await tx.productVariant.update({ where: { id: item.variantId }, data: { stockQuantity: { increment: item.quantity } } }) : restoredProduct;
          await tx.stockMovement.create({ data: { productId: item.productId, variantId: item.variantId, warehouseId: currentOrder.warehouseId, type: 'RETURN_RESTOCK', quantity: item.quantity, previousStock: restoredStock.stockQuantity - item.quantity, currentStock: restoredStock.stockQuantity, note: `Stock restored after order ${status.toLowerCase()}`, createdById: req.user?.id } });
        }
      }
      if (currentOrder.customerId) {
        if (prevStatus === 'DELIVERED' && status === 'RETURNED') await tx.customer.update({ where: { id: currentOrder.customerId }, data: { completedOrders: { decrement: 1 }, totalSpent: { decrement: currentOrder.grandTotal } } });
        if (status === 'DELIVERED') await tx.customer.update({ where: { id: currentOrder.customerId }, data: { completedOrders: { increment: 1 }, totalSpent: { increment: currentOrder.grandTotal } } });
        if (status === 'CANCELLED') await tx.customer.update({ where: { id: currentOrder.customerId }, data: { cancelledOrders: { increment: 1 } } });
        if (status === 'RETURNED') await tx.customer.update({ where: { id: currentOrder.customerId }, data: { returnedOrders: { increment: 1 }, riskScore: { increment: 15 } } });
      }
      return tx.order.update({ where: { id }, data: updateData });
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name,
      action: 'STATUS_CHANGE',
      entity: 'ORDER',
      entityId: id,
      details: { from: prevStatus, to: status, note },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });

    try { await notifyOrderStatus(updated); }
    catch (notificationError) { console.error('Order status notification failed:', notificationError); }

    // Push status to WooCommerce if linked
    if (updated.wooOrderId) {
      try {
        const store = await prisma.wooCommerceStore.findFirst({ where: { isActive: true } });
        if (store) {
          const { WooCommerceService } = await import('../woocommerce/wooService');
          const woo = new WooCommerceService(store.storeUrl, revealSecret(store.consumerKey), revealSecret(store.consumerSecret));
          await woo.updateWooOrderStatus(updated.wooOrderId, status);
        }
      } catch (wooErr) {
        console.warn('WooCommerce status push warning:', wooErr);
      }
    }

    res.json({ success: true, message: `Order status updated to ${status}`, order: updated });
  } catch (error: any) {
    res.status(error.status === 409 ? 409 : 500).json({ success: false, message: error.message });
  }
};

export const bulkUpdateStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { orderIds, status } = req.body;

    if (!orderIds || !Array.isArray(orderIds) || !orderIds.length || !status) {
      res.status(400).json({ success: false, message: 'orderIds array and status are required' });
      return;
    }
    if (orderIds.length > 100) { res.status(400).json({ success: false, message: 'Update at most 100 orders at a time' }); return; }
    if (!['PENDING', 'CONFIRMED', 'PACKAGING', 'HANDED_OVER', 'IN_TRANSIT', 'HOLD'].includes(status)) {
      res.status(400).json({ success: false, message: 'Delivered, cancelled, and returned orders must be reviewed individually to keep stock and customer totals accurate' });
      return;
    }

    const selectedOrders = await prisma.order.findMany({
      where: { id: { in: orderIds }, trashedAt: null },
      select: { id: true, wooOrderId: true, status: true },
    });

    if (selectedOrders.length !== new Set(orderIds).size || selectedOrders.some((order) => ['DELIVERED', 'PARTIAL_DELIVERED', 'CANCELLED', 'RETURNED', 'FAKE_TRASH'].includes(order.status))) {
      res.status(409).json({ success: false, message: 'Select existing active orders only. Completed, cancelled, returned or trashed orders require individual review.' });
      return;
    }
    const result = await prisma.$transaction(async (tx) => {
      let count = 0;
      for (const order of selectedOrders) {
        const changed = await tx.order.updateMany({ where: { id: order.id, status: order.status, trashedAt: null }, data: { status } });
        if (changed.count !== 1) throw Object.assign(new Error('An order changed. Refresh before updating the batch.'), { status: 409 });
        count += changed.count;
      }
      return { count };
    });

    // Push to WooCommerce for linked orders
    const store = await prisma.wooCommerceStore.findFirst({ where: { isActive: true } });
    if (store) {
      const { WooCommerceService } = await import('../woocommerce/wooService');
      const woo = new WooCommerceService(store.storeUrl, revealSecret(store.consumerKey), revealSecret(store.consumerSecret));
      for (const ord of selectedOrders) {
        if (ord.wooOrderId) {
          try {
            await woo.updateWooOrderStatus(ord.wooOrderId, status);
          } catch (e) {}
        }
      }
    }

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name,
      action: 'STATUS_CHANGE',
      entity: 'ORDER',
      details: { count: orderIds.length, status, orderIds },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });

    res.json({
      success: true,
      message: `Successfully updated ${result.count} orders to ${status}`,
    });
  } catch (error: any) {
    res.status(error.status === 409 ? 409 : 500).json({ success: false, message: error.message });
  }
};
