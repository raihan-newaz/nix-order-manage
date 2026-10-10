import { Request, Response } from 'express';
import prisma from '../../prisma';
import { AuthRequest } from '../../middlewares/auth';
import { logAudit } from '../audit/auditService';
import { z } from 'zod';

export const listAccounts = async (req: Request, res: Response): Promise<void> => {
  try {
    const accounts = await prisma.account.findMany({
      orderBy: { createdAt: 'asc' },
    });
    res.json({ success: true, accounts });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = z.object({ name: z.string().trim().min(2).max(100), type: z.string().trim().min(2).max(50), accountNumber: z.string().trim().max(80).optional(), bankName: z.string().trim().max(100).optional(), balance: z.coerce.number().finite().min(0).max(1000000000).default(0) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Invalid account' }); return; }
  try {
    const account = await prisma.$transaction(async (tx) => {
      const created = await tx.account.create({ data: parsed.data });
      if (created.balance > 0) await tx.transaction.create({ data: { accountId: created.id, type: 'OPENING_BALANCE', amount: created.balance, balanceAfter: created.balance, referenceType: 'MANUAL', note: 'Opening balance', createdById: req.user?.id } });
      return created;
    });

    res.status(201).json({ success: true, message: 'Account created', account });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const transferFunds = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { fromAccountId, toAccountId, amount, note } = req.body;
    const numAmount = Number(amount);

    if (!fromAccountId || !toAccountId || fromAccountId === toAccountId || !Number.isFinite(numAmount) || numAmount <= 0) {
      res.status(400).json({ success: false, message: 'Valid from, to accounts and positive amount required' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      const [fromAcc, toAcc] = await Promise.all([tx.account.findUnique({ where: { id: fromAccountId } }), tx.account.findUnique({ where: { id: toAccountId } })]);
      if (!fromAcc?.isActive || !toAcc?.isActive) throw Object.assign(new Error('Select two active accounts'), { status: 400 });
      const debited = await tx.account.updateMany({ where: { id: fromAccountId, balance: { gte: numAmount } }, data: { balance: { decrement: numAmount } } });
      if (!debited.count) throw Object.assign(new Error('Insufficient balance in source account'), { status: 400 });
      const [fromUpdated, toUpdated] = await Promise.all([tx.account.findUniqueOrThrow({ where: { id: fromAccountId } }), tx.account.update({ where: { id: toAccountId }, data: { balance: { increment: numAmount } } })]);
      await tx.transaction.createMany({ data: [
        { accountId: fromAccountId, type: 'TRANSFER_OUT', amount: numAmount, balanceAfter: fromUpdated.balance, referenceType: 'MANUAL', note: `Transfer to ${toAcc.name}: ${String(note || '').slice(0, 300)}`, createdById: req.user?.id },
        { accountId: toAccountId, type: 'TRANSFER_IN', amount: numAmount, balanceAfter: toUpdated.balance, referenceType: 'MANUAL', note: `Transfer from ${fromAcc.name}: ${String(note || '').slice(0, 300)}`, createdById: req.user?.id },
      ] });
    });

    res.json({ success: true, message: `Successfully transferred ${numAmount} BDT` });
  } catch (error: any) {
    res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Could not transfer funds' });
  }
};

export const listExpenseCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const categories = await prisma.expenseCategory.findMany({
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, categories });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createExpenseCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = z.object({ name: z.string().trim().min(2).max(80), description: z.string().trim().max(300).optional(), isFixed: z.boolean().optional() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Invalid category' }); return; }
  try { const category = await prisma.expenseCategory.create({ data: parsed.data }); res.status(201).json({ success: true, category }); }
  catch (error: any) { res.status(error.code === 'P2002' ? 409 : 500).json({ success: false, message: error.code === 'P2002' ? 'This category already exists' : 'Could not create category' }); }
};

export const listExpenses = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const where: any = { voidedAt: req.query.voided === 'true' ? { not: null } : null };
    if (req.query.categoryId) where.categoryId = String(req.query.categoryId);
    if (req.query.accountId) where.accountId = String(req.query.accountId);
    if (req.query.startDate || req.query.endDate) where.date = { ...(req.query.startDate ? { gte: new Date(String(req.query.startDate)) } : {}), ...(req.query.endDate ? { lte: new Date(`${String(req.query.endDate)}T23:59:59.999Z`) } : {}) };
    const total = await prisma.expense.count({ where });
    const expenses = await prisma.expense.findMany({
      where,
      include: {
        category: true,
        account: true,
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
    res.json({ success: true, expenses, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createExpense = async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = z.object({ categoryId: z.string().uuid(), accountId: z.string().uuid(), title: z.string().trim().min(2).max(160), amount: z.coerce.number().finite().positive().max(1000000000), recipient: z.string().trim().max(160).optional(), note: z.string().trim().max(2000).optional(), date: z.string().optional(), paymentMethod: z.string().trim().max(40).optional(), receiptUrl: z.string().trim().max(500).refine((value) => !value || value.startsWith('/') && !value.startsWith('//') || /^https:\/\//i.test(value), 'Use a saved media image or HTTPS URL').optional() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Invalid expense' }); return; }
  try {
    const { categoryId, accountId, title, amount, recipient, note, date, paymentMethod, receiptUrl } = parsed.data;
    const expenseDate = date ? new Date(date) : new Date();
    if (Number.isNaN(expenseDate.getTime())) { res.status(400).json({ success: false, message: 'Invalid expense date' }); return; }
    const expense = await prisma.$transaction(async (tx) => {
      const [category, account] = await Promise.all([tx.expenseCategory.findUnique({ where: { id: categoryId } }), tx.account.findUnique({ where: { id: accountId } })]);
      if (!category || !account?.isActive) throw Object.assign(new Error('Select an active account and expense category'), { status: 400 });
      const updated = await tx.account.update({ where: { id: accountId }, data: { balance: { decrement: amount } } });
      const created = await tx.expense.create({ data: { categoryId, accountId, title, amount, date: expenseDate, recipient, note, paymentMethod: paymentMethod || 'CASH', receiptUrl, createdById: req.user?.id }, include: { category: true, account: true } });
      await tx.transaction.create({ data: { accountId, type: 'EXPENSE', amount, balanceAfter: updated.balance, referenceType: 'EXPENSE', referenceId: created.id, note: `Expense: ${title} (${category.name})`, createdById: req.user?.id, date: expenseDate } });
      return created;
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name,
      action: 'CREATE',
      entity: 'EXPENSE',
      entityId: expense.id,
      details: { title, amount, category: expense.category.name },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({ success: true, message: 'Expense recorded successfully', expense });
  } catch (error: any) {
    res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Could not record expense' });
  }
};

export const voidExpense = async (req: AuthRequest, res: Response): Promise<void> => {
  const reason = String(req.body?.reason || '').trim();
  if (reason.length < 3 || reason.length > 300) { res.status(400).json({ success: false, message: 'Add a short reason (3–300 characters)' }); return; }
  try {
    const expense = await prisma.$transaction(async (tx) => {
      const original = await tx.expense.findUnique({ where: { id: String(req.params.id) } });
      if (!original || original.voidedAt) throw Object.assign(new Error('Expense not found or already voided'), { status: 404 });
      const result = await tx.expense.updateMany({ where: { id: original.id, voidedAt: null }, data: { voidedAt: new Date(), voidReason: reason } });
      if (!result.count) throw Object.assign(new Error('Expense already voided'), { status: 409 });
      const account = await tx.account.update({ where: { id: original.accountId }, data: { balance: { increment: original.amount } } });
      await tx.transaction.create({ data: { accountId: original.accountId, type: 'EXPENSE_REVERSAL', amount: original.amount, balanceAfter: account.balance, referenceType: 'EXPENSE', referenceId: original.id, note: `Void expense: ${reason}`, createdById: req.user?.id } });
      return tx.expense.findUniqueOrThrow({ where: { id: original.id }, include: { category: true, account: true } });
    });
    await logAudit({ userId: req.user?.id, userName: req.user?.name, action: 'UPDATE', entity: 'EXPENSE', entityId: expense.id, details: { voided: true, reason }, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true, expense });
  } catch (error: any) { res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Could not void expense' }); }
};

export const listAdCosts = async (req: Request, res: Response): Promise<void> => {
  try {
    const adCosts = await prisma.adCost.findMany({
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: { date: 'desc' },
    });
    res.json({ success: true, adCosts });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createAdCost = async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = z.object({ platform: z.string().trim().min(2).max(80), campaignName: z.string().trim().min(2).max(160), amount: z.coerce.number().finite().positive().max(1000000000), currency: z.string().trim().min(3).max(3).default('BDT'), exchangeRate: z.coerce.number().finite().positive().max(1000000).default(1), date: z.string().optional(), impressions: z.coerce.number().int().nonnegative().optional(), clicks: z.coerce.number().int().nonnegative().optional(), ordersGenerated: z.coerce.number().int().nonnegative().optional(), notes: z.string().trim().max(2000).optional(), accountId: z.string().uuid().optional() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Invalid ad spend' }); return; }
  try {
    const { platform, campaignName, amount, currency, exchangeRate, date, impressions, clicks, ordersGenerated, notes, accountId } = parsed.data;
    const spentAt = date ? new Date(date) : new Date();
    if (Number.isNaN(spentAt.getTime())) { res.status(400).json({ success: false, message: 'Invalid ad spend date' }); return; }
    const bdtAmount = Math.round((currency.toUpperCase() === 'BDT' ? amount : amount * exchangeRate) * 100) / 100;
    const adCost = await prisma.$transaction(async (tx) => {
      if (accountId) { const account = await tx.account.findUnique({ where: { id: accountId } }); if (!account?.isActive) throw Object.assign(new Error('Select an active payment account'), { status: 400 }); }
      const created = await tx.adCost.create({ data: { platform, campaignName, amount, currency: currency.toUpperCase(), exchangeRate: currency.toUpperCase() === 'BDT' ? 1 : exchangeRate, bdtAmount, date: spentAt, impressions, clicks, ordersGenerated, cpa: ordersGenerated ? Math.round(bdtAmount / ordersGenerated * 100) / 100 : null, notes, accountId, createdById: req.user?.id } });
      if (accountId) { const updated = await tx.account.update({ where: { id: accountId }, data: { balance: { decrement: bdtAmount } } }); await tx.transaction.create({ data: { accountId, type: 'AD_COST', amount: bdtAmount, balanceAfter: updated.balance, referenceType: 'AD_COST', referenceId: created.id, note: `Ad spend: ${platform} · ${campaignName}`, createdById: req.user?.id, date: spentAt } }); }
      return created;
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name,
      action: 'CREATE',
      entity: 'AD_COST',
      entityId: adCost.id,
      details: { platform, campaignName, bdtAmount },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({ success: true, message: 'Ad spend recorded', adCost });
  } catch (error: any) {
    res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Could not record ad spend' });
  }
};

export const getProfitLossStatement = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter: any = {};
    if (startDate && endDate) {
      dateFilter.createdAt = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    // 1. Delivered Revenue & COGS
    const deliveredOrders = await prisma.order.findMany({
      where: {
        status: 'DELIVERED',
        ...dateFilter,
      },
      select: {
        grandTotal: true,
        cogsCost: true,
        deliveryCharge: true,
        courierCharge: true,
      },
    });

    const totalDeliveredRevenue = deliveredOrders.reduce((s, o) => s + o.grandTotal, 0);
    const totalDeliveredCogs = deliveredOrders.reduce((s, o) => s + o.cogsCost, 0);
    const totalDeliveredCourierCharges = deliveredOrders.reduce((s, o) => s + o.courierCharge, 0);

    // 2. Returned Orders Loss
    const returnedOrders = await prisma.order.findMany({
      where: {
        status: 'RETURNED',
        ...dateFilter,
      },
      select: {
        courierCharge: true,
        courierReturnCharge: true,
      },
    });

    const totalReturnCourierLoss = returnedOrders.reduce(
      (s, o) => s + (o.courierCharge + (o.courierReturnCharge || 40)),
      0
    );

    // 3. Ad Spend
    const adFilter: any = {};
    if (startDate && endDate) {
      adFilter.date = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    const adCosts = await prisma.adCost.findMany({ where: adFilter });
    const totalAdSpend = adCosts.reduce((s, a) => s + a.bdtAmount, 0);

    // 4. Operating Expenses
    const expenseFilter: any = {};
    if (startDate && endDate) {
      expenseFilter.date = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    const expenses = await prisma.expense.findMany({
      where: { ...expenseFilter, voidedAt: null },
      include: { category: true },
    });

    const totalOperatingExpenses = expenses.reduce((s, e) => s + e.amount, 0);

    // 5. Calculations
    const grossProfit = totalDeliveredRevenue - totalDeliveredCogs - totalDeliveredCourierCharges - totalReturnCourierLoss;
    const netProfit = grossProfit - totalAdSpend - totalOperatingExpenses;
    const netMarginPercent = totalDeliveredRevenue > 0 ? (netProfit / totalDeliveredRevenue) * 100 : 0;
    const roas = totalAdSpend > 0 ? totalDeliveredRevenue / totalAdSpend : 0;

    res.json({
      success: true,
      data: {
        deliveredOrdersCount: deliveredOrders.length,
        returnedOrdersCount: returnedOrders.length,
        totalDeliveredRevenue,
        totalDeliveredCogs,
        totalDeliveredCourierCharges,
        totalReturnCourierLoss,
        grossProfit,
        totalAdSpend,
        totalOperatingExpenses,
        netProfit,
        netMarginPercent: Math.round(netMarginPercent * 10) / 10,
        roas: Math.round(roas * 100) / 100,
        expensesByCategory: expenses.reduce((acc: any, exp) => {
          const catName = exp.category.name;
          acc[catName] = (acc[catName] || 0) + exp.amount;
          return acc;
        }, {}),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
