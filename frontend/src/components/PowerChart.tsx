/**
 * Main Power Chart component for Solar Sense AI.
 * Visualizes Actual vs Expected AC power with deep teal glassmorphism.
 * 
 * Features:
 * - Solid blue line for Actual AC Power
 * - Dashed grey line for Expected AC Power
 * - Glowing red dots for detected faults
 * - Optional solar irradiance yellow area on secondary Y-axis
 * - Visible data gaps (connectNulls=false)
 * - Rich custom tooltip with actual, expected, difference, fault cause, and weather
 * - Interactive brush timeline and quick zoom presets
 * - Underreporting warning indicator when fewer than 22 inverters reported
 */

import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Brush,
} from 'recharts';
import {
  AlertTriangle,
  ZoomIn,
  Sun,
  Maximize2,
  Info,
  Calendar,
  Activity,
} from 'lucide-react';
import { ChartDataPoint } from '../types/solar';

interface PowerChartProps {
  data: ChartDataPoint[];
  selectedInverter: string;
  showWeatherOverlay: boolean;
  onSelectInverter?: (id: string) => void;
  jumpTimestamp?: number | null;
}

export const PowerChart: React.FC<PowerChartProps> = ({
  data,
  selectedInverter,
  showWeatherOverlay,
  jumpTimestamp,
}) => {
  const [zoomRange, setZoomRange] = useState<[number, number] | null>(null);

  const { maxPower, maxIrrad } = useMemo(() => {
    let pMax = 100;
    let iMax = 1.0;
    for (const d of data) {
      if (d.actualPower !== null && d.actualPower > pMax) pMax = d.actualPower;
      if (d.expectedPower !== null && d.expectedPower > pMax) pMax = d.expectedPower;
      if (d.irradiation !== null && d.irradiation > iMax) iMax = d.irradiation;
    }
    return {
      maxPower: Math.ceil((pMax * 1.1) / 50) * 50,
      maxIrrad: Number((iMax * 1.15).toFixed(2)),
    };
  }, [data]);

  // Jump to specific timestamp when user clicks an alert
  React.useEffect(() => {
    if (jumpTimestamp && data.length > 0) {
      const targetIdx = data.findIndex((d) => Math.abs(d.timestamp - jumpTimestamp) < 15 * 60 * 1000);
      if (targetIdx !== -1) {
        const start = Math.max(0, targetIdx - 30);
        const end = Math.min(data.length - 1, targetIdx + 30);
        setZoomRange([start, end]);
      }
    }
  }, [jumpTimestamp, data]);

  const handleQuickZoom = (pointsCount: number | 'all') => {
    if (pointsCount === 'all' || data.length <= pointsCount) {
      setZoomRange(null);
    } else {
      const start = Math.max(0, data.length - pointsCount);
      setZoomRange([start, data.length - 1]);
    }
  };

  const renderFaultDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (!payload || !payload.isAnomaly || cx === undefined || cy === undefined) {
      return null;
    }

    return (
      <g key={`fault-dot-${payload.timestamp}`}>
        <circle cx={cx} cy={cy} r={8} fill="#EF4444" fillOpacity={0.3} className="animate-ping" />
        <circle
          cx={cx}
          cy={cy}
          r={5.5}
          fill="#EF4444"
          stroke="#7F1D1D"
          strokeWidth={2}
          className="cursor-pointer"
        />
      </g>
    );
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const point: ChartDataPoint = payload[0].payload;
    if (!point) return null;

    if (point.isGap) {
      return (
        <div className="bg-[#0a1c22]/95 border border-teal-500/40 rounded-xl p-3 shadow-2xl backdrop-blur-md text-xs text-neutral-300 max-w-xs">
          <div className="font-semibold text-neutral-300 mb-1 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-amber-400" />
            <span>Missing Data Interval</span>
          </div>
          <p className="text-[11px] text-neutral-400 mb-1 font-mono">
            {point.dateTime}
          </p>
          <p className="text-[11px] text-amber-300/90 leading-tight">
            Comms interruption: No inverter telemetry was reported during this window. Gaps are not counted as faults.
          </p>
        </div>
      );
    }

    const hasLowReporting = point.isLowReporting;

    return (
      <div className="bg-[#07171c]/95 border border-teal-500/40 rounded-2xl p-4 shadow-2xl backdrop-blur-md text-xs max-w-sm pointer-events-none z-50">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-teal-900/40">
          <div className="font-semibold text-neutral-200">
            {point.dateTime}
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-teal-950/80 border border-teal-600/40 text-teal-300">
            {selectedInverter === 'all' ? 'Plant Total' : selectedInverter}
          </span>
        </div>

        {hasLowReporting && (
          <div className="mb-2 p-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              Fewer inverters reported ({point.reportingCount}/22), total may be understated.
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-[11px] mb-2.5">
          <div className="flex items-center justify-between">
            <span className="text-neutral-400">Actual Power:</span>
            <span className="text-blue-400 font-bold tabular-nums">
              {point.actualPower !== null ? `${point.actualPower.toLocaleString()} kW` : 'No data'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-neutral-400">Expected Power:</span>
            <span className="text-neutral-300 font-semibold tabular-nums">
              {point.expectedPower !== null ? `${point.expectedPower.toLocaleString()} kW` : 'No data'}
            </span>
          </div>

          {point.shortfall !== null && point.shortfall > 0 && (
            <div className="flex items-center justify-between col-span-2 pt-1.5 border-t border-teal-900/40">
              <span className="text-red-400">Shortfall:</span>
              <span className="text-red-400 font-bold tabular-nums">
                {point.shortfall.toLocaleString()} kW ({(Math.max(0, point.shortfall) * 0.25).toFixed(1)} kWh loss)
              </span>
            </div>
          )}

          {showWeatherOverlay && (
            <div className="flex items-center justify-between col-span-2 pt-1 border-t border-teal-900/40 text-[10px]">
              <span className="text-neutral-400">Solar Irradiance:</span>
              <span className="text-amber-400 tabular-nums font-semibold">
                {point.irradiation !== null ? `${point.irradiation.toFixed(3)} kW/m²` : 'no data'}
              </span>
            </div>
          )}
          {point.moduleTemp !== null && (
            <div className="flex items-center justify-between col-span-2 text-[10px]">
              <span className="text-neutral-400">Module Temp:</span>
              <span className="text-neutral-300 tabular-nums">
                {point.moduleTemp !== null ? `${point.moduleTemp.toFixed(1)}°C` : 'no data'}
              </span>
            </div>
          )}
        </div>

        {point.isAnomaly && (
          <div className="p-2 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-[11px]">
            <div className="font-bold text-red-400 mb-0.5 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Fault Detected</span>
            </div>
            <p className="leading-snug">{point.anomalyReason}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-[#0b242c]/80 backdrop-blur-xl border border-teal-500/30 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)] flex flex-col mb-6">
      {/* Chart Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-teal-500/20 text-teal-400 flex items-center justify-center">
              <Activity className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-sm font-bold text-white tracking-wide">
              AC Power: Actual vs. Expected Generation
            </h3>
            <span className="text-xs text-teal-400 font-mono">
              ({selectedInverter === 'all' ? 'Plant Total kW' : `${selectedInverter} kW`})
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Solid blue line is actual AC output, dashed grey is solar physical prediction. Red dots indicate faults.
          </p>
        </div>

        {/* Legend & Quick Zoom Buttons */}
        <div className="flex items-center flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-[#061418] border border-teal-900/40 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-blue-400 inline-block shadow-[0_0_6px_rgba(59,130,246,0.8)]" />
              <span className="text-neutral-300">Actual</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 border-t border-dashed border-neutral-400 inline-block" />
              <span className="text-neutral-400">Expected</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
              <span className="text-red-400">Fault</span>
            </div>
            {showWeatherOverlay && (
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-amber-500/40 border border-amber-500/80 rounded-xs inline-block" />
                <span className="text-amber-300">Irradiance</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 bg-[#061418] p-1 rounded-xl border border-teal-900/40">
            <button
              onClick={() => handleQuickZoom('all')}
              className={`px-2.5 py-1 text-[11px] rounded-lg transition-colors ${
                zoomRange === null ? 'bg-teal-700/50 text-teal-200 font-semibold' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Full Range
            </button>
            <button
              onClick={() => handleQuickZoom(96)}
              className="px-2.5 py-1 text-[11px] rounded-lg text-neutral-400 hover:text-white transition-colors"
              title="Zoom into 24-hour cycle"
            >
              24h
            </button>
            <button
              onClick={() => handleQuickZoom(288)}
              className="px-2.5 py-1 text-[11px] rounded-lg text-neutral-400 hover:text-white transition-colors"
              title="Zoom into 3-day window"
            >
              3 Days
            </button>
          </div>
        </div>
      </div>

      {/* Main Chart Canvas */}
      <div className="w-full h-[360px] sm:h-[400px] lg:h-[440px]" aria-label="Actual vs Expected Power Timeline Chart">
        {data.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-neutral-500 space-y-2">
            <Info className="w-8 h-8 text-neutral-600" />
            <p className="text-sm">No data points available for the selected filters.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              margin={{ top: 10, right: showWeatherOverlay ? 20 : 10, left: 10, bottom: 25 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#132e36" vertical={false} />

              <XAxis
                dataKey="dateTime"
                stroke="#1f4b57"
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickFormatter={(val: string) => {
                  if (!val) return '';
                  const d = new Date(val);
                  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`;
                }}
                minTickGap={45}
              />

              <YAxis
                yAxisId="power"
                domain={[0, maxPower]}
                stroke="#1f4b57"
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickFormatter={(val: number) => `${val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}`}
                unit=" kW"
              />

              {showWeatherOverlay && (
                <YAxis
                  yAxisId="irrad"
                  orientation="right"
                  domain={[0, maxIrrad]}
                  stroke="#78350F"
                  tick={{ fill: '#D97706', fontSize: 10 }}
                  tickFormatter={(val: number) => `${val}`}
                  unit=" kW/m²"
                />
              )}

              <Tooltip content={<CustomTooltip />} />

              {showWeatherOverlay && (
                <Area
                  yAxisId="irrad"
                  type="monotone"
                  dataKey="irradiation"
                  fill="#F59E0B"
                  fillOpacity={0.15}
                  stroke="#D97706"
                  strokeWidth={1.5}
                  strokeDasharray="2 2"
                  connectNulls={false}
                  isAnimationActive={false}
                />
              )}

              <Line
                yAxisId="power"
                type="monotone"
                dataKey="expectedPower"
                stroke="#94A3B8"
                strokeWidth={1.8}
                strokeDasharray="4 4"
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />

              <Line
                yAxisId="power"
                type="monotone"
                dataKey="actualPower"
                stroke="#38BDF8"
                strokeWidth={2.4}
                dot={renderFaultDot}
                activeDot={{ r: 5, fill: '#38BDF8', stroke: '#0369A1' }}
                connectNulls={false}
                isAnimationActive={false}
              />

              <Brush
                dataKey="dateTime"
                height={26}
                stroke="#14B8A6"
                fill="#061418"
                travellerWidth={10}
                startIndex={zoomRange ? zoomRange[0] : 0}
                endIndex={zoomRange ? zoomRange[1] : undefined}
                onChange={(range: any) => {
                  if (range && range.startIndex !== undefined && range.endIndex !== undefined) {
                    setZoomRange([range.startIndex, range.endIndex]);
                  }
                }}
                tickFormatter={(val: string) => {
                  if (!val) return '';
                  const d = new Date(val);
                  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
