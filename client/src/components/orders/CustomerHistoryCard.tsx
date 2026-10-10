import { Link } from 'react-router-dom';

export type CustomerHistory = {
  totalPrevious: number; completed: number; cancelled: number; returned: number; partial: number; lifetimeSpent: number;
  recentOrders: Array<{ id: string; orderNumber: string; createdAt: string; status: string; grandTotal: number; items: Array<{ productName: string; quantity: number }> }>;
};

export function CustomerHistoryCard({ history }: { history: CustomerHistory | null }) {
  if (!history) return null;
  const outcomes = history.completed + history.cancelled + history.returned + history.partial;
  const completion = outcomes ? Math.round((history.completed / outcomes) * 100) : null;
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
    <div><h3 className="text-base font-semibold">Customer purchase history</h3><p className="mt-1 text-xs text-slate-500">Previous orders with this customer account or phone number. Use as context, not an automatic fraud verdict.</p></div>
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {[['Previous orders', history.totalPrevious], ['Delivered', history.completed], ['Returns / cancellations', history.returned + history.cancelled], ['Delivered value', `৳${history.lifetimeSpent.toLocaleString()}`]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><p className="text-[11px] text-slate-500">{label}</p><p className="mt-1 text-base font-semibold">{value}</p></div>)}
    </div>
    {completion !== null && <p className="mt-3 text-xs text-slate-500">Completed {completion}% of previous resolved orders. {history.partial} partially delivered.</p>}
    {history.recentOrders.length ? <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">{history.recentOrders.map(item => <Link key={item.id} to={`/orders/${item.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm hover:text-emerald-600"><span><span className="font-medium">{item.orderNumber}</span><span className="ml-2 text-xs text-slate-500">{new Date(item.createdAt).toLocaleDateString()} · {item.items.map(product => `${product.productName} ×${product.quantity}`).join(', ')}</span></span><span className="text-xs">{item.status.replace(/_/g, ' ')} · ৳{item.grandTotal.toLocaleString()}</span></Link>)}</div> : <p className="mt-4 text-sm text-slate-500">No previous orders found.</p>}
  </section>;
}
