import React, { useState, useEffect } from 'react';
import { Customer } from '../types';
import api from '../lib/api';
import { Users, Search, History, X } from 'lucide-react';
import toast from 'react-hot-toast';

export const CrmPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/crm', { params: { search } });
      if (res.data?.success) {
        setCustomers(res.data.customers);
      }
    } catch (e) {
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => fetchCustomers(), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const openCustomerProfile = async (id: string) => {
    try {
      const res = await api.get(`/crm/${id}`);
      if (res.data?.success) {
        setSelectedCustomer(res.data.customer);
      }
    } catch (e) {
      toast.error('Failed to load customer profile');
    }
  };

  const handleToggleBlacklist = async (cust: Customer) => {
    try {
      const res = await api.put(`/crm/${cust.id}`, {
        isBlacklisted: !cust.isBlacklisted,
      });
      if (res.data?.success) {
        toast.success(cust.isBlacklisted ? 'Removed from blacklist' : 'Customer blacklisted');
        openCustomerProfile(cust.id);
        fetchCustomers();
      }
    } catch (e) {
      toast.error('Failed to update blacklist');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <Users className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            Customers
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Profiles, purchase history, and risk scores • nix.bd
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl shadow-sm">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search customers by name, phone, city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 pl-9 pr-4 py-2 rounded-xl focus:border-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 font-semibold uppercase">
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-3">Location</th>
                <th className="py-3 px-3 text-center">Orders</th>
                <th className="py-3 px-3 text-right">Lifetime Spent</th>
                <th className="py-3 px-3 text-center">Success Rate</th>
                <th className="py-3 px-3 text-center">Risk</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {customers.map((c) => {
                const isRisky = c.riskScore > 50 || c.returnedOrders > 1;
                return (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <span>{c.name}</span>
                        {c.isBlacklisted && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400">
                            BLACKLISTED
                          </span>
                        )}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 font-semibold text-[11px] mt-0.5">{c.phone}</div>
                    </td>

                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                      {c.city || 'Dhaka'} {c.district ? `(${c.district})` : ''}
                    </td>

                    <td className="py-3 px-3 text-center font-bold text-slate-800 dark:text-slate-200">
                      {c.totalOrders || 0}
                    </td>

                    <td className="py-3 px-3 text-right font-black text-emerald-600 dark:text-emerald-400">
                      {c.totalSpent?.toLocaleString() || 0} ৳
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span className="font-bold text-slate-800 dark:text-slate-200">{c.successRate || 100}%</span>
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isRisky
                            ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20'
                            : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
                        }`}
                      >
                        {isRisky ? 'HIGH RISK' : 'HEALTHY'}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => openCustomerProfile(c.id)}
                        className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-all"
                      >
                        View Profile
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Profile Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-xl text-slate-900 dark:text-slate-100">{selectedCustomer.name}</h3>
                  {selectedCustomer.isBlacklisted && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30">
                      BLACKLISTED
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  Phone: {selectedCustomer.phone} • Address: {selectedCustomer.address || 'Dhaka'}
                </p>
              </div>
              <button onClick={() => setSelectedCustomer(null)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                <span className="text-[10px] uppercase font-semibold text-slate-400">Total Spent</span>
                <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  {selectedCustomer.stats?.totalSpent?.toLocaleString() || 0} ৳
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                <span className="text-[10px] uppercase font-semibold text-slate-400">Orders Ratio</span>
                <p className="text-lg font-black text-slate-900 dark:text-slate-100 mt-1">
                  {selectedCustomer.stats?.completedOrders || 0} / {selectedCustomer.stats?.totalOrders || 0}
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                <span className="text-[10px] uppercase font-semibold text-slate-400">Returns / Cancel</span>
                <p className="text-lg font-black text-rose-600 dark:text-rose-400 mt-1">
                  {selectedCustomer.stats?.returnedOrders || 0} / {selectedCustomer.stats?.cancelledOrders || 0}
                </p>
              </div>
            </div>

            {/* Order History */}
            <div>
              <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-1.5">
                <History className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Customer Orders ({selectedCustomer.orders?.length || 0})
              </h4>
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-200 dark:divide-slate-800/60 max-h-48 overflow-y-auto">
                {selectedCustomer.orders && selectedCustomer.orders.length > 0 ? (
                  selectedCustomer.orders.map((ord: any) => (
                    <div key={ord.id} className="p-3 flex justify-between items-center text-xs">
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white">{ord.orderNumber}</span>
                        <p className="text-[11px] text-slate-400">{new Date(ord.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-900 dark:text-slate-100">{ord.grandTotal} ৳</span>
                        <div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              ord.status === 'DELIVERED'
                                ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                : ord.status === 'RETURNED'
                                ? 'bg-rose-100 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {ord.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-xs text-slate-400">No previous orders</div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => handleToggleBlacklist(selectedCustomer)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl border transition-colors ${
                  selectedCustomer.isBlacklisted
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700'
                    : 'bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/40'
                }`}
              >
                {selectedCustomer.isBlacklisted ? 'Remove Blacklist' : '⚠️ Blacklist Customer'}
              </button>

              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 text-xs font-semibold rounded-xl shadow transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
