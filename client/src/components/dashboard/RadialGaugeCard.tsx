import React from 'react';

interface RadialGaugeCardProps {
  title?: string;
  value: number | string;
  valueLabel?: string;
  totalValue: number | string;
  totalLabel?: string;
  percentage?: number; // 0 to 100
}

export const RadialGaugeCard: React.FC<RadialGaugeCardProps> = ({
  title = 'Fulfillment Health',
  value = 0,
  valueLabel = 'Delivered Orders',
  totalValue = 0,
  totalLabel = 'Total Orders',
  percentage = 0,
}) => {
  const radius = 70;
  const strokeWidth = 10;
  const circumference = Math.PI * radius;
  const validPercent = Math.max(0, Math.min(100, Number(percentage) || 0));
  const strokeDashoffset = circumference - (validPercent / 100) * circumference;

  return (
    <div className="flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-slate-100/90 bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.02)] sm:p-5 lg:p-6 dark:border-slate-800 dark:bg-slate-900/90">
      <div className="flex items-center justify-between">
        <h3 className="truncate text-sm font-semibold text-slate-900 sm:text-base dark:text-white">
          {title}
        </h3>
        <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 sm:text-xs dark:bg-emerald-950/50 dark:text-emerald-400">
          {validPercent}% Rate
        </span>
      </div>

      {/* Semi-circle Gauge Center */}
      <div className="relative my-3 flex flex-col items-center justify-center">
        <svg
          viewBox="0 0 160 95"
          className="w-40 sm:w-48 overflow-visible"
        >
          {/* Background Track */}
          <path
            d="M 10 85 A 70 70 0 0 1 150 85"
            fill="none"
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className="dark:stroke-slate-800"
          />
          {/* Progress Arc */}
          <path
            d="M 10 85 A 70 70 0 0 1 150 85"
            fill="none"
            stroke="#10b981"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        {/* Center Numbers */}
        <div className="absolute bottom-1.5 flex flex-col items-center">
          <span className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white">
            {Number(value).toLocaleString()}
          </span>
          <span className="truncate text-[10px] text-slate-400 sm:text-xs dark:text-slate-500">
            {valueLabel}
          </span>
        </div>
      </div>

      {/* Footer Details */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-500 sm:text-xs dark:border-slate-800 dark:text-slate-400">
        <span className="truncate">{totalLabel}</span>
        <span className="shrink-0 font-semibold text-slate-900 dark:text-white">
          {Number(totalValue).toLocaleString()}
        </span>
      </div>
    </div>
  );
};
