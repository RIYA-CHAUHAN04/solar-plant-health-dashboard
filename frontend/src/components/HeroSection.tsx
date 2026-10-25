/**
 * Hero Section matching the Solar Sense AI design reference:
 * - Bright, highly visible panoramic solar field background with golden sunlight
 * - Luminous "Smarter solar. Brighter tomorrow." typography with subtle contrast protection
 * - Recent Alerts glassmorphic panel with vibrant Critical/Warning/Info badges
 * - Plant Overview aerial matrix with 22 status nodes
 */

import React from 'react';
import {
  Sparkles,
  ArrowRight,
  Sun,
  Bell,
  Grid,
  AlertTriangle,
  Info,
  CheckCircle2,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { AnomalyAlert, InverterHealth } from '../types/solar';

interface HeroSectionProps {
  onExploreDashboard: () => void;
  recentAlerts: AnomalyAlert[];
  inverterSummaries: InverterHealth[];
  onSelectAlertTimestamp: (timestamp: number) => void;
  onSelectInverter: (id: string) => void;
  onViewAllAlerts: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onExploreDashboard,
  recentAlerts,
  inverterSummaries,
  onSelectAlertTimestamp,
  onSelectInverter,
  onViewAllAlerts,
}) => {
  const counts = React.useMemo(() => {
    let healthy = 0;
    let warning = 0;
    let critical = 0;
    for (const inv of inverterSummaries) {
      if (inv.status === 'critical') critical++;
      else if (inv.status === 'warning') warning++;
      else healthy++;
    }
    return { healthy, warning, critical };
  }, [inverterSummaries]);

  const displayAlerts = React.useMemo(() => {
    if (recentAlerts.length >= 4) return recentAlerts.slice(0, 4);
    const list = [...recentAlerts];
    if (list.length < 4) {
      list.push({
        id: 'info-1',
        timestamp: Date.now() - 3600000,
        dateTime: 'Recent Telemetry',
        inverterId: 'INV-02',
        actualKw: 580,
        expectedKw: 585,
        lossKwh: 0,
        reason: 'Performance nominal under daylight',
        severity: 'Low',
        irradiation: 0.95,
        moduleTemp: 48,
      });
    }
    return list.slice(0, 4);
  }, [recentAlerts]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-6">
      {/* Left Column: Panoramic Golden Solar Banner (8 cols on lg) */}
      <div className="lg:col-span-8 rounded-3xl relative overflow-hidden min-h-[380px] lg:min-h-[420px] border border-teal-500/30 shadow-[0_12px_40px_rgba(0,0,0,0.45)] flex flex-col justify-between p-6 sm:p-8 md:p-10">
        {/* Full-Fidelity Solar Landscape Picture Background (Vivid & Visible) */}
        <div
          className="absolute inset-0 bg-cover bg-center pointer-events-none transform scale-105 transition-transform duration-700"
          style={{
            backgroundImage: `url('/assets/aistudio/WhatsApp_Image_2026-10-25_at_5.34.27_PM_31923755.jpeg')`,
            backgroundPosition: 'center 38%',
            filter: 'brightness(1.1) saturate(1.15)',
          }}
        />

        {/* Soft targeted gradient scrim for text legibility without obscuring the bright landscape */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/40 to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

        {/* Radiant Golden Sun Flare in the sky */}
        <div className="absolute top-2 right-1/4 w-80 h-80 rounded-full bg-amber-400/30 blur-3xl pointer-events-none" />
        <div className="absolute -top-10 right-1/3 w-40 h-40 rounded-full bg-yellow-200/40 blur-2xl pointer-events-none" />

        {/* Content Box */}
        <div className="relative z-10 max-w-xl">
          {/* Badge: AI-Powered Solar Monitoring */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-950/70 border border-teal-400/40 text-teal-300 text-xs font-semibold backdrop-blur-md mb-4 shadow-[0_0_15px_rgba(20,184,166,0.3)]">
            <Sparkles className="w-3.5 h-3.5 text-teal-300 animate-pulse" />
            <span>AI-Powered Solar Monitoring</span>
          </div>

          {/* Headline with Luminous Gradient and Text Shadow */}
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-[1.12] mb-3.5 drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
            Smarter solar.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 drop-shadow-[0_0_20px_rgba(45,212,191,0.6)]">
              Brighter tomorrow.
            </span>
          </h2>

          <p className="text-sm sm:text-base text-neutral-100 leading-relaxed mb-6 font-medium max-w-lg drop-shadow-[0_1px_6px_rgba(0,0,0,0.8)]">
            Monitor your solar plant performance, detect anomalies early, and maximize energy production with physical &amp; predictive AI.
          </p>

          {/* Action Button */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onExploreDashboard}
              className="px-6 py-3 rounded-full bg-gradient-to-r from-teal-400 via-teal-300 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 text-neutral-950 font-bold text-xs sm:text-sm flex items-center gap-2.5 shadow-[0_0_25px_rgba(45,212,191,0.6)] hover:shadow-[0_0_35px_rgba(45,212,191,0.8)] transition-all transform hover:scale-[1.03] cursor-pointer"
            >
              <span>Explore Dashboard</span>
              <ArrowRight className="w-4 h-4 text-neutral-950" />
            </button>
          </div>
        </div>

        {/* Floating Bottom Pill in Banner */}
        <div className="relative z-10 mt-6 self-start inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/60 border border-amber-400/40 text-amber-200 text-[11px] font-medium backdrop-blur-md shadow-lg">
          <Sun className="w-3.5 h-3.5 text-amber-400 animate-spin-slow" />
          <span>Renewable Energy for a Sustainable Future</span>
        </div>
      </div>

      {/* Right Column: Recent Alerts & Plant Overview (4 cols on lg) */}
      <div className="lg:col-span-4 flex flex-col gap-4">
        {/* Card 1: Recent Alerts (Bright Frosted Glass) */}
        <div className="bg-[#0b242c]/80 backdrop-blur-xl border border-teal-500/30 rounded-3xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.35)] flex-1 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-teal-500/20">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-400/20 text-amber-300 flex items-center justify-center shadow-[0_0_10px_rgba(251,191,36,0.3)]">
                <Bell className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-white tracking-wide">
                Recent Alerts
              </h3>
            </div>
            <button
              onClick={onViewAllAlerts}
              className="text-[11px] text-teal-300 hover:text-teal-100 font-semibold flex items-center gap-1 transition-colors"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Alerts List */}
          <div className="space-y-2">
            {displayAlerts.map((alert) => {
              const isCrit = alert.severity === 'High';
              const isWarn = alert.severity === 'Medium';

              return (
                <div
                  key={alert.id}
                  onClick={() => onSelectAlertTimestamp(alert.timestamp)}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-[#06181f]/70 hover:bg-teal-900/40 border border-teal-500/25 cursor-pointer transition-all group shadow-xs"
                  title="Click to jump to this moment in timeline"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                        isCrit
                          ? 'bg-red-500/25 text-red-300 border border-red-500/50 shadow-[0_0_8px_rgba(239,68,68,0.4)]'
                          : isWarn
                          ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50 shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                          : 'bg-teal-500/25 text-teal-300 border border-teal-500/50'
                      }`}
                    >
                      {isCrit ? 'Critical' : isWarn ? 'Warning' : 'Info'}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-white truncate">
                        Inverter {alert.inverterId}
                      </div>
                      <div className="text-[10px] text-neutral-300 truncate group-hover:text-teal-200 transition-colors">
                        {alert.reason}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] text-neutral-400 font-mono shrink-0 pl-2">
                    {alert.dateTime.substring(11, 16)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Card 2: Plant Overview (Interactive Aerial 22-unit Schematic) */}
        <div className="bg-[#0b242c]/80 backdrop-blur-xl border border-teal-500/30 rounded-3xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.35)] flex-1 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-teal-500/20">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-teal-400/20 text-teal-300 flex items-center justify-center shadow-[0_0_10px_rgba(45,212,191,0.3)]">
                <Grid className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-white tracking-wide">
                Plant Overview
              </h3>
            </div>
            <button
              onClick={() => {
                const el = document.getElementById('inverter-matrix');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-[11px] text-teal-300 hover:text-teal-100 font-semibold flex items-center gap-1 transition-colors"
            >
              <span>View Details</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Aerial Field Schematic with 22 Interactive Inverter Nodes */}
          <div className="flex items-center gap-4 bg-[#06181f]/80 border border-teal-500/25 rounded-2xl p-3">
            <div className="flex-1 grid grid-cols-6 gap-1.5 p-2 bg-[#041217]/90 rounded-xl border border-teal-900/50">
              {inverterSummaries.slice(0, 22).map((inv) => {
                const dotColor =
                  inv.status === 'critical'
                    ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.9)]'
                    : inv.status === 'warning'
                    ? 'bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.9)]'
                    : 'bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.9)]';

                return (
                  <button
                    key={inv.id}
                    onClick={() => onSelectInverter(inv.id)}
                    className="group relative flex items-center justify-center p-1 hover:scale-135 transition-transform"
                    title={`${inv.displayName}: ${inv.healthScore}% health (${inv.status})`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
                  </button>
                );
              })}
            </div>

            {/* Health Status Legend */}
            <div className="text-[11px] space-y-1.5 font-semibold shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                <span className="text-neutral-200">Healthy ({counts.healthy})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                <span className="text-neutral-200">Warning ({counts.warning})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                <span className="text-neutral-200">Critical ({counts.critical})</span>
              </div>
            </div>
          </div>

          {/* Plant Metadata Footer */}
          <div className="mt-2.5 pt-2 border-t border-teal-500/20 flex items-center justify-between text-[11px] text-neutral-300">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-teal-400" />
              <span className="font-bold text-white">Green Valley Solar Plant</span>
            </div>
            <span className="text-[10px] text-teal-300 font-mono font-medium">22 Inverter Array</span>
          </div>
        </div>
      </div>
    </div>
  );
};
