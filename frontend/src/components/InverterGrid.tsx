/**
 * 22-Inverter Health Heatmap Grid for Solar Sense AI.
 * Displays all inverters colored by health status:
 * - Green (Healthy, >= 94%)
 * - Amber (Warning, 80 - 93% or minor faults)
 * - Red (Critical, < 80% or active severe fault)
 */

import React from 'react';
import { InverterHealth } from '../types/solar';
import { Cpu } from 'lucide-react';

interface InverterGridProps {
  inverterSummaries: InverterHealth[];
  selectedInverter: string;
  onSelectInverter: (id: string) => void;
}

export const InverterGrid: React.FC<InverterGridProps> = ({
  inverterSummaries,
  selectedInverter,
  onSelectInverter,
}) => {
  const orderedInverters = React.useMemo(() => {
    return [...inverterSummaries].sort((a, b) => {
      const matchA = a.displayName.match(/INV-(\d+)/) || a.id.match(/INV-(\d+)/);
      const matchB = b.displayName.match(/INV-(\d+)/) || b.id.match(/INV-(\d+)/);
      if (matchA && matchB) {
        return parseInt(matchA[1], 10) - parseInt(matchB[1], 10);
      }
      return a.id.localeCompare(b.id);
    });
  }, [inverterSummaries]);

  const getStatusStyles = (inv: InverterHealth, isSelected: boolean) => {
    let baseBorder = '';
    let bg = '';
    let text = '';
    let indicatorColor = '';

    if (inv.status === 'critical') {
      bg = 'bg-red-950/40 hover:bg-red-900/60';
      baseBorder = 'border-red-600/40';
      text = 'text-red-300';
      indicatorColor = 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]';
    } else if (inv.status === 'warning') {
      bg = 'bg-amber-950/40 hover:bg-amber-900/60';
      baseBorder = 'border-amber-600/40';
      text = 'text-amber-300';
      indicatorColor = 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.7)]';
    } else {
      bg = 'bg-emerald-950/25 hover:bg-emerald-900/40';
      baseBorder = 'border-emerald-600/35';
      text = 'text-emerald-300';
      indicatorColor = 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.7)]';
    }

    const ring = isSelected
      ? 'ring-2 ring-teal-400 ring-offset-2 ring-offset-[#061418] border-teal-400'
      : '';

    return { container: `${bg} ${baseBorder} ${ring}`, text, indicatorColor };
  };

  return (
    <div className="bg-[#0b242c]/80 backdrop-blur-xl border border-teal-500/30 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)] flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-teal-500/20 text-teal-400 flex items-center justify-center">
            <Cpu className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">
              Plant Inverter Health Matrix (22 Units)
            </h3>
            <p className="text-xs text-neutral-400">
              Heatmap status by health score &amp; active alerts. Click any tile to filter.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-medium">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
            <span>Nominal (≥94%)</span>
          </div>
          <div className="flex items-center gap-1.5 text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.8)]" />
            <span>Warning</span>
          </div>
          <div className="flex items-center gap-1.5 text-red-400">
            <span className="w-2 h-2 rounded-full bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
            <span>Critical</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8 gap-2.5 flex-1 items-stretch">
        {orderedInverters.map((inv) => {
          const isSelected = selectedInverter === inv.id;
          const styles = getStatusStyles(inv, isSelected);

          return (
            <button
              key={inv.id}
              onClick={() => onSelectInverter(isSelected ? 'all' : inv.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectInverter(isSelected ? 'all' : inv.id);
                }
              }}
              title={`${inv.displayName}: ${inv.healthScore}% Health, ${inv.totalLossKwh.toLocaleString()} kWh Loss, ${inv.faultCount} Alerts (Full ID: ${inv.id})`}
              className={`p-2.5 rounded-xl border text-left transition-all duration-150 flex flex-col justify-between group cursor-pointer focus:outline-none min-w-0 ${styles.container}`}
              aria-label={`Inverter ${inv.displayName}, Health: ${inv.healthScore}%, Status: ${inv.status}`}
            >
              <div className="flex items-center justify-between gap-1.5 mb-1.5 min-w-0">
                <span
                  className="font-mono text-xs font-bold text-white tracking-tight truncate block"
                  title={inv.id}
                >
                  {inv.id}
                </span>
                <span className={`w-2 h-2 rounded-full shrink-0 ${styles.indicatorColor}`} />
              </div>

              <div className="font-mono text-[11px] tabular-nums font-semibold flex items-center justify-between gap-1">
                <span className={styles.text}>{inv.healthScore}%</span>
                {inv.faultCount > 0 && (
                  <span className="text-[10px] text-red-300 font-bold px-1.5 py-0.2 rounded-md bg-red-500/30 border border-red-500/40 shrink-0">
                    !{inv.faultCount}
                  </span>
                )}
              </div>

              <div className="mt-1.5 pt-1.5 border-t border-teal-900/40 text-[10px] text-neutral-400 font-mono flex items-center justify-between gap-1 min-w-0">
                <span
                  className="truncate tabular-nums font-semibold text-neutral-300"
                  title={`Energy Loss: ${inv.totalLossKwh.toLocaleString()} kWh`}
                >
                  {inv.totalLossKwh > 0 ? `${inv.totalLossKwh.toLocaleString()} kWh` : '0 kWh'}
                </span>
                <span className="text-teal-400 group-hover:text-teal-200 shrink-0 font-sans text-[10px]">
                  {isSelected ? 'Active' : 'Select'}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
