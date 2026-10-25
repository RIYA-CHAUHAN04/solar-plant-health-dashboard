/**
 * Alerts Table Component styled for Solar Sense AI.
 * Displays detected faults and performance anomalies with:
 * - Columns: Timestamp, Inverter, Likely reason, Actual kW, Expected kW, Loss (kWh), Severity, Action
 * - Clear inverter names (unit pill + hardware key tooltip)
 * - Clean numerical formatting (commas, unit badges, non-negative loss)
 * - Balanced column spacing and responsive table overflow
 * - Instant search by inverter, hardware ID, or reason
 * - Severity filter tabs
 * - Sortable columns
 * - 10 rows per page pagination
 * - Row click handler to jump main chart to the alert timestamp
 */

import React, { useState, useMemo } from 'react';
import {
  Search,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  CheckCircle,
  Bell,
} from 'lucide-react';
import { AnomalyAlert, SeverityLevel } from '../types/solar';
import { getInverterDisplayInfo } from '../data/sampleDataset';

interface AlertsTableProps {
  alerts: AnomalyAlert[];
  onSelectAlertTimestamp: (timestamp: number) => void;
  selectedInverter: string;
}

type SortField = 'timestamp' | 'inverterId' | 'actualKw' | 'expectedKw' | 'lossKwh' | 'severity';
type SortOrder = 'asc' | 'desc';

export const AlertsTable: React.FC<AlertsTableProps> = ({
  alerts,
  onSelectAlertTimestamp,
  selectedInverter,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'All' | SeverityLevel>('All');
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const formatReasonText = (reason: string): string => {
    if (!reason) return 'Unexplained daylight power deficit';
    if (reason === 'CRITICAL_INVERTER_TRIP') return 'Critical Inverter Trip: Zero generation under daylight';
    if (reason === 'MAJOR_EFFICIENCY_LOSS') return 'Major Conversion Loss: AC/DC ratio significantly below standard';
    if (reason === 'MODERATE_UNDERPERFORMANCE') return 'Fleet Underperformance: Output notably lower than peer inverters';
    if (reason === 'NORMAL_CLIPPING') return 'Inverter Clipping: Peak generation capped at maximum capacity';
    return reason;
  };

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      if (selectedInverter !== 'all' && alert.inverterId !== selectedInverter) {
        return false;
      }
      if (severityFilter !== 'All' && alert.severity !== severityFilter) {
        return false;
      }
      if (searchTerm.trim() !== '') {
        const query = searchTerm.toLowerCase();
        const invInfo = getInverterDisplayInfo(alert.inverterId);
        const matchesInv =
          alert.inverterId.toLowerCase().includes(query) ||
          invInfo.label.toLowerCase().includes(query) ||
          invInfo.fullName.toLowerCase().includes(query);
        const matchesReason = alert.reason.toLowerCase().includes(query);
        const matchesDate = alert.dateTime.toLowerCase().includes(query);
        if (!matchesInv && !matchesReason && !matchesDate) return false;
      }
      return true;
    });
  }, [alerts, selectedInverter, severityFilter, searchTerm]);

  const sortedAlerts = useMemo(() => {
    return [...filteredAlerts].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'timestamp') {
        comparison = a.timestamp - b.timestamp;
      } else if (sortField === 'inverterId') {
        comparison = a.inverterId.localeCompare(b.inverterId);
      } else if (sortField === 'actualKw') {
        comparison = a.actualKw - b.actualKw;
      } else if (sortField === 'expectedKw') {
        comparison = a.expectedKw - b.expectedKw;
      } else if (sortField === 'lossKwh') {
        comparison = a.lossKwh - b.lossKwh;
      } else if (sortField === 'severity') {
        const orderMap: Record<SeverityLevel, number> = { High: 3, Medium: 2, Low: 1 };
        comparison = orderMap[a.severity] - orderMap[b.severity];
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredAlerts, sortField, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sortedAlerts.length / rowsPerPage));
  const paginatedAlerts = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return sortedAlerts.slice(start, start + rowsPerPage);
  }, [sortedAlerts, currentPage, rowsPerPage]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const getSeverityBadge = (severity: SeverityLevel) => {
    if (severity === 'High') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/20 text-red-300 border border-red-500/40 shadow-[0_0_8px_rgba(239,68,68,0.3)]">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
          Critical
        </span>
      );
    }
    if (severity === 'Medium') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.3)]">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.8)]" />
          Warning
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-500/40">
        <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
        Info
      </span>
    );
  };

  return (
    <div className="bg-[#0b242c]/80 backdrop-blur-xl border border-teal-500/30 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)] flex flex-col mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-amber-500/20 text-amber-400 flex items-center justify-center">
            <Bell className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
              <span>Plant Fault &amp; Anomaly Log</span>
              <span className="px-2 py-0.5 text-xs font-mono font-normal rounded-full bg-[#061418] border border-teal-900/40 text-teal-300">
                {sortedAlerts.length} {sortedAlerts.length === 1 ? 'record' : 'records'}
              </span>
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Daylight generation shortfalls. Click any row to jump chart focus to that timestamp.
            </p>
          </div>
        </div>

        {/* Search and Severity Filter Bar */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search reason or inverter..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-[#061418] border border-teal-800/40 rounded-xl pl-8 pr-3 py-1.5 text-xs text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-teal-500 w-48 sm:w-64"
            />
          </div>

          <div className="flex items-center p-0.5 bg-[#061418] border border-teal-800/40 rounded-xl text-xs">
            {(['All', 'High', 'Medium', 'Low'] as const).map((sev) => {
              const label = sev === 'High' ? 'Critical' : sev === 'Medium' ? 'Warning' : sev === 'Low' ? 'Info' : 'All';
              return (
                <button
                  key={sev}
                  onClick={() => {
                    setSeverityFilter(sev);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    severityFilter === sev
                      ? 'bg-teal-700/50 text-teal-100 font-semibold shadow-xs'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto border border-teal-900/40 rounded-2xl">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[#061418] border-b border-teal-900/50 text-teal-300 font-semibold select-none text-xs">
              <th
                onClick={() => handleSort('timestamp')}
                className="w-48 py-3.5 px-4 cursor-pointer hover:text-white transition-colors whitespace-nowrap"
              >
                <div className="flex items-center gap-1.5">
                  <span>Timestamp</span>
                  <ArrowUpDown className="w-3.5 h-3.5 text-teal-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort('inverterId')}
                className="w-52 py-3.5 px-4 cursor-pointer hover:text-white transition-colors whitespace-nowrap"
              >
                <div className="flex items-center gap-1.5">
                  <span>Inverter</span>
                  <ArrowUpDown className="w-3.5 h-3.5 text-teal-400" />
                </div>
              </th>
              <th className="min-w-[240px] py-3.5 px-4">
                <span>Likely Reason</span>
              </th>
              <th
                onClick={() => handleSort('actualKw')}
                className="w-32 py-3.5 px-4 cursor-pointer hover:text-white transition-colors text-right whitespace-nowrap"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Actual Power</span>
                  <ArrowUpDown className="w-3.5 h-3.5 text-teal-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort('expectedKw')}
                className="w-32 py-3.5 px-4 cursor-pointer hover:text-white transition-colors text-right whitespace-nowrap"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Expected Power</span>
                  <ArrowUpDown className="w-3.5 h-3.5 text-teal-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort('lossKwh')}
                className="w-32 py-3.5 px-4 cursor-pointer hover:text-white transition-colors text-right whitespace-nowrap"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Loss (kWh)</span>
                  <ArrowUpDown className="w-3.5 h-3.5 text-teal-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort('severity')}
                className="w-28 py-3.5 px-4 cursor-pointer hover:text-white transition-colors whitespace-nowrap text-center"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <span>Severity</span>
                  <ArrowUpDown className="w-3.5 h-3.5 text-teal-400" />
                </div>
              </th>
              <th className="w-24 py-3.5 px-4 text-center whitespace-nowrap">
                <span>Action</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-teal-900/30 text-neutral-300">
            {paginatedAlerts.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-neutral-500">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <CheckCircle className="w-8 h-8 text-emerald-400/80" />
                    <p className="text-sm font-sans text-neutral-200 font-semibold">
                      No faults in this range
                    </p>
                    <p className="text-xs font-sans text-neutral-400">
                      All inverter readings are within predicted physical tolerance.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedAlerts.map((alert) => {
                const invInfo = getInverterDisplayInfo(alert.inverterId);

                return (
                  <tr
                    key={alert.id}
                    onClick={() => onSelectAlertTimestamp(alert.timestamp)}
                    className="hover:bg-teal-950/40 cursor-pointer transition-colors group"
                  >
                    <td className="py-3 px-4 whitespace-nowrap tabular-nums text-neutral-300 font-mono text-xs">
                      {alert.dateTime}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 min-w-0" title={`Inverter: ${invInfo.fullName}`}>
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold font-mono bg-teal-500/20 text-teal-300 border border-teal-500/35 shrink-0">
                          {invInfo.label}
                        </span>
                        <span className="font-mono text-xs text-neutral-300 truncate max-w-[110px]" title={alert.inverterId}>
                          {invInfo.subLabel}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-sans text-neutral-200 text-xs">
                      <span className="line-clamp-1 group-hover:text-teal-300 transition-colors" title={alert.reason}>
                        {formatReasonText(alert.reason)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap tabular-nums text-sky-400 font-bold font-mono">
                      {alert.actualKw.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                      <span className="text-[10px] text-neutral-400 font-normal ml-1 font-sans">kW</span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap tabular-nums text-neutral-200 font-semibold font-mono">
                      {alert.expectedKw.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                      <span className="text-[10px] text-neutral-400 font-normal ml-1 font-sans">kW</span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap tabular-nums text-amber-300 font-bold font-mono">
                      {alert.lossKwh.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      <span className="text-[10px] text-neutral-400 font-normal ml-1 font-sans">kWh</span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-sans text-center">
                      {getSeverityBadge(alert.severity)}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap font-sans">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectAlertTimestamp(alert.timestamp);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[#061418] border border-teal-800/40 text-teal-300 hover:text-white hover:bg-teal-900/50 text-[11px] inline-flex items-center gap-1 transition-colors"
                        title="Jump main chart to this moment"
                      >
                        <span>Jump</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-xs text-neutral-400 font-mono">
          <div>
            Showing {(currentPage - 1) * rowsPerPage + 1} to{' '}
            {Math.min(currentPage * rowsPerPage, sortedAlerts.length)} of{' '}
            {sortedAlerts.length} entries
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`p-1.5 rounded-lg border border-teal-900/40 transition-colors ${
                currentPage === 1
                  ? 'text-neutral-600 cursor-not-allowed'
                  : 'text-neutral-300 hover:bg-teal-900/40 hover:text-white'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-2 py-1 text-teal-300 font-semibold">
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={`p-1.5 rounded-lg border border-teal-900/40 transition-colors ${
                currentPage === totalPages
                  ? 'text-neutral-600 cursor-not-allowed'
                  : 'text-neutral-300 hover:bg-teal-900/40 hover:text-white'
              }`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
