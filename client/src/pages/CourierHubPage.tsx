import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { Truck, DollarSign, RefreshCw, AlertTriangle, ChevronRight } from 'lucide-react';
import { SteadfastPanel } from '../components/couriers/SteadfastPanel';
import { RedXPanel } from '../components/couriers/RedXPanel';

export const CourierHubPage: React.FC = () => {
  const [reconciliation, setReconciliation] = useState<any>(null);
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const pathaoConfig = configs.find((entry) => entry.provider === 'PATHAO');
  const steadfastConfig = configs.find((entry) => entry.provider === 'STEADFAST');
  const redxConfig = configs.find((entry) => entry.provider === 'REDX');

  const fetchHubData = async () => {
    setLoading(true);
    try {
      const [recRes, confRes] = await Promise.all([
        api.get('/couriers/reconciliation'),
        api.get('/couriers/configs'),
      ]);
      if (recRes.data?.success) setReconciliation(recRes.data);
      if (confRes.data?.success) setConfigs(confRes.data.configs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHubData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <Truck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            Couriers
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Steadfast, Pathao & RedX delivery management & COD reconciliation • nix.bd
          </p>
        </div>

        <button
          onClick={fetchHubData}
          className="flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Courier Provider Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Steadfast */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
                SF
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Steadfast Courier</h3>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">{steadfastConfig?.isEnabled && steadfastConfig?.apiKey && steadfastConfig?.secretKey ? 'Ready to dispatch' : 'Setup required'}</p>
              </div>
            </div>
            <span className={`w-2.5 h-2.5 rounded-full ${steadfastConfig?.isEnabled && steadfastConfig?.apiKey && steadfastConfig?.secretKey ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
          </div>
          <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="flex justify-between">
              <span className="text-slate-400">Endpoint:</span>
              <span className="font-mono text-[11px]">portal.packzy.com/api/v1</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Coverage:</span>
              <span>All Bangladesh</span>
            </div>
          </div>
        </div>

        {/* Pathao */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold text-xs">
                PTH
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Pathao Courier</h3>
                <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">{pathaoConfig?.isEnabled && pathaoConfig?.storeId && pathaoConfig?.storeActive !== false ? 'Ready to dispatch' : 'Setup required'}</p>
              </div>
            </div>
            <span className={`w-2.5 h-2.5 rounded-full ${pathaoConfig?.isEnabled && pathaoConfig?.storeId && pathaoConfig?.storeActive !== false ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
          </div>
          <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="flex justify-between">
              <span className="text-slate-400">Endpoint:</span>
              <span className="font-mono text-[11px]">{pathaoConfig?.baseUrl?.replace('https://', '') || 'api-hermes.pathao.com'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">City / Zone:</span>
              <span>{pathaoConfig?.storeId ? `Pickup store #${pathaoConfig.storeId}` : 'Not selected'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Webhooks:</span>
              <span>{pathaoConfig?.webhookSecret && pathaoConfig?.webhookVerificationSecret ? 'Configured' : 'Setup required'}</span>
            </div>
          </div>
        </div>

        {/* RedX */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center font-bold text-xs">
                RDX
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">RedX Logistics</h3>
                <p className="text-[11px] text-red-600 dark:text-red-400 font-semibold">{redxConfig?.isEnabled && redxConfig?.apiKey ? 'Ready to dispatch' : 'Setup required'}</p>
              </div>
            </div>
            <span className={`w-2.5 h-2.5 rounded-full ${redxConfig?.isEnabled && redxConfig?.apiKey ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
          </div>
          <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="flex justify-between">
              <span className="text-slate-400">Endpoint:</span>
              <span className="font-mono text-[11px]">{redxConfig?.baseUrl?.replace('https://', '') || 'Not configured'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Service:</span>
              <span>Pickup & Delivery</span>
            </div>
          </div>
        </div>
      </div>

      {steadfastConfig?.isEnabled && <SteadfastPanel />}
      {redxConfig?.isEnabled && <RedXPanel />}

      {/* Courier Exception Queue: Real API Exception items requiring attention */}
      {reconciliation?.exceptions && reconciliation.exceptions.length > 0 && (
        <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-5 shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-amber-500 text-white">
                <AlertTriangle className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                  Courier Exception Queue ({reconciliation.exceptions.length})
                </h2>
                <p className="text-xs text-amber-700/80 dark:text-amber-300/80">
                  Parcels requiring status refresh or manual resolution before retry
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs bg-white dark:bg-slate-900 rounded-xl overflow-hidden border border-amber-200/60 dark:border-amber-800/30">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500 uppercase font-semibold">
                  <th className="p-3">Order #</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Courier</th>
                  <th className="p-3">Reason / Flag</th>
                  <th className="p-3">Next Action</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {reconciliation.exceptions.map((ex: any) => (
                  <tr key={ex.orderId} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                    <td className="p-3 font-bold text-slate-900 dark:text-white">
                      #{ex.orderNumber}
                    </td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">
                      {ex.customerName}
                    </td>
                    <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">
                      {ex.courierName}
                    </td>
                    <td className="p-3 text-amber-700 dark:text-amber-400 font-medium">
                      {ex.reason}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-700/40">
                        {ex.nextAction}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <Link
                        to={`/orders/${ex.orderId}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-sm transition-all"
                      >
                        Resolve in Order <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Courier collection ledger */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-card space-y-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Active Courier Parcels
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Recent active/unreconciled bookings: <span className="font-bold text-slate-900 dark:text-white">{reconciliation?.totalInTransitOrders || 0} parcels</span> • Expected Collection:{' '}
            <span className="font-bold text-emerald-600 dark:text-emerald-400">{reconciliation?.totalInTransitValue || 0} ৳</span>
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase font-semibold">
                <th className="pb-2.5">Order</th>
                <th className="pb-2.5">Customer</th>
                <th className="pb-2.5">Courier</th>
                <th className="pb-2.5">Tracking Code</th>
                <th className="pb-2.5 text-right">Expected COD</th>
                <th className="pb-2.5 text-right">Pathao reported</th>
                <th className="pb-2.5">Payment invoice</th>
                <th className="pb-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {reconciliation?.orders && reconciliation.orders.length > 0 ? (
                reconciliation.orders.map((o: any) => (
                  <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="py-2.5 font-bold text-slate-900 dark:text-white">{o.orderNumber}</td>
                    <td className="py-2.5 font-medium text-slate-900 dark:text-slate-200">
                      {o.customerName} ({o.customerPhone})
                    </td>
                    <td className="py-2.5 font-bold text-slate-700 dark:text-slate-300">{o.courierName}</td>
                    <td className="py-2.5 font-mono text-emerald-600 dark:text-emerald-400">{o.courierTrackingCode}</td>
                    <td className="py-2.5 text-right font-black text-emerald-600 dark:text-emerald-400">{Math.max(0, o.grandTotal - o.advancePaid)} ৳</td>
                    <td className="py-2.5 text-right font-semibold">{o.reportedCollectedAmount === undefined ? '—' : `${o.reportedCollectedAmount} ৳`}</td>
                    <td className="py-2.5 font-mono text-[11px]">{o.pathaoInvoiceId || '—'}</td>
                    <td className="py-2.5 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
                        {o.courierStatus || o.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-6 text-slate-400">
                    No active parcels currently in transit.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
