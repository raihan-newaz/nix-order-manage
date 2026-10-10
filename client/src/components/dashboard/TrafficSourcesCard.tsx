import React from 'react';

interface ChannelItem {
  name: string;
  value: number;
  color: string;
}

interface TrafficSourcesCardProps {
  marketingSpend: string;
  cpa: string;
  impressions: string;
  clicks: string;
  channels: ChannelItem[];
}

export const TrafficSourcesCard: React.FC<TrafficSourcesCardProps> = ({
  marketingSpend,
  cpa,
  impressions,
  clicks,
  channels,
}) => {
  const totalValue = channels.reduce((sum, c) => sum + c.value, 0) || 1;

  return (
    <div className="flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-slate-100/90 bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.02)] sm:p-5 lg:p-6 dark:border-slate-800 dark:bg-slate-900/90">
      <div className="flex items-center justify-between">
        <h3 className="truncate text-sm font-semibold text-slate-900 sm:text-base dark:text-white">
          Traffic Sources
        </h3>
        <span className="text-[10px] sm:text-xs text-slate-400">Marketing & Sales channels</span>
      </div>

      {/* 4 Mini KPIs with fluid truncation and nowrap */}
      <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:mt-4 sm:grid-cols-4 sm:gap-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-medium text-slate-400 sm:text-[11px]" title="Marketing Spend">Spend</p>
          <p className="mt-0.5 truncate text-xs font-bold text-slate-900 sm:text-sm dark:text-white" title={marketingSpend}>{marketingSpend}</p>
        </div>
        <div className="min-w-0">
          <p className="truncate text-[10px] font-medium text-slate-400 sm:text-[11px]">CPA</p>
          <p className="mt-0.5 truncate text-xs font-bold text-slate-900 sm:text-sm dark:text-white" title={cpa}>{cpa}</p>
        </div>
        <div className="min-w-0">
          <p className="truncate text-[10px] font-medium text-slate-400 sm:text-[11px]">Impressions</p>
          <p className="mt-0.5 truncate text-xs font-bold text-slate-900 sm:text-sm dark:text-white">{impressions}</p>
        </div>
        <div className="min-w-0">
          <p className="truncate text-[10px] font-medium text-slate-400 sm:text-[11px]">Clicks</p>
          <p className="mt-0.5 truncate text-xs font-bold text-slate-900 sm:text-sm dark:text-white">{clicks}</p>
        </div>
      </div>

      {/* Multi-color Segmented Progress Bar */}
      <div className="my-4 flex h-2 w-full overflow-hidden rounded-full bg-slate-100 sm:my-5 dark:bg-slate-800">
        {channels.length > 0 ? (
          channels.map((ch) => {
            const widthPercent = (ch.value / totalValue) * 100;
            return (
              <div
                key={ch.name}
                style={{
                  width: `${Math.max(2, widthPercent)}%`,
                  backgroundColor: ch.color,
                }}
                className="h-full transition-all duration-300"
                title={`${ch.name}: ${ch.value.toLocaleString()}`}
              />
            );
          })
        ) : (
          <div className="h-full w-full bg-slate-200 dark:bg-slate-700" />
        )}
      </div>

      {/* Responsive Channel Grid without line-breaks */}
      <div className="grid grid-cols-1 gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
        {channels.length > 0 ? (
          channels.map((ch) => (
            <div key={ch.name} className="flex min-w-0 items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5 truncate">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: ch.color }}
                />
                <span className="truncate text-[11px] text-slate-600 sm:text-xs dark:text-slate-400" title={ch.name}>
                  {ch.name}
                </span>
              </div>
              <span className="shrink-0 text-[11px] font-semibold text-slate-800 sm:text-xs dark:text-slate-200">
                {Number(ch.value).toLocaleString()}
              </span>
            </div>
          ))
        ) : (
          <p className="col-span-2 text-center text-xs text-slate-400">No channel data available</p>
        )}
      </div>
    </div>
  );
};
