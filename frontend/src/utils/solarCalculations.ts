/**
 * Data processing, anomaly detection, PV modeling, and CSV tools for Solar Sense AI.
 * Completely dynamic: supports custom CSVs, Plant 1, Plant 2, separate weather files,
 * dynamic leave-one-out peer baselines, dynamic sampling intervals, and energy loss (kWh).
 */

import Papa from 'papaparse';
import {
  SolarRecord,
  ChartDataPoint,
  InverterHealth,
  AnomalyAlert,
  DashboardMetrics,
  SeverityLevel,
  ParseCsvResult,
} from '../types/solar';
export type { ParseCsvResult } from '../types/solar';
import { INVERTER_NAMES } from '../data/sampleDataset';

/**
 * Standard PV module parameters for expected power calculation
 */
const NOMINAL_INVERTER_KW = 620; // Nominal inverter peak kW
const TEMP_COEFFICIENT = 0.0038; // Power loss per °C above 25°C
const REFERENCE_TEMP_C = 25.0;

/**
 * Calculate physical expected power from solar irradiance and module temperature.
 */
export function calculateExpectedPower(
  irradiation: number | null,
  moduleTemp: number | null,
  nominalCapacity = NOMINAL_INVERTER_KW
): number {
  if (irradiation === null || irradiation <= 0.005) {
    return 0;
  }
  const tMod = moduleTemp !== null && moduleTemp > 0 ? moduleTemp : 35.0;
  const tempFactor = 1 - TEMP_COEFFICIENT * Math.max(0, tMod - REFERENCE_TEMP_C);
  const expected = nominalCapacity * (irradiation / 1.0) * Math.max(0.7, tempFactor) * 0.985;
  return Number(Math.max(0, expected).toFixed(2));
}

/**
 * Evaluate whether an inverter reading constitutes an anomaly.
 */
export function evaluateAnomaly(
  actualKw: number,
  expectedKw: number,
  irradiation: number | null,
  moduleTemp: number | null,
  sensitivity = 0.25
): { isAnomaly: boolean; reason: string; severity: SeverityLevel | null } {
  // Nighttime or negligible sunlight is NEVER treated as a fault
  if (isNaN(expectedKw) || expectedKw <= 5.0 || (irradiation !== null && irradiation < 0.01)) {
    return { isAnomaly: false, reason: '', severity: null };
  }

  const shortfall = expectedKw - actualKw;
  const shortfallRatio = shortfall / expectedKw;

  if (actualKw <= 1.0 && expectedKw >= 30.0) {
    return {
      isAnomaly: true,
      reason: 'Inverter Trip / AC Breaker Open: Zero generation during active daylight',
      severity: 'High',
    };
  }

  if (moduleTemp !== null && moduleTemp >= 52.0 && shortfallRatio >= 0.35) {
    return {
      isAnomaly: true,
      reason: `Thermal Inverter Throttling: High heatsink temperature (${moduleTemp.toFixed(1)}°C)`,
      severity: 'High',
    };
  }

  if (shortfallRatio >= sensitivity && shortfall >= 15.0) {
    let reason = 'Significant power shortfall vs operational baseline';
    let severity: SeverityLevel = 'Low';

    if (shortfallRatio >= 0.40) {
      reason = `Severe Inverter Underperformance: ${Math.round(shortfallRatio * 100)}% shortfall vs peer fleet`;
      severity = shortfallRatio >= 0.60 ? 'High' : 'Medium';
    } else if (shortfallRatio >= 0.30 && shortfallRatio <= 0.38) {
      reason = 'Possible String Disconnect: ~33% drop indicative of open DC circuit';
      severity = 'Medium';
    } else {
      reason = `Inverter Derating: ${Math.round(shortfallRatio * 100)}% below expected generation`;
      severity = 'Low';
    }

    return { isAnomaly: true, reason, severity };
  }

  return { isAnomaly: false, reason: '', severity: null };
}

/**
 * Filter and compute dashboard metrics from records.
 * Dynamically computes energy loss and generation in kWh based on each dataset's sampling interval.
 */
export function computeDashboardMetrics(
  records: SolarRecord[],
  totalKnownInverters?: number
): DashboardMetrics {
  let totalLoss = 0;
  let totalActual = 0;
  let totalExpected = 0;
  let faultCount = 0;
  const reportingInverterIds = new Set<string>();
  const timepointInverterCounts = new Map<number, number>();

  for (const r of records) {
    reportingInverterIds.add(r.sourceKey);
    const intervalH = r.samplingIntervalHours && r.samplingIntervalHours > 0 ? r.samplingIntervalHours : 0.25;

    totalLoss += r.energyLossKwh;
    totalActual += r.acPower * intervalH;
    if (!isNaN(r.expectedPower)) {
      totalExpected += r.expectedPower * intervalH;
    }

    if (r.isAnomaly) {
      faultCount++;
    }

    const currentCount = timepointInverterCounts.get(r.timestamp) || 0;
    timepointInverterCounts.set(r.timestamp, currentCount + 1);
  }

  const invertersBaseline = totalKnownInverters && totalKnownInverters > 0
    ? totalKnownInverters
    : Math.max(reportingInverterIds.size, 1);

  let lowReportingCount = 0;
  for (const count of timepointInverterCounts.values()) {
    if (count < invertersBaseline) {
      lowReportingCount++;
    }
  }

  // Plant health score: (totalActual / totalExpected) * 100
  let healthScore = 100;
  if (totalExpected > 0) {
    healthScore = Math.min(100, Math.max(0, (totalActual / totalExpected) * 100));
  }

  return {
    totalEnergyLossKwh: Math.max(0, Math.round(totalLoss * 10) / 10),
    totalFaultsCount: faultCount,
    plantHealthScore: Math.round(healthScore * 10) / 10,
    reportingInverters: reportingInverterIds.size,
    totalInverters: Math.max(invertersBaseline, reportingInverterIds.size),
    totalActualEnergyKwh: Math.round(totalActual),
    totalExpectedEnergyKwh: Math.round(totalExpected),
    lowReportingTimestampsCount: lowReportingCount,
  };
}

/**
 * Aggregate chart series for selected inverter (or entire plant sum).
 * Inserts visible null gap points when readings are missing.
 */
export function generateChartSeries(
  records: SolarRecord[],
  selectedInverter: string,
  totalInvertersExpected?: number
): ChartDataPoint[] {
  if (records.length === 0) return [];

  const filtered = selectedInverter === 'all'
    ? records
    : records.filter((r) => r.sourceKey === selectedInverter);

  if (filtered.length === 0) return [];

  // Group by timestamp
  const map = new Map<number, {
    dateTime: string;
    actuals: number[];
    expecteds: number[];
    irradiations: number[];
    moduleTemps: number[];
    inverters: Set<string>;
    anomalies: { reason: string; severity: SeverityLevel }[];
  }>();

  for (const r of filtered) {
    let entry = map.get(r.timestamp);
    if (!entry) {
      entry = {
        dateTime: r.dateTime,
        actuals: [],
        expecteds: [],
        irradiations: [],
        moduleTemps: [],
        inverters: new Set<string>(),
        anomalies: [],
      };
      map.set(r.timestamp, entry);
    }
    entry.actuals.push(r.acPower);
    if (!isNaN(r.expectedPower)) {
      entry.expecteds.push(r.expectedPower);
    }
    if (r.irradiation !== null && !isNaN(r.irradiation)) entry.irradiations.push(r.irradiation);
    if (r.moduleTemp !== null && !isNaN(r.moduleTemp)) entry.moduleTemps.push(r.moduleTemp);
    entry.inverters.add(r.sourceKey);
    if (r.isAnomaly) {
      entry.anomalies.push({
        reason: r.anomalyReason,
        severity: r.severity || 'Medium',
      });
    }
  }

  const sortedTimestamps = Array.from(map.keys()).sort((a, b) => a - b);
  const result: ChartDataPoint[] = [];

  const expectedFleetCount = totalInvertersExpected || 22;

  for (let idx = 0; idx < sortedTimestamps.length; idx++) {
    const t = sortedTimestamps[idx];
    const prevT = idx > 0 ? sortedTimestamps[idx - 1] : null;

    // Detect data gap (> 35 minutes between consecutive readings)
    if (prevT !== null && t - prevT > 35 * 60 * 1000) {
      const gapMidpoint = Math.floor((prevT + t) / 2);
      const gapDate = new Date(gapMidpoint);
      result.push({
        timestamp: gapMidpoint,
        dateTime: gapDate.toISOString().replace('T', ' ').substring(0, 19),
        formattedTime: gapDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        formattedDate: gapDate.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        actualPower: null,
        expectedPower: null,
        shortfall: null,
        irradiation: null,
        moduleTemp: null,
        reportingCount: 0,
        isLowReporting: false,
        isAnomaly: false,
        anomalyReason: 'Data gap (no reporting telemetry)',
        isGap: true,
      });
    }

    const item = map.get(t)!;
    const dateObj = new Date(t);
    const formattedTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const formattedDate = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });

    let actualSum = 0;
    let expectedSum: number | null = null;

    if (selectedInverter === 'all') {
      actualSum = item.actuals.reduce((a, b) => a + b, 0);
      if (item.expecteds.length > 0) {
        expectedSum = item.expecteds.reduce((a, b) => a + b, 0);
      }
    } else {
      actualSum = item.actuals[0] ?? 0;
      expectedSum = item.expecteds.length > 0 ? (item.expecteds[0] ?? 0) : null;
    }

    const avgIrrad = item.irradiations.length > 0
      ? Number((item.irradiations.reduce((a, b) => a + b, 0) / item.irradiations.length).toFixed(3))
      : null;

    const avgModTemp = item.moduleTemps.length > 0
      ? Number((item.moduleTemps.reduce((a, b) => a + b, 0) / item.moduleTemps.length).toFixed(1))
      : null;

    const shortfall = expectedSum !== null ? Math.max(0, expectedSum - actualSum) : null;
    const reportingCount = item.inverters.size;
    const isLowReporting = selectedInverter === 'all' && reportingCount < expectedFleetCount;
    const isAnomaly = item.anomalies.length > 0;
    const anomalyReason = isAnomaly ? item.anomalies.map((a) => a.reason).join('; ') : null;

    result.push({
      timestamp: t,
      dateTime: item.dateTime,
      formattedTime,
      formattedDate,
      actualPower: Number(actualSum.toFixed(1)),
      expectedPower: expectedSum !== null ? Number(expectedSum.toFixed(1)) : null,
      shortfall: shortfall !== null ? Number(shortfall.toFixed(1)) : null,
      irradiation: avgIrrad,
      moduleTemp: avgModTemp,
      reportingCount,
      isLowReporting,
      isAnomaly,
      anomalyReason,
    });
  }

  if (result.length > 2500) {
    return downsampleChartData(result, 2000);
  }

  return result;
}

function downsampleChartData(data: ChartDataPoint[], targetCount: number): ChartDataPoint[] {
  if (data.length <= targetCount) return data;

  const factor = Math.ceil(data.length / targetCount);
  const downsampled: ChartDataPoint[] = [];

  for (let i = 0; i < data.length; i += factor) {
    const chunk = data.slice(i, i + factor);
    const specialPoint = chunk.find((p) => p.isAnomaly || p.isGap || p.isLowReporting);
    if (specialPoint) {
      downsampled.push(specialPoint);
    } else {
      const mid = chunk[Math.floor(chunk.length / 2)];
      downsampled.push(mid);
    }
  }

  return downsampled;
}

/**
 * Compute health summaries for all inverters (sorted by energy loss descending).
 */
export function computeInverterSummaries(records: SolarRecord[]): InverterHealth[] {
  const map = new Map<string, {
    actualKwh: number;
    expectedKwh: number;
    lossKwh: number;
    faults: number;
    lastTime: string;
  }>();

  for (const r of records) {
    let entry = map.get(r.sourceKey);
    if (!entry) {
      entry = { actualKwh: 0, expectedKwh: 0, lossKwh: 0, faults: 0, lastTime: r.dateTime };
      map.set(r.sourceKey, entry);
    }

    const intervalH = r.samplingIntervalHours && r.samplingIntervalHours > 0 ? r.samplingIntervalHours : 0.25;

    entry.actualKwh += r.acPower * intervalH;
    if (!isNaN(r.expectedPower)) {
      entry.expectedKwh += r.expectedPower * intervalH;
    }
    entry.lossKwh += r.energyLossKwh;
    if (r.isAnomaly) {
      entry.faults++;
    }
    if (r.dateTime > entry.lastTime) {
      entry.lastTime = r.dateTime;
    }
  }

  const summaries: InverterHealth[] = [];

  for (const [id, data] of map.entries()) {
    let healthScore = 100;
    if (data.expectedKwh > 0) {
      healthScore = Math.min(100, Math.max(0, (data.actualKwh / data.expectedKwh) * 100));
    }

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (healthScore < 82 || data.faults >= 5) {
      status = 'critical';
    } else if (healthScore < 94 || data.faults > 0) {
      status = 'warning';
    }

    const displayName = INVERTER_NAMES[id] || id;

    summaries.push({
      id,
      displayName,
      totalActualKwh: Math.round(data.actualKwh),
      totalExpectedKwh: Math.round(data.expectedKwh),
      totalLossKwh: Math.max(0, Math.round(data.lossKwh * 10) / 10),
      healthScore: Math.round(healthScore * 10) / 10,
      faultCount: data.faults,
      status,
      lastReportedTime: data.lastTime,
    });
  }

  return summaries.sort((a, b) => b.totalLossKwh - a.totalLossKwh);
}

/**
 * Extract anomaly alerts list from records.
 */
export function extractAnomalyAlerts(records: SolarRecord[]): AnomalyAlert[] {
  const alerts: AnomalyAlert[] = [];

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (r.isAnomaly) {
      alerts.push({
        id: `${r.sourceKey}-${r.timestamp}-${i}`,
        timestamp: r.timestamp,
        dateTime: r.dateTime,
        inverterId: r.sourceKey,
        actualKw: Number(Math.max(0, r.acPower).toFixed(2)),
        expectedKw: Number((isNaN(r.expectedPower) ? 0 : Math.max(0, r.expectedPower)).toFixed(2)),
        lossKwh: Number(Math.max(0, r.energyLossKwh).toFixed(3)),
        reason: r.anomalyReason || 'Daylight generation deficit',
        severity: r.severity || 'Medium',
        irradiation: r.irradiation,
        moduleTemp: r.moduleTemp,
      });
    }
  }

  return alerts.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Robust timestamp parser supporting DD-MM-YYYY, YYYY-MM-DD, slashes, ISO, and times.
 */
export function parseTimestampToMs(dateStr: string): { timestamp: number; formatted: string; hour: number } | null {
  if (!dateStr) return null;
  const s = dateStr.trim().replace('T', ' ').replace('Z', '');

  // 1. DD-MM-YYYY or DD/MM/YYYY: e.g. 15-05-2020 06:15
  const dmyMatch = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const hour = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const min = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const sec = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;
    const d = new Date(year, month, day, hour, min, sec);
    if (!isNaN(d.getTime())) {
      const pad = (n: number) => n.toString().padStart(2, '0');
      const formatted = `${year}-${pad(month + 1)}-${pad(day)} ${pad(hour)}:${pad(min)}:${pad(sec)}`;
      return { timestamp: d.getTime(), formatted, hour };
    }
  }

  // 2. YYYY-MM-DD or YYYY/MM/DD: e.g. 2020-05-15 06:15:00
  const ymdMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const hour = ymdMatch[4] ? parseInt(ymdMatch[4], 10) : 0;
    const min = ymdMatch[5] ? parseInt(ymdMatch[5], 10) : 0;
    const sec = ymdMatch[6] ? parseInt(ymdMatch[6], 10) : 0;
    const d = new Date(year, month, day, hour, min, sec);
    if (!isNaN(d.getTime())) {
      const pad = (n: number) => n.toString().padStart(2, '0');
      const formatted = `${year}-${pad(month + 1)}-${pad(day)} ${pad(hour)}:${pad(min)}:${pad(sec)}`;
      return { timestamp: d.getTime(), formatted, hour };
    }
  }

  // Fallback to standard Date constructor
  const fallback = new Date(s);
  if (!isNaN(fallback.getTime())) {
    return {
      timestamp: fallback.getTime(),
      formatted: fallback.toISOString().replace('T', ' ').substring(0, 19),
      hour: fallback.getHours(),
    };
  }

  return null;
}

/**
 * Flexible header cleaner: uppercase and stripped of spaces, underscores, and hyphens.
 */
function cleanHeader(h: string): string {
  return h.trim().toUpperCase().replace(/[\s_-]+/g, '');
}

/**
 * Dynamic parser for Generation and optional Weather CSV files.
 * Can be called with (genCsv, sensitivity) or (genCsv, weatherCsv, sensitivity).
 */
export async function parseSolarCsv(
  genCsvText: string,
  weatherOrSensitivity?: string | number,
  maybeSensitivity?: number
): Promise<ParseCsvResult> {
  const weatherCsvText = typeof weatherOrSensitivity === 'string' ? weatherOrSensitivity : undefined;
  const sensitivity = typeof weatherOrSensitivity === 'number'
    ? weatherOrSensitivity
    : (maybeSensitivity ?? 0.25);

  if (!genCsvText || !genCsvText.trim()) {
    return { success: false, error: 'The uploaded generation CSV file is empty.' };
  }

  // 1. Parse Generation CSV
  const genParsed = await new Promise<Papa.ParseResult<Record<string, string>>>((resolve, reject) => {
    Papa.parse<Record<string, string>>(genCsvText, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: resolve,
      error: reject,
    });
  });

  if (!genParsed.data || genParsed.data.length === 0) {
    return { success: false, error: 'No data rows found in the uploaded generation CSV.' };
  }

  // Map Generation Headers
  const genHeaders = genParsed.meta.fields || [];
  const genHeaderMap = new Map<string, string>();
  for (const h of genHeaders) {
    genHeaderMap.set(cleanHeader(h), h);
  }

  const findGenCol = (synonyms: string[]): string | undefined => {
    for (const syn of synonyms) {
      const cleaned = cleanHeader(syn);
      if (genHeaderMap.has(cleaned)) {
        return genHeaderMap.get(cleaned);
      }
    }
    return undefined;
  };

  const dateCol = findGenCol(['DATE_TIME', 'DATETIME', 'TIMESTAMP', 'DATE', 'TIME', 'DATE_AND_TIME']);
  const invCol = findGenCol(['SOURCE_KEY', 'INVERTER', 'INVERTER_ID', 'KEY', 'SOURCE', 'DEVICE_ID', 'INV_ID']);
  const acPowerCol = findGenCol(['AC_POWER', 'ACPOWER', 'POWER', 'ACTUAL_POWER', 'ACTUAL', 'GENERATION', 'AC', 'AC_KW']);

  const missingCols: string[] = [];
  if (!dateCol) missingCols.push('DATE_TIME');
  if (!invCol) missingCols.push('SOURCE_KEY');
  if (!acPowerCol) missingCols.push('AC_POWER');

  if (missingCols.length > 0) {
    return {
      success: false,
      missingColumns: missingCols,
      error: `Missing required column(s): ${missingCols.join(', ')}. Please ensure your CSV includes timestamp, inverter ID, and AC power.`,
    };
  }

  // Optional Generation columns
  const dcPowerCol = findGenCol(['DC_POWER', 'DCPOWER', 'DC_OUTPUT', 'DC', 'DC_KW']);
  const genIrradCol = findGenCol(['IRRADIATION', 'IRRAD', 'SUNLIGHT', 'SOLAR_IRRADIATION', 'RADIATION', 'GHI']);
  const genAmbCol = findGenCol(['AMBIENT_TEMPERATURE', 'AMBIENT_TEMP', 'AMB_TEMP', 'AMBIENT']);
  const genModCol = findGenCol(['MODULE_TEMPERATURE', 'MODULE_TEMP', 'MOD_TEMP', 'PANEL_TEMP']);

  // 2. Parse Weather CSV if provided
  const weatherMap = new Map<number, { irrad: number | null; amb: number | null; mod: number | null }>();

  if (weatherCsvText && weatherCsvText.trim()) {
    try {
      const weatherParsed = await new Promise<Papa.ParseResult<Record<string, string>>>((resolve, reject) => {
        Papa.parse<Record<string, string>>(weatherCsvText, {
          header: true,
          skipEmptyLines: 'greedy',
          complete: resolve,
          error: reject,
        });
      });

      if (weatherParsed.data && weatherParsed.data.length > 0) {
        const wHeaders = weatherParsed.meta.fields || [];
        const wHeaderMap = new Map<string, string>();
        for (const h of wHeaders) {
          wHeaderMap.set(cleanHeader(h), h);
        }

        const findWCol = (synonyms: string[]): string | undefined => {
          for (const syn of synonyms) {
            const cleaned = cleanHeader(syn);
            if (wHeaderMap.has(cleaned)) {
              return wHeaderMap.get(cleaned);
            }
          }
          return undefined;
        };

        const wDateCol = findWCol(['DATE_TIME', 'DATETIME', 'TIMESTAMP', 'DATE', 'TIME']);
        const wIrradCol = findWCol(['IRRADIATION', 'IRRAD', 'SUNLIGHT', 'SOLAR_IRRADIATION', 'RADIATION', 'GHI']);
        const wAmbCol = findWCol(['AMBIENT_TEMPERATURE', 'AMBIENT_TEMP', 'AMB_TEMP', 'AMBIENT']);
        const wModCol = findWCol(['MODULE_TEMPERATURE', 'MODULE_TEMP', 'MOD_TEMP', 'PANEL_TEMP']);

        if (wDateCol) {
          for (const wRow of weatherParsed.data) {
            const parsedWDate = parseTimestampToMs(wRow[wDateCol]);
            if (!parsedWDate) continue;

            const irrad = wIrradCol && wRow[wIrradCol] !== '' ? parseFloat(wRow[wIrradCol]) : null;
            const amb = wAmbCol && wRow[wAmbCol] !== '' ? parseFloat(wRow[wAmbCol]) : null;
            const mod = wModCol && wRow[wModCol] !== '' ? parseFloat(wRow[wModCol]) : null;

            weatherMap.set(parsedWDate.timestamp, {
              irrad: irrad !== null && !isNaN(irrad) ? Math.max(0, irrad) : null,
              amb: amb !== null && !isNaN(amb) ? amb : null,
              mod: mod !== null && !isNaN(mod) ? mod : null,
            });
          }
        }
      }
    } catch (wErr) {
      console.warn('Weather CSV parse warning:', wErr);
    }
  }

  // 3. First Pass: Ingest raw generation records
  interface IntermediateRecord {
    dateTime: string;
    timestamp: number;
    hour: number;
    sourceKey: string;
    acPower: number;
    dcPower: number | null;
    irradiation: number | null;
    ambientTemp: number | null;
    moduleTemp: number | null;
  }

  const rawList: IntermediateRecord[] = [];
  const inverterTimestamps = new Map<string, number[]>();

  for (let i = 0; i < genParsed.data.length; i++) {
    const row = genParsed.data[i];
    const rawDate = row[dateCol!];
    const rawInv = row[invCol!];
    const rawAc = row[acPowerCol!];

    if (!rawDate || !rawInv || rawAc === undefined || rawAc === '') continue;

    const parsedDate = parseTimestampToMs(rawDate);
    if (!parsedDate) continue;

    const sourceKey = rawInv.trim();
    const acPower = Math.max(0, parseFloat(rawAc) || 0);

    const rawDc = dcPowerCol && row[dcPowerCol] !== '' ? parseFloat(row[dcPowerCol]) : null;
    const dcPower = rawDc !== null && !isNaN(rawDc) ? Math.max(0, rawDc) : null;

    // Check weather from separate file first, fallback to generation CSV weather columns if present
    const weatherData = weatherMap.get(parsedDate.timestamp);

    let irradiation: number | null = null;
    let ambientTemp: number | null = null;
    let moduleTemp: number | null = null;

    if (weatherData) {
      irradiation = weatherData.irrad;
      ambientTemp = weatherData.amb;
      moduleTemp = weatherData.mod;
    } else {
      const rawI = genIrradCol && row[genIrradCol] !== '' ? parseFloat(row[genIrradCol]) : null;
      const rawA = genAmbCol && row[genAmbCol] !== '' ? parseFloat(row[genAmbCol]) : null;
      const rawM = genModCol && row[genModCol] !== '' ? parseFloat(row[genModCol]) : null;
      irradiation = rawI !== null && !isNaN(rawI) ? Math.max(0, rawI) : null;
      ambientTemp = rawA !== null && !isNaN(rawA) ? rawA : null;
      moduleTemp = rawM !== null && !isNaN(rawM) ? rawM : null;
    }

    rawList.push({
      dateTime: parsedDate.formatted,
      timestamp: parsedDate.timestamp,
      hour: parsedDate.hour,
      sourceKey,
      acPower,
      dcPower,
      irradiation,
      ambientTemp,
      moduleTemp,
    });

    let tsList = inverterTimestamps.get(sourceKey);
    if (!tsList) {
      tsList = [];
      inverterTimestamps.set(sourceKey, tsList);
    }
    tsList.push(parsedDate.timestamp);
  }

  if (rawList.length === 0) {
    return { success: false, error: 'No valid data rows could be parsed from the CSV file.' };
  }

  // 4. Determine Dynamic Sampling Interval
  let detectedIntervalHours = 0.25; // default 15 minutes
  const positiveDeltasMs: number[] = [];

  for (const tsList of inverterTimestamps.values()) {
    if (tsList.length > 1) {
      tsList.sort((a, b) => a - b);
      for (let j = 1; j < tsList.length; j++) {
        const delta = tsList[j] - tsList[j - 1];
        if (delta >= 60000 && delta <= 86400000) {
          positiveDeltasMs.push(delta);
        }
      }
    }
  }

  if (positiveDeltasMs.length > 0) {
    positiveDeltasMs.sort((a, b) => a - b);
    const midIdx = Math.floor(positiveDeltasMs.length / 2);
    const medianMs = positiveDeltasMs[midIdx];
    detectedIntervalHours = Number((medianMs / (1000 * 3600)).toFixed(4));
    if (detectedIntervalHours <= 0) detectedIntervalHours = 0.25;
  }

  // 5. Group by Timestamp to Compute Dynamic Leave-One-Out Peer Baseline
  const timepointMap = new Map<number, IntermediateRecord[]>();
  for (const item of rawList) {
    let list = timepointMap.get(item.timestamp);
    if (!list) {
      list = [];
      timepointMap.set(item.timestamp, list);
    }
    list.push(item);
  }

  const finalRecords: SolarRecord[] = [];
  let detectedAnomaliesCount = 0;

  for (const itemsAtTime of timepointMap.values()) {
    const count = itemsAtTime.length;
    const fleetMax = Math.max(...itemsAtTime.map((it) => it.acPower));

    for (let k = 0; k < count; k++) {
      const current = itemsAtTime[k];
      const actualKw = current.acPower;

      // Daylight determination
      let isDaylight = false;
      if (current.irradiation !== null && current.irradiation > 0.02) {
        isDaylight = true;
      } else {
        isDaylight = fleetMax > 10.0 || (current.hour >= 6 && current.hour <= 19);
      }

      // Dynamic Expected Power
      let expectedPower = 0;
      let isBaselineUnavailable = false;

      if (count > 1) {
        // Leave-one-out peer median (excludes current inverter)
        const peerPowers: number[] = [];
        for (let m = 0; m < count; m++) {
          if (m !== k) {
            peerPowers.push(itemsAtTime[m].acPower);
          }
        }
        peerPowers.sort((a, b) => a - b);
        const midP = Math.floor(peerPowers.length / 2);
        const peerMedian = peerPowers.length % 2 === 0
          ? (peerPowers[midP - 1] + peerPowers[midP]) / 2
          : peerPowers[midP];

        expectedPower = isDaylight ? peerMedian : 0;
      } else {
        // Only 1 inverter present
        if (current.irradiation !== null && current.irradiation > 0.005) {
          expectedPower = isDaylight
            ? calculateExpectedPower(current.irradiation, current.moduleTemp)
            : 0;
        } else {
          // Cannot calculate baseline
          expectedPower = NaN;
          isBaselineUnavailable = true;
        }
      }

      // Energy Loss & Power Deficit
      let powerDeficit = 0;
      let energyLossKwh = 0;

      if (!isNaN(expectedPower) && isDaylight && expectedPower > actualKw) {
        powerDeficit = expectedPower - actualKw;
        energyLossKwh = Number((powerDeficit * detectedIntervalHours).toFixed(3));
      }

      // Anomaly Detection
      let isAnomaly = false;
      let anomalyReason = '';
      let severity: SeverityLevel | null = null;
      let healthStatus = 'NORMAL_HEALTHY';

      if (isBaselineUnavailable) {
        healthStatus = 'INSUFFICIENT_DATA';
        anomalyReason = 'Insufficient peer or weather data to calculate baseline';
      } else if (!isDaylight) {
        healthStatus = 'NORMAL_NIGHT';
      } else {
        const evaluated = evaluateAnomaly(
          actualKw,
          expectedPower,
          current.irradiation,
          current.moduleTemp,
          sensitivity
        );

        isAnomaly = evaluated.isAnomaly;
        anomalyReason = evaluated.reason;
        severity = evaluated.severity;

        if (actualKw <= 1.0 && expectedPower >= 30.0) {
          healthStatus = 'CRITICAL_INVERTER_TRIP';
        } else if (current.dcPower !== null && current.dcPower > 50.0 && actualKw <= 2.0) {
          isAnomaly = true;
          anomalyReason = 'Major Conversion Loss: DC power present but AC output near zero';
          severity = 'High';
          healthStatus = 'MAJOR_EFFICIENCY_LOSS';
        } else if (isAnomaly) {
          healthStatus = 'MODERATE_UNDERPERFORMANCE';
        }
      }

      if (isAnomaly) {
        detectedAnomaliesCount++;
      }

      finalRecords.push({
        dateTime: current.dateTime,
        timestamp: current.timestamp,
        sourceKey: current.sourceKey,
        acPower: Number(actualKw.toFixed(2)),
        dcPower: current.dcPower,
        irradiation: current.irradiation,
        ambientTemp: current.ambientTemp,
        moduleTemp: current.moduleTemp,
        expectedPower: isNaN(expectedPower) ? 0 : Number(expectedPower.toFixed(2)),
        isAnomaly,
        anomalyReason,
        energyLossKwh,
        severity,
        powerDeficit: Number(powerDeficit.toFixed(2)),
        samplingIntervalHours: detectedIntervalHours,
        healthStatus,
      });
    }
  }

  // Sort chronologically
  finalRecords.sort((a, b) => a.timestamp - b.timestamp);

  return {
    success: true,
    records: finalRecords,
    rowCount: finalRecords.length,
    samplingIntervalHours: detectedIntervalHours,
    inverterCount: inverterTimestamps.size,
    anomalyCount: detectedAnomaliesCount,
  };
}

/**
 * Generate CSV text and trigger browser download for alerts.
 */
export function exportAlertsToCsv(alerts: AnomalyAlert[], plantName = 'SolarSense_Alerts') {
  const headers = [
    'Timestamp',
    'Date_Time',
    'Inverter_ID',
    'Likely_Reason',
    'Actual_kW',
    'Expected_kW',
    'Shortfall_kW',
    'Energy_Loss_kWh',
    'Severity',
    'Irradiation_kW_m2',
    'Module_Temp_C',
  ];

  const rows = alerts.map((a) => {
    const shortfall = Math.max(0, a.expectedKw - a.actualKw).toFixed(2);
    return [
      a.timestamp,
      `"${a.dateTime}"`,
      `"${a.inverterId}"`,
      `"${a.reason.replace(/"/g, '""')}"`,
      a.actualKw.toFixed(2),
      a.expectedKw.toFixed(2),
      shortfall,
      a.lossKwh.toFixed(3),
      a.severity,
      a.irradiation !== null ? a.irradiation.toFixed(3) : '',
      a.moduleTemp !== null ? a.moduleTemp.toFixed(1) : '',
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${plantName}_${new Date().toISOString().substring(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
