/**
 * Horizontal Bar Chart displaying Energy Loss per Inverter, sorted highest first.
 * Styled with Solar Sense AI teal and dark obsidian theme.
 */

import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';
import { InverterHealth } from '../types/solar';
import { BarChart3 } from 'lucide-react';

interface InverterBarsProps {
  inverterSummaries: InverterHealth[];
  selectedInverter: string;
  onSelectInverter: (id: string) => void;
}

export const InverterBars: React.FC<InverterBarsProps> = ({
  inverterSummaries,
  selectedInverter,
  onSelectInverter,
}) => {
  const topLossInverters = React.useMemo(() => {
    return [...inverterSummaries]
      .sort((a, b) => b.totalLossKwh - a.totalLossKwh)
      .slice(0, 10);
  }, [inverterSummaries]);

  const getBarColor = (loss: number, id: string) => {
    if (selectedInverter === id) return '#38BDF8';
    if (loss >= 250) return '#EF4444';
    if (loss >= 50) return '#F59E0B';
    return '#14B8A6';
  };

  const CustomBarTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const inv: InverterHealth = payload[0].payload;
    return (
      <div className="bg-[#07171c]/95 border border-teal-500/40 rounded-xl p-3 shadow-2xl backdrop-blur-md text-xs max-w-xs">
        <div className="font-bold text-white flex items-center justify-between gap-4 pb-1 border-b border-teal-900/40">
          <span>{inv.displayName}</span>
          <span className="font-mono text-teal-300">{inv.healthScore}% Health</span>
        </div>
        <div className="mt-2 space-y-1 font-mono text-[11px]">
          <div className="flex justify-between gap-4">
            <span className="text-neutral-400">Total Energy Loss:</span>
            <span className="text-red-400 font-bold">{inv.totalLossKwh.toLocaleString()} kWh</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-neutral-400">Fault Events:</span>
            <span className="text-amber-400">{inv.faultCount}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-neutral-400">Actual Gen:</span>
            <span className="text-teal-200">{inv.totalActualKwh.toLocaleString()} kWh</span>
          </div>
        </div>
        <p className="mt-2 text-[10px] text-teal-400 italic">Click bar to filter dashboard</p>
      </div>
    );
  };

  return (
    <div className="bg-[#0b242c]/80 backdrop-blur-xl border border-teal-500/30 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)] flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-teal-500/20 text-teal-400 flex items-center justify-center">
            <BarChart3 className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">
              Energy Loss by Inverter
            </h3>
            <p className="text-xs text-neutral-400">
              Top shortfalls (kWh). Click a bar to isolate inverter performance.
            </p>
          </div>
        </div>
        {selectedInverter !== 'all' && (
          <button
            onClick={() => onSelectInverter('all')}
            className="text-[11px] text-teal-400 hover:text-teal-300 font-medium transition-colors"
          >
            Show All
          </button>
        )}
      </div>

      <div className="w-full flex-1 min-h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={topLossInverters}
            layout="vertical"
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          >
            <XAxis
              type="number"
              stroke="#1f4b57"
              tick={{ fill: '#64748b', fontSize: 10 }}
              tickFormatter={(v) => `${v} kWh`}
            />
            <YAxis
              type="category"
              dataKey="id"
              stroke="#1f4b57"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              width={56}
            />
            <Tooltip content={<CustomBarTooltip />} />
            <Bar
              dataKey="totalLossKwh"
              radius={[0, 6, 6, 0]}
              cursor="pointer"
              onClick={(entry: any) => {
                const targetId = entry?.id || entry?.payload?.id;
                if (targetId) onSelectInverter(targetId);
              }}
            >
              {topLossInverters.map((entry) => (
                <Cell
                  key={`cell-${entry.id}`}
                  fill={getBarColor(entry.totalLossKwh, entry.id)}
                  stroke={selectedInverter === entry.id ? '#38BDF8' : 'transparent'}
                  strokeWidth={selectedInverter === entry.id ? 2 : 0}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
