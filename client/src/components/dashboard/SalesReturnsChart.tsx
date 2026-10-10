import React from 'react';
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface TrendItem {
  date: string;
  sales: number;
  returns?: number;
  orders?: number;
}

interface SalesReturnsChartProps {
  data: TrendItem[];
  totalSales: number | string;
  salesGrowth?: string;
  totalReturns: number | string;
  returnsChange?: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const salesVal = payload.find((p: any) => p.dataKey === 'sales')?.value || 0;
    const returnVal = payload.find((p: any) => p.dataKey === 'returns')?.value;
    return (
      <div className="rounded-xl border border-slate-100 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95">
        <p className="text-[11px] font-medium text-slate-400">{label}</p>
        <p className="mt-0.5 text-xs font-bold text-slate-900 sm:text-sm dark:text-white">
          {Number(salesVal).toLocaleString()} <span className="text-[11px] font-normal text-slate-500">sales</span>
        </p>
        {returnVal !== undefined && (
          <p className="text-[11px] font-medium text-slate-400">
            {Number(returnVal).toLocaleString()} <span className="text-[10px] font-normal">returns</span>
          </p>
        )}
      </div>
    );
  }
  return null;
};

export const SalesReturnsChart: React.FC<SalesReturnsChartProps> = ({
  data,
  totalSales,
  salesGrowth,
  totalReturns,
  returnsChange,
}) => {
  const formatYAxis = (val: number) => {
    if (val >= 1000) return `${Math.round(val / 1000)}k`;
    return `${val}`;
  };

  return (
    <div className="flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-slate-100/90 bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.02)] sm:p-5 lg:p-6 dark:border-slate-800 dark:bg-slate-900/90">
      {/* Header & Legends - Responsive wrap */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-900 sm:text-base dark:text-white">
            Sales & Returns
          </h3>
          <p className="mt-0.5 truncate text-[11px] text-slate-400 sm:text-xs dark:text-slate-500">
            Order revenue & return tracking across 7 days
          </p>
        </div>

        {/* Legends */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-4 text-xs">
          {/* Total Sales Legend */}
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
            <span className="text-[11px] text-slate-500 sm:text-xs dark:text-slate-400">Sales:</span>
            <span className="text-xs font-bold text-slate-900 sm:text-sm dark:text-white">{totalSales}</span>
            {salesGrowth && (
              <span className="rounded-full bg-emerald-50 px-1.5 py-0.2 text-[9px] font-semibold text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                {salesGrowth}
              </span>
            )}
          </div>

          {/* Returns Legend */}
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="h-2 w-2 shrink-0 rounded-full bg-slate-300 dark:bg-slate-600" />
            <span className="text-[11px] text-slate-500 sm:text-xs dark:text-slate-400">Returns:</span>
            <span className="text-xs font-bold text-slate-900 sm:text-sm dark:text-white">{totalReturns}</span>
            {returnsChange && (
              <span className="rounded-full bg-rose-50 px-1.5 py-0.2 text-[9px] font-semibold text-rose-500 dark:bg-rose-950/50 dark:text-rose-400">
                {returnsChange}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Chart Area */}
      <div className="mt-5 h-56 sm:h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="emeraldGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#f1f5f9" strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickFormatter={formatYAxis}
            />
            <Tooltip content={<CustomTooltip />} />
            
            <Area
              type="monotone"
              dataKey="sales"
              stroke="#10b981"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#emeraldGradient)"
              activeDot={{ r: 5, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }}
            />

            <Line
              type="monotone"
              dataKey="returns"
              stroke="#cbd5e1"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 4, fill: '#94a3b8' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
