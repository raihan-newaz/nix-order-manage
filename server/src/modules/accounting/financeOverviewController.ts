import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../prisma';

const querySchema = z.object({ startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), timezoneOffsetMinutes: z.coerce.number().int().min(-720).max(840).default(360) });
const sum = (values: number[]) => Math.round(values.reduce((total, value) => total + value, 0) * 100) / 100;
const ratio = (part: number, total: number) => total ? Math.round(part / total * 1000) / 10 : 0;

export const getFinanceOverview = async (req: Request, res: Response): Promise<void> => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ success: false, message: 'Use YYYY-MM-DD dates' }); return; }
  const now = new Date();
  const offsetMs = parsed.data.timezoneOffsetMinutes * 60000;
  const localToday = new Date(now.getTime() + offsetMs).toISOString().slice(0, 10);
  const localDate = (value: string) => new Date(new Date(`${value}T00:00:00.000Z`).getTime() - offsetMs);
  const defaultStart = new Date(localDate(localToday).getTime() - 29 * 86400000);
  const start = parsed.data.startDate ? localDate(parsed.data.startDate) : defaultStart;
  const end = parsed.data.endDate ? localDate(parsed.data.endDate) : localDate(localToday);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start || (end.getTime() - start.getTime()) / 86400000 > 730) { res.status(400).json({ success: false, message: 'Choose a valid range of up to two years' }); return; }
  const endExclusive = new Date(end.getTime() + 86400000);
  const date = { gte: start, lt: endExclusive };
  const deliveredWhere: any = { status: 'DELIVERED', trashedAt: null, OR: [{ deliveredAt: date }, { deliveredAt: null, createdAt: date }] };
  const returnedWhere: any = { status: 'RETURNED', trashedAt: null, OR: [{ returnedAt: date }, { returnedAt: null, createdAt: date }] };
  try {
    const [orders, delivered, returned, expenses, ads, purchases, accounts, transactions, topProducts, orderStatuses, paymentMethods] = await Promise.all([
      prisma.order.findMany({ where: { createdAt: date, trashedAt: null }, select: { id: true, status: true, grandTotal: true, paymentMethod: true, customerPhone: true } }),
      prisma.order.findMany({ where: deliveredWhere, select: { id: true, grandTotal: true, cogsCost: true, courierCharge: true, deliveredAt: true, createdAt: true } }),
      prisma.order.findMany({ where: returnedWhere, select: { courierCharge: true, courierReturnCharge: true, returnedAt: true, createdAt: true } }),
      prisma.expense.findMany({ where: { date, voidedAt: null }, select: { amount: true, date: true, category: { select: { name: true } } } }),
      prisma.adCost.findMany({ where: { date }, select: { bdtAmount: true, date: true, platform: true, campaignName: true, ordersGenerated: true } }),
      prisma.purchaseOrder.findMany({ where: { purchaseDate: date, status: { not: 'CANCELLED' } }, select: { grandTotal: true, paidAmount: true, dueAmount: true, purchaseDate: true, supplier: { select: { name: true } } } }),
      prisma.account.findMany({ where: { isActive: true }, select: { id: true, name: true, type: true, balance: true } }),
      prisma.transaction.findMany({ orderBy: { date: 'desc' }, take: 15, include: { account: { select: { name: true } } } }),
      prisma.orderItem.groupBy({ by: ['productName'], where: { order: deliveredWhere }, _sum: { quantity: true, totalPrice: true }, orderBy: { _sum: { totalPrice: 'desc' } }, take: 10 }),
      prisma.order.groupBy({ by: ['status'], where: { createdAt: date, trashedAt: null }, _count: { _all: true } }),
      prisma.order.groupBy({ by: ['paymentMethod'], where: { createdAt: date, trashedAt: null }, _count: { _all: true }, _sum: { grandTotal: true } }),
    ]);
    const revenue = sum(delivered.map((order) => order.grandTotal));
    const cogs = sum(delivered.map((order) => order.cogsCost));
    const courierCost = sum(delivered.map((order) => order.courierCharge));
    const returnCost = sum(returned.map((order) => order.courierCharge + order.courierReturnCharge));
    const operatingExpenses = sum(expenses.map((expense) => expense.amount));
    const adSpend = sum(ads.map((ad) => ad.bdtAmount));
    const grossProfit = Math.round((revenue - cogs - courierCost - returnCost) * 100) / 100;
    const netProfit = Math.round((grossProfit - operatingExpenses - adSpend) * 100) / 100;
    const bucketByMonth = (end.getTime() - start.getTime()) / 86400000 > 90;
    const bucket = (value: Date) => new Date(value.getTime() + offsetMs).toISOString().slice(0, bucketByMonth ? 7 : 10);
    const trend = new Map<string, { period: string; revenue: number; costs: number; expenses: number; ads: number; purchases: number; profit: number }>();
    const addTrend = (when: Date, field: 'revenue' | 'costs' | 'expenses' | 'ads' | 'purchases', amount: number) => { const key = bucket(when); const row = trend.get(key) || { period: key, revenue: 0, costs: 0, expenses: 0, ads: 0, purchases: 0, profit: 0 }; row[field] += amount; trend.set(key, row); };
    delivered.forEach((order) => { const when = order.deliveredAt || order.createdAt; addTrend(when, 'revenue', order.grandTotal); addTrend(when, 'costs', order.cogsCost + order.courierCharge); });
    returned.forEach((order) => addTrend(order.returnedAt || order.createdAt, 'costs', order.courierCharge + order.courierReturnCharge));
    expenses.forEach((expense) => addTrend(expense.date, 'expenses', expense.amount));
    ads.forEach((ad) => addTrend(ad.date, 'ads', ad.bdtAmount));
    purchases.forEach((purchase) => addTrend(purchase.purchaseDate, 'purchases', purchase.grandTotal));
    const categoryTotals = new Map<string, number>();
    expenses.forEach((expense) => categoryTotals.set(expense.category.name, (categoryTotals.get(expense.category.name) || 0) + expense.amount));
    const supplierTotals = new Map<string, number>();
    purchases.forEach((purchase) => supplierTotals.set(purchase.supplier.name, (supplierTotals.get(purchase.supplier.name) || 0) + purchase.grandTotal));
    const platformTotals = new Map<string, number>();
    const campaignTotals = new Map<string, number>();
    ads.forEach((ad) => { platformTotals.set(ad.platform, (platformTotals.get(ad.platform) || 0) + ad.bdtAmount); campaignTotals.set(`${ad.platform} · ${ad.campaignName}`, (campaignTotals.get(`${ad.platform} · ${ad.campaignName}`) || 0) + ad.bdtAmount); });
    const customerCounts = new Map<string, number>();
    orders.forEach((order) => customerCounts.set(order.customerPhone, (customerCounts.get(order.customerPhone) || 0) + 1));
    const trendRows = [...trend.values()].sort((a, b) => a.period.localeCompare(b.period)).map((row) => ({ ...row, revenue: Math.round(row.revenue), costs: Math.round(row.costs), expenses: Math.round(row.expenses), ads: Math.round(row.ads), purchases: Math.round(row.purchases), profit: Math.round(row.revenue - row.costs - row.expenses - row.ads) }));
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.json({ success: true, range: { startDate: new Date(start.getTime() + offsetMs).toISOString().slice(0, 10), endDate: new Date(end.getTime() + offsetMs).toISOString().slice(0, 10), bucket: bucketByMonth ? 'month' : 'day', timezoneOffsetMinutes: parsed.data.timezoneOffsetMinutes },
      metrics: { orderCount: orders.length, deliveredCount: delivered.length, returnedCount: returned.length, averageOrderValue: orders.length ? sum(orders.map((order) => order.grandTotal)) / orders.length : 0, repeatCustomers: [...customerCounts.values()].filter((count) => count > 1).length, revenue, cogs, courierCost, returnCost, grossProfit, operatingExpenses, adSpend, netProfit, grossMargin: ratio(grossProfit, revenue), netMargin: ratio(netProfit, revenue), roas: adSpend ? Math.round(revenue / adSpend * 100) / 100 : null, purchaseTotal: sum(purchases.map((purchase) => purchase.grandTotal)), purchasePaid: sum(purchases.map((purchase) => purchase.paidAmount)), purchaseDue: sum(purchases.map((purchase) => purchase.dueAmount)), purchaseCount: purchases.length, accountBalance: sum(accounts.map((account) => account.balance)) },
      trend: trendRows,
      breakdowns: { expensesByCategory: [...categoryTotals].map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100 })).sort((a, b) => b.amount - a.amount), purchasesBySupplier: [...supplierTotals].map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100 })).sort((a, b) => b.amount - a.amount), adsByPlatform: [...platformTotals].map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100 })).sort((a, b) => b.amount - a.amount), adsByCampaign: [...campaignTotals].map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100 })).sort((a, b) => b.amount - a.amount).slice(0, 10), orderStatuses: orderStatuses.map((row) => ({ name: row.status, count: row._count._all })), paymentMethods: paymentMethods.map((row) => ({ name: row.paymentMethod, count: row._count._all, amount: row._sum.grandTotal || 0 })), topProducts: topProducts.map((row) => ({ name: row.productName, quantity: row._sum.quantity || 0, revenue: row._sum.totalPrice || 0 })) },
      accounts, recentTransactions: transactions.map((entry) => ({ id: entry.id, date: entry.date, type: entry.type, amount: entry.amount, account: entry.account.name, note: entry.note })) });
  } catch (error: any) { res.status(500).json({ success: false, message: 'Could not calculate finance overview' }); }
};
