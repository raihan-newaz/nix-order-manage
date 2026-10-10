import React from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface MetricKpiCardProps {
  label: string;
  value: string;
  changePercent?: number | string;
  isPositive?: boolean;
  subtext: string;
  delay?: number;
}

export const MetricKpiCard: React.FC<MetricKpiCardProps> = ({
  label,
  value,
  changePercent,
  isPositive = true,
  subtext,
  delay = 0,
}) => {
  const percentText = changePercent !== undefined && changePercent !== null
    ? (typeof changePercent === 'number' ? `${changePercent > 0 ? '+' : ''}${changePercent}%` : changePercent)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-100/90 bg-white p-3.5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-all hover:shadow-[0_8px_24px_rgba(0,0,0,0.04)] sm:p-4.5 xl:p-5 dark:border-slate-800 dark:bg-slate-900/90"
    >
      {/* Top row: Label and optional Badge */}
      <div className="flex items-center justify-between gap-1.5 min-w-0">
        <span className="truncate text-xs font-medium text-slate-500 sm:text-sm dark:text-slate-400" title={label}>
          {label}
        </span>
        {percentText && (
          <span
            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold sm:px-2 sm:text-xs ${
              isPositive
                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'
                : 'bg-rose-50 text-rose-500 dark:bg-rose-950/50 dark:text-rose-400'
            }`}
          >
            {percentText}
          </span>
        )}
      </div>

      {/* Middle row: Big Value + Micro Trend Indicator */}
      <div className="mt-3 flex items-center justify-between gap-1 sm:mt-4 min-w-0">
        <h3
          className="truncate text-lg font-bold tracking-tight text-slate-900 sm:text-xl lg:text-lg xl:text-xl 2xl:text-2xl dark:text-white"
          title={value}
        >
          {value}
        </h3>
        <span
          className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] ${
            isPositive
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
              : 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300'
          }`}
        >
          {isPositive ? (
            <ArrowUpRight className="h-2.5 w-2.5" strokeWidth={3} />
          ) : (
            <ArrowDownRight className="h-2.5 w-2.5" strokeWidth={3} />
          )}
        </span>
      </div>

      {/* Bottom row: Subtext without awkward wrapping */}
      <p className="mt-1.5 truncate text-[11px] font-normal text-slate-400 sm:mt-2 sm:text-xs dark:text-slate-500" title={subtext}>
        {subtext}
      </p>
    </motion.div>
  );
};
