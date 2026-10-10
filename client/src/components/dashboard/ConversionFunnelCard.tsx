import React from 'react';

interface FunnelStep {
  stage: string;
  count: number;
  percentage: number;
}

interface ConversionFunnelCardProps {
  conversionRate?: number;
  rateChange?: string;
  steps: FunnelStep[];
}

export const ConversionFunnelCard: React.FC<ConversionFunnelCardProps> = ({
  conversionRate = 0,
  rateChange,
  steps,
}) => {
  return (
    <div className="flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-slate-100/90 bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.02)] sm:p-5 lg:p-6 dark:border-slate-800 dark:bg-slate-900/90">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-900 sm:text-base dark:text-white">
            Sales conversion
          </h3>
          <p className="mt-0.5 truncate text-[11px] text-slate-400 sm:text-xs dark:text-slate-500">
            Pipeline from placed to delivered
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-[10px] font-medium text-slate-400 sm:text-[11px]">Conversion</p>
          <div className="mt-0.5 flex items-center justify-end gap-1.5">
            <span className="text-base font-bold text-slate-900 sm:text-lg dark:text-white">
              {conversionRate}%
            </span>
            {rateChange && (
              <span className="rounded-full bg-emerald-50 px-1.5 py-0.2 text-[9px] font-semibold text-emerald-600 sm:text-[10px] dark:bg-emerald-950/50 dark:text-emerald-400">
                {rateChange}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stepped Pill Bars Funnel */}
      <div className="mt-5 flex h-48 sm:h-52 items-end justify-between gap-2 sm:gap-4">
        {steps.map((step, idx) => {
          const isFinal = idx === steps.length - 1;
          const barHeightPercent = Math.max(16, Math.min(100, step.percentage));

          return (
            <div key={step.stage} className="flex flex-1 flex-col items-center justify-end h-full min-w-0">
              <span className="mb-1.5 text-[10px] font-medium text-slate-500 sm:text-xs dark:text-slate-400">
                {step.percentage}%
              </span>

              <div className="w-full max-w-[40px] sm:max-w-[48px] rounded-full bg-slate-50 p-1 dark:bg-slate-800/40">
                <div
                  className={`w-full rounded-full transition-all duration-500 ${
                    isFinal
                      ? 'bg-emerald-500 shadow-sm shadow-emerald-500/20'
                      : 'bg-slate-200/90 dark:bg-slate-700/70'
                  }`}
                  style={{ height: `${barHeightPercent * 1.2}px`, maxHeight: '120px' }}
                />
              </div>

              <div className="mt-2.5 text-center min-w-0 w-full px-0.5">
                <p className="truncate text-[11px] font-semibold text-slate-800 sm:text-xs dark:text-slate-200" title={step.stage}>
                  {step.stage}
                </p>
                <p className="mt-0.5 truncate text-[10px] text-slate-400 sm:text-[11px] dark:text-slate-500">
                  {Number(step.count).toLocaleString()}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
