import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, ReceiptText } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { MediaPicker } from '../components/MediaPicker';
import { amount } from './financeTypes';

type Category = { id: string; name: string; description?: string; isFixed: boolean };
type Account = { id: string; name: string; type: string; balance: number; isActive: boolean };
type Expense = { id: string; title: string; amount: number; date: string; recipient?: string; note?: string; receiptUrl?: string; paymentMethod: string; voidedAt?: string | null; voidReason?: string | null; category: Category; account: Account };
const card = 'rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900';
const field = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950';
const today = () => new Date().toISOString().slice(0, 10);

export const ExpensesPage = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState({ categoryId: '', accountId: '', startDate: '', endDate: '', voided: false });
  const [form, setForm] = useState({ title: '', amount: '', categoryId: '', accountId: '', date: today(), recipient: '', paymentMethod: 'CASH', note: '', receiptUrl: '' });
  const [categoryName, setCategoryName] = useState('');
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const loadOptions = async () => {
    const [cats, accs] = await Promise.all([api.get('/accounting/expense-categories'), api.get('/accounting/accounts')]);
    setCategories(cats.data.categories || []); setAccounts(accs.data.accounts || []);
  };
  const loadExpenses = async () => {
    setLoading(true);
    try { const { data } = await api.get('/accounting/expenses', { params: { page, limit: 20, ...filter, voided: filter.voided ? 'true' : undefined } }); setExpenses(data.expenses || []); setTotal(data.pagination?.total || 0); setTotalPages(data.pagination?.totalPages || 1); }
    catch { toast.error('Could not load expenses'); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadOptions().catch(() => toast.error('Could not load accounts or categories')); }, []);
  useEffect(() => { loadExpenses(); }, [page, filter]);
  const saveExpense = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true);
    try { await api.post('/accounting/expenses', { ...form, amount: Number(form.amount) }); toast.success('Expense saved and account balance updated'); setForm({ title: '', amount: '', categoryId: form.categoryId, accountId: form.accountId, date: today(), recipient: '', paymentMethod: 'CASH', note: '', receiptUrl: '' }); setPage(1); await Promise.all([loadExpenses(), loadOptions()]); }
    catch (error: any) { toast.error(error.response?.data?.message || 'Could not save expense'); }
    finally { setSaving(false); }
  };
  const saveCategory = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true);
    try { const { data } = await api.post('/accounting/expense-categories', { name: categoryName }); await loadOptions(); setForm((current) => ({ ...current, categoryId: data.category.id })); setCategoryName(''); setCategoryDialog(false); toast.success('Expense category added'); }
    catch (error: any) { toast.error(error.response?.data?.message || 'Could not add category'); }
    finally { setSaving(false); }
  };
  const voidEntry = async (expense: Expense) => {
    const reason = window.prompt(`Void “${expense.title}”? The payment will be reversed in ${expense.account.name}. Enter a reason:`);
    if (!reason) return;
    try { await api.post(`/accounting/expenses/${expense.id}/void`, { reason }); toast.success('Expense voided and account balance reversed'); await Promise.all([loadExpenses(), loadOptions()]); }
    catch (error: any) { toast.error(error.response?.data?.message || 'Could not void expense'); }
  };
  return <div className="space-y-5"><div><Link to="/accounting" className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><ArrowLeft size={14}/> Accounting</Link><h1 className="mt-2 text-2xl font-semibold tracking-tight">Expenses</h1><p className="mt-1 text-sm text-slate-500">Record business costs against a cash, bank or wallet account. Create categories to suit your operations.</p></div>
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]"><section className={card}><h2 className="font-semibold">Expense history</h2><div className="mt-4 flex flex-wrap gap-2"><select aria-label="Category filter" value={filter.categoryId} onChange={(event) => { setPage(1); setFilter({ ...filter, categoryId: event.target.value }); }} className={`${field} mt-0 max-w-44`}><option value="">All categories</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select aria-label="Account filter" value={filter.accountId} onChange={(event) => { setPage(1); setFilter({ ...filter, accountId: event.target.value }); }} className={`${field} mt-0 max-w-44`}><option value="">All accounts</option>{accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><input aria-label="From date" type="date" value={filter.startDate} onChange={(event) => { setPage(1); setFilter({ ...filter, startDate: event.target.value }); }} className={`${field} mt-0 max-w-40`}/><input aria-label="To date" type="date" value={filter.endDate} onChange={(event) => { setPage(1); setFilter({ ...filter, endDate: event.target.value }); }} className={`${field} mt-0 max-w-40`}/><label className="flex items-center gap-2 px-2 text-xs font-semibold"><input type="checkbox" checked={filter.voided} onChange={(event) => { setPage(1); setFilter({ ...filter, voided: event.target.checked }); }}/> Voided</label></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-700"><tr><th className="py-3">Date / title</th><th>Category</th><th>Account</th><th>Recipient</th><th className="text-right">Amount</th><th className="text-right">Action</th></tr></thead><tbody>{expenses.map((expense) => <tr key={expense.id} className="border-b border-slate-100 dark:border-slate-800"><td className="py-3"><b className="font-semibold">{expense.title}</b><small className="block text-slate-500">{new Date(expense.date).toLocaleDateString()} · {expense.paymentMethod}{expense.voidedAt ? ` · Voided: ${expense.voidReason || ''}` : ''}</small>{expense.receiptUrl && <a href={expense.receiptUrl} target="_blank" rel="noreferrer" className="text-xs text-emerald-700">View receipt</a>}</td><td>{expense.category?.name}</td><td>{expense.account?.name}</td><td className="text-slate-500">{expense.recipient || '—'}</td><td className="text-right font-semibold">{amount(expense.amount)}</td><td className="text-right">{!expense.voidedAt && <button type="button" onClick={() => voidEntry(expense)} className="rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-700">Void</button>}</td></tr>)}</tbody></table>{!loading && !expenses.length && <p className="py-8 text-center text-sm text-slate-500">No expenses match these filters.</p>}{loading && <p className="py-5 text-sm text-slate-500">Loading…</p>}</div><div className="mt-3 flex items-center justify-between border-t pt-3 text-xs text-slate-500"><span>{total} entries · page {page} of {totalPages}</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border p-2 disabled:opacity-40" aria-label="Previous page"><ChevronLeft size={15}/></button><button type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="rounded-lg border p-2 disabled:opacity-40" aria-label="Next page"><ChevronRight size={15}/></button></div></div></section>
    <section className={card}><div className="flex items-center gap-2"><ReceiptText size={18} className="text-emerald-600"/><h2 className="font-semibold">Add expense</h2></div><form onSubmit={saveExpense} className="mt-4 space-y-3"><label className="block text-xs font-semibold">Title<input required minLength={2} maxLength={160} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className={field} placeholder="Rent, packaging, utilities…"/></label><label className="block text-xs font-semibold">Amount (BDT)<input required type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} className={field}/></label><div className="flex items-end gap-2"><label className="min-w-0 flex-1 text-xs font-semibold">Category<select required value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })} className={field}><option value="">Choose category</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button type="button" onClick={() => setCategoryDialog(true)} className="rounded-xl border p-2.5" aria-label="Add category" title="Add category"><Plus size={17}/></button></div><label className="block text-xs font-semibold">Pay from account<select required value={form.accountId} onChange={(event) => setForm({ ...form, accountId: event.target.value })} className={field}><option value="">Choose account</option>{accounts.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.name} · {amount(item.balance)}</option>)}</select></label><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1"><label className="block text-xs font-semibold">Date<input required type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} className={field}/></label><label className="block text-xs font-semibold">Payment method<input value={form.paymentMethod} maxLength={40} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })} className={field} placeholder="Cash, bank, bKash…"/></label></div><label className="block text-xs font-semibold">Paid to (optional)<input value={form.recipient} maxLength={160} onChange={(event) => setForm({ ...form, recipient: event.target.value })} className={field}/></label><label className="block text-xs font-semibold">Note<textarea value={form.note} maxLength={2000} onChange={(event) => setForm({ ...form, note: event.target.value })} className={`${field} min-h-20`}/></label><div className="text-xs font-semibold">Receipt image (optional)<MediaPicker compact title="Select receipt image" value={form.receiptUrl ? [form.receiptUrl] : []} onChange={(urls) => setForm((current) => ({ ...current, receiptUrl: urls[0] || '' }))}/></div><button disabled={saving} className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Record expense'}</button></form></section></div>
    {categoryDialog && <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setCategoryDialog(false); }}><form onSubmit={saveCategory} className="w-full max-w-sm rounded-2xl bg-white p-6 dark:bg-slate-900"><h2 className="font-semibold">New expense category</h2><p className="mt-1 text-xs text-slate-500">Use categories that fit your business; they appear in analytics.</p><input autoFocus required minLength={2} maxLength={80} value={categoryName} onChange={(event) => setCategoryName(event.target.value)} className={field} placeholder="e.g. Office supplies"/><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setCategoryDialog(false)} className="rounded-lg border px-3 py-2 text-sm">Cancel</button><button disabled={saving} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Add category</button></div></form></div>}
  </div>;
};
