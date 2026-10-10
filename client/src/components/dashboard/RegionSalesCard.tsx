import React from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';

export interface RegionRow {
  region: string;
  orders: number;
  revenue: number;
  trend?: 'up' | 'down';
}

interface RegionSalesCardProps {
  title?: string;
  regions: RegionRow[];
  currencySymbol?: string;
}

export const RegionSalesCard: React.FC<RegionSalesCardProps> = ({
  title = 'Sales by Region',
  regions,
  currencySymbol = '৳',
}) => {
  return (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-slate-100/90 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] sm:p-6 dark:border-slate-800 dark:bg-slate-900/90">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white">
        {title}
      </h3>

      <div className="mt-4 flex-1 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-medium text-slate-400 dark:border-slate-800">
              <th className="pb-2.5 font-normal">Region</th>
              <th className="pb-2.5 text-center font-normal">Orders</th>
              <th className="pb-2.5 text-right font-normal">Net Revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
            {regions.length > 0 ? (
              regions.map((row) => (
                <tr key={row.region} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="py-2.5 font-medium text-slate-700 dark:text-slate-300">
                    {row.region}
                  </td>
                  <td className="py-2.5 text-center font-semibold text-slate-800 dark:text-slate-200">
                    <span className="inline-flex items-center gap-1">
                      {row.orders}
                      {row.trend === 'down' ? (
                        <ArrowDown className="h-3 w-3 text-rose-500" />
                      ) : (
                        <ArrowUp className="h-3 w-3 text-emerald-500" />
                      )}
                    </span>
                  </td>
                  <td className="py-2.5 text-right font-semibold text-slate-900 dark:text-white">
                    {currencySymbol} {Number(row.revenue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="py-8 text-center text-xs text-slate-400">
                  No regional order data recorded yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
