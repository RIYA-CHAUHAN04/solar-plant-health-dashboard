/**
 * Sidebar component for Solar Sense AI.
 * Matches the design reference:
 * - Brand lockup: Radiant sun mark + "SOLAR SENSE AI" (Monitor • Detect • Optimize)
 * - Navigation links: Overview, Plant Analytics, Inverter Health, Anomaly Detection, Alerts
 * - Bottom Clean Energy information badge & interactive controls
 */

import React, { useState } from 'react';
import {
  Sun,
  LayoutDashboard,
  BarChart3,
  Cpu,
  AlertTriangle,
  Bell,
  Leaf,
  Sliders,
  Calendar,
  Eye,
  Upload,
  Download,
  RotateCcw,
  ChevronDown,
  Info,
} from 'lucide-react';
import { FilterState, InverterHealth } from '../types/solar';

interface SidebarProps {
  filters: FilterState;
  onFilterChange: (filters: Partial<FilterState>) => void;
  inverterSummaries: InverterHealth[];
  onUploadClick: () => void;
  onExportAlerts: () => void;
  onResetSampleData: () => void;
  alertsCount: number;
  availableDates: { min: string; max: string };
  isUsingCustomData: boolean;
  totalRecordsCount: number;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  filters,
  onFilterChange,
  inverterSummaries,
  onUploadClick,
  onExportAlerts,
  onResetSampleData,
  alertsCount,
  availableDates,
  isUsingCustomData,
  totalRecordsCount,
  activeTab,
  onTabChange,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'analytics', label: 'Plant Analytics', icon: BarChart3 },
    { id: 'inverters', label: 'Inverter Health', icon: Cpu },
    { id: 'anomalies', label: 'Anomaly Detection', icon: AlertTriangle },
    { id: 'alerts', label: 'Alerts', icon: Bell, badge: alertsCount },
  ];

  return (
    <aside
      className={`bg-[#081e25]/90 backdrop-blur-xl border-r border-teal-500/25 flex flex-col transition-all duration-200 z-30 shrink-0 ${
        isCollapsed ? 'w-16' : 'w-64 lg:w-72'
      }`}
      aria-label="Solar Sense AI Navigation"
    >
      {/* Brand Header */}
      <div className="p-4 border-b border-teal-500/25 flex items-center justify-between">
        <div className="flex items-center gap-3 overflow-hidden">
          {/* Glowing Sun Logo */}
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.25)]">
            <Sun className="w-5 h-5 text-amber-400 animate-spin-slow" />
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <h1 className="text-sm font-bold tracking-wider text-white uppercase font-sans flex items-center gap-1.5">
                <span>SOLAR SENSE AI</span>
              </h1>
              <p className="text-[10px] text-teal-400/80 font-medium tracking-wider uppercase">
                Monitor • Detect • Optimize
              </p>
            </div>
          )}
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 rounded-md text-teal-400/60 hover:text-teal-200 hover:bg-teal-950/40 transition-colors"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${isCollapsed ? '-rotate-90' : 'rotate-90'}`} />
        </button>
      </div>

      {/* Nav Links */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {/* Navigation Items */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-teal-900/40 text-teal-200 border border-teal-500/30 shadow-[0_0_15px_rgba(20,184,166,0.15)]'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-teal-950/20'
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-teal-400' : 'text-neutral-400'}`} />
                  {!isCollapsed && <span>{item.label}</span>}
                </div>
                {!isCollapsed && item.badge !== undefined && item.badge > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {!isCollapsed && (
          <>
            {/* Quick Plant Filter Tools */}
            <div className="pt-4 border-t border-teal-900/30 space-y-4">
              <span className="text-[10px] font-bold text-teal-400 uppercase tracking-widest block">
                Plant Telemetry Controls
              </span>

              {/* Inverter Selector */}
              <div>
                <label className="text-[11px] text-neutral-300 block mb-1.5 font-medium">
                  Inverter Scope
                </label>
                <select
                  value={filters.selectedInverter}
                  onChange={(e) => onFilterChange({ selectedInverter: e.target.value })}
                  className="w-full bg-[#0a1a1f] border border-teal-800/40 rounded-lg py-1.5 px-2.5 text-xs text-neutral-200 focus:outline-none focus:border-teal-500 font-mono"
                >
                  <option value="all">⚡ All Inverters (Plant Total)</option>
                  {inverterSummaries.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.displayName} {inv.faultCount > 0 ? `(${inv.faultCount} alerts)` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sensitivity Tuning Slider */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-neutral-300 font-medium flex items-center gap-1.5">
                    <Sliders className="w-3 h-3 text-teal-400" />
                    Fault Sensitivity
                  </label>
                  <span className="font-mono text-xs text-amber-400 font-bold">
                    {Math.round(filters.sensitivity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.10"
                  max="0.50"
                  step="0.05"
                  value={filters.sensitivity}
                  onChange={(e) => onFilterChange({ sensitivity: parseFloat(e.target.value) })}
                  className="w-full accent-teal-500 bg-[#0a1a1f] h-1.5 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[9px] text-neutral-500 mt-0.5">
                  <span>Strict (10%)</span>
                  <span>Relaxed (50%)</span>
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-2 pt-1">
                <label className="flex items-center justify-between cursor-pointer group">
                  <span className="text-xs text-neutral-300 group-hover:text-white transition-colors flex items-center gap-2">
                    <Eye className="w-3.5 h-3.5 text-amber-400" />
                    Weather Overlay
                  </span>
                  <input
                    type="checkbox"
                    checked={filters.showWeatherOverlay}
                    onChange={(e) => onFilterChange({ showWeatherOverlay: e.target.checked })}
                    className="w-3.5 h-3.5 rounded bg-neutral-900 border-neutral-700 text-teal-500 focus:ring-0 cursor-pointer accent-teal-500"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer group">
                  <span className="text-xs text-neutral-300 group-hover:text-white transition-colors flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                    Faults Only
                  </span>
                  <input
                    type="checkbox"
                    checked={filters.showFaultsOnly}
                    onChange={(e) => onFilterChange({ showFaultsOnly: e.target.checked })}
                    className="w-3.5 h-3.5 rounded bg-neutral-900 border-neutral-700 text-teal-500 focus:ring-0 cursor-pointer accent-teal-500"
                  />
                </label>
              </div>

              {/* Actions */}
              <div className="pt-3 space-y-2">
                <button
                  onClick={onUploadClick}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-sm transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload CSV File
                </button>

                <button
                  onClick={onExportAlerts}
                  disabled={alertsCount === 0}
                  className={`w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs font-medium border transition-colors ${
                    alertsCount > 0
                      ? 'border-teal-800/50 text-teal-200 hover:bg-teal-900/30'
                      : 'border-neutral-800 text-neutral-600 cursor-not-allowed'
                  }`}
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Alerts ({alertsCount})
                </button>

                {isUsingCustomData && (
                  <button
                    onClick={onResetSampleData}
                    className="w-full flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg text-[11px] text-neutral-400 hover:text-neutral-200 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset to Sample Data
                  </button>
                )}
              </div>
            </div>

            {/* Bottom Card: Clean Energy badge as shown in mockup */}
            <div className="pt-4 border-t border-teal-900/30">
              <div className="p-3 rounded-xl bg-[#091a1f] border border-teal-900/40 relative overflow-hidden">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Leaf className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-white">Clean Energy</div>
                    <div className="text-[10px] text-teal-400">A Brighter Future</div>
                  </div>
                </div>
                <p className="text-[10px] text-neutral-400 leading-tight mt-1">
                  AI-driven photovoltaic plant health monitoring &amp; loss prevention.
                </p>
              </div>

              {/* Status Note */}
              <div className="mt-3 p-2.5 rounded-lg bg-[#07151a] border border-teal-900/30 flex items-start gap-2 text-[10px] text-neutral-400">
                <Info className="w-3.5 h-3.5 text-teal-500 shrink-0 mt-0.5" />
                <span>
                  Real-time physical generation modeling for 22 utility inverters.
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
};
