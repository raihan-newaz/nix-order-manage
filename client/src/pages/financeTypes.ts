export type FinanceOverview = {
  range: { startDate: string; endDate: string; bucket: 'day' | 'month'; timezoneOffsetMinutes: number };
  metrics: {
    orderCount: number; deliveredCount: number; returnedCount: number; averageOrderValue: number; repeatCustomers: number;
    revenue: number; cogs: number; courierCost: number; returnCost: number; grossProfit: number; operatingExpenses: number;
    adSpend: number; netProfit: number; grossMargin: number; netMargin: number; roas: number | null;
    purchaseTotal: number; purchasePaid: number; purchaseDue: number; purchaseCount: number; accountBalance: number;
  };
  trend: Array<{ period: string; revenue: number; costs: number; expenses: number; ads: number; purchases: number; profit: number }>;
  breakdowns: {
    expensesByCategory: Array<{ name: string; amount: number }>;
    purchasesBySupplier: Array<{ name: string; amount: number }>;
    adsByPlatform: Array<{ name: string; amount: number }>;
    adsByCampaign: Array<{ name: string; amount: number }>;
    orderStatuses: Array<{ name: string; count: number }>;
    paymentMethods: Array<{ name: string; count: number; amount: number }>;
    topProducts: Array<{ name: string; quantity: number; revenue: number }>;
  };
  accounts: Array<{ id: string; name: string; type: string; balance: number }>;
  recentTransactions: Array<{ id: string; date: string; type: string; amount: number; account: string; note?: string }>;
};

export const amount = (value?: number | null) => `৳${Number(value || 0).toLocaleString('en-BD', { maximumFractionDigits: 2 })}`;
export const defaultFinanceRange = () => {
  const end = new Date(Date.now() + 360 * 60000);
  const start = new Date(end.getTime() - 29 * 86400000);
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10), timezoneOffsetMinutes: 360 };
};
