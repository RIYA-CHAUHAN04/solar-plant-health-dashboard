/**
 * 4 Metric Cards styled after the Solar Sense AI design reference:
 * - Bright frosted glassmorphism with luminous cyan/teal borders
 * - Vivid colored icons (Teal, Amber, Purple, Blue)
 * - Bright glowing SVG sparklines
 */

import React from 'react';
import {
  Database,
  AlertTriangle,
  Percent,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
} from 'lucide-react';
import { DashboardMetrics } from '../types/solar';

interface MetricCardsProps {
  metrics: DashboardMetrics;
  selectedInverter: string;
  totalDataPoints: number;
}

export const MetricCards: React.FC<MetricCardsProps> = ({
  metrics,
  selectedInverter,
  totalDataPoints,
}) => {
  const estimatedRevenueLoss = Math.round(metrics.totalEnergyLossKwh * 0.12);

  const anomalyRate =
    totalDataPoints > 0
      ? ((metrics.totalFaultsCount / totalDataPoints) * 100).toFixed(2)
      : '0.00';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
      {/* 1. Readings Analyzed (Teal) */}
      <div className="bg-[#0b242c]/80 backdrop-blur-xl border border-teal-500/30 rounded-3xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.3)] flex flex-col justify-between relative overflow-hidden group hover:border-teal-400 hover:shadow-[0_8px_32px_rgba(20,184,166,0.25)] transition-all">
        <div className="flex items-center justify-between mb-3">
          <div className="w-11 h-11 rounded-2xl bg-teal-400/20 border border-teal-400/40 flex items-center justify-center text-teal-300 shadow-[0_0_15px_rgba(45,212,191,0.3)]">
            <Database className="w-5 h-5" />
          </div>
          {/* Luminous Teal SVG Sparkline */}
          <svg className="w-24 h-8 overflow-visible stroke-teal-300 drop-shadow-[0_0_6px_rgba(45,212,191,0.6)]" fill="none" strokeWidth="2.5">
            <path
              d="M0,20 Q12,6 24,14 T48,10 T72,18 T96,6"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <div>
          <div className="text-xs font-bold text-neutral-300 mb-1">
            Readings Analyzed
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono tabular-nums tracking-tight drop-shadow-sm">
            {totalDataPoints.toLocaleString()}
          </div>
          <div className="text-[11px] text-neutral-300 mt-1">
            Total data points processed
          </div>
        </div>

        <div className="mt-3.5 pt-2.5 border-t border-teal-500/20 flex items-center gap-1.5 text-xs text-teal-300 font-semibold">
          <ArrowUpRight className="w-4 h-4 text-teal-300" />
          <span>12% vs. previous week</span>
        </div>
      </div>

      {/* 2. Detected Anomalies (Amber) */}
      <div className="bg-[#0b242c]/80 backdrop-blur-xl border border-teal-500/30 rounded-3xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.3)] flex flex-col justify-between relative overflow-hidden group hover:border-amber-400 hover:shadow-[0_8px_32px_rgba(245,158,11,0.25)] transition-all">
        <div className="flex items-center justify-between mb-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.3)]">
            <AlertTriangle className="w-5 h-5" />
          </div>
          {/* Luminous Amber SVG Sparkline */}
          <svg className="w-24 h-8 overflow-visible stroke-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.6)]" fill="none" strokeWidth="2.5">
            <path
              d="M0,16 Q12,20 24,10 T48,18 T72,8 T96,14"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <div>
          <div className="text-xs font-bold text-neutral-300 mb-1">
            Detected Anomalies
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-300 font-mono tabular-nums tracking-tight drop-shadow-sm">
            {metrics.totalFaultsCount}
          </div>
          <div className="text-[11px] text-neutral-300 mt-1">
            Flagged generation shortfalls
          </div>
        </div>

        <div className="mt-3.5 pt-2.5 border-t border-teal-500/20 flex items-center gap-1.5 text-xs text-amber-300 font-semibold">
          <ArrowUpRight className="w-4 h-4 text-amber-300" />
          <span>{metrics.totalFaultsCount > 0 ? `${metrics.totalFaultsCount} events flagged` : 'Zero faults detected'}</span>
        </div>
      </div>

      {/* 3. Plant Health & Anomaly Rate (Purple) */}
      <div className="bg-[#0b242c]/80 backdrop-blur-xl border border-teal-500/30 rounded-3xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.3)] flex flex-col justify-between relative overflow-hidden group hover:border-purple-400 hover:shadow-[0_8px_32px_rgba(168,85,247,0.25)] transition-all">
        <div className="flex items-center justify-between mb-3">
          <div className="w-11 h-11 rounded-2xl bg-purple-400/20 border border-purple-400/40 flex items-center justify-center text-purple-300 shadow-[0_0_15px_rgba(192,132,252,0.3)]">
            <Percent className="w-5 h-5" />
          </div>
          {/* Luminous Purple SVG Sparkline */}
          <svg className="w-24 h-8 overflow-visible stroke-purple-400 drop-shadow-[0_0_6px_rgba(192,132,252,0.6)]" fill="none" strokeWidth="2.5">
            <path
              d="M0,10 Q12,18 24,8 T48,14 T72,6 T96,12"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <div>
          <div className="text-xs font-bold text-neutral-300 mb-1">
            Plant Health Score
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-purple-200 font-mono tabular-nums tracking-tight drop-shadow-sm">
            {metrics.plantHealthScore.toFixed(1)}%
          </div>
          <div className="text-[11px] text-neutral-300 mt-1">
            {anomalyRate}% anomaly rate of readings
          </div>
        </div>

        <div className="mt-3.5 pt-2.5 border-t border-teal-500/20 flex items-center gap-1.5 text-xs text-purple-300 font-semibold">
          <ArrowDownRight className="w-4 h-4 text-emerald-400" />
          <span>Nominal operational efficiency</span>
        </div>
      </div>

      {/* 4. Estimated Energy Loss (Blue) */}
      <div className="bg-[#0b242c]/80 backdrop-blur-xl border border-teal-500/30 rounded-3xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.3)] flex flex-col justify-between relative overflow-hidden group hover:border-cyan-400 hover:shadow-[0_8px_32px_rgba(6,182,212,0.25)] transition-all">
        <div className="flex items-center justify-between mb-3">
          <div className="w-11 h-11 rounded-2xl bg-cyan-400/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.3)]">
            <Zap className="w-5 h-5" />
          </div>
          {/* Luminous Blue/Cyan SVG Sparkline */}
          <svg className="w-24 h-8 overflow-visible stroke-cyan-400 drop-shadow-[0_0_6px_rgba(34,211,238,0.6)]" fill="none" strokeWidth="2.5">
            <path
              d="M0,14 Q12,8 24,18 T48,10 T72,20 T96,8"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <div>
          <div className="text-xs font-bold text-neutral-300 mb-1">
            Estimated Energy Loss
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-cyan-200 font-mono tabular-nums tracking-tight drop-shadow-sm">
            {metrics.totalEnergyLossKwh.toLocaleString(undefined, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}{' '}
            <span className="text-sm font-semibold text-neutral-400">kWh</span>
          </div>
          <div className="text-[11px] text-neutral-300 mt-1">
            ~${estimatedRevenueLoss.toLocaleString()} estimated revenue impact
          </div>
        </div>

        <div className="mt-3.5 pt-2.5 border-t border-teal-500/20 flex items-center justify-between text-xs text-neutral-300 font-medium">
          <span>{metrics.reportingInverters}/{metrics.totalInverters} inverters active</span>
          {metrics.lowReportingTimestampsCount > 0 && selectedInverter === 'all' && (
            <span
              className="text-amber-300 text-[11px] font-semibold inline-flex items-center gap-1 cursor-help"
              title="Fewer inverters reported, total may be understated."
            >
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              Underreporting
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
