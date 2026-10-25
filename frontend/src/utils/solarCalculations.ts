/**
 * Data processing, anomaly detection, PV modeling, and CSV tools for SolarWatch
 */

import Papa from 'papaparse';
import {
  SolarRecord,
  ChartDataPoint,
  InverterHealth,
  AnomalyAlert,
  DashboardMetrics,
  SeverityLevel,
} from '../types/solar';
import { INVERTER_NAMES } from '../data/sampleDataset';

/**
 * Standard PV module parameters for expected power calculation
 */
const NOMINAL_INVERTER_KW = 620; // Nominal inverter peak kW
const TEMP_COEFFICIENT = 0.0038; // Power loss per °C above 25°C
const REFERENCE_TEMP_C = 25.0;

/**
 * Calculate expected power from irradiation and module temperature
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
 * Evaluate whether a reading constitutes an anomaly based on sensitivity threshold
 * Sensitivity is the fractional shortfall tolerance (e.g. 0.25 = 25% drop triggers alert)
 */
export function evaluateAnomaly(
  actualKw: number,
  expectedKw: number,
  irradiation: number | null,
  moduleTemp: number | null,
  sensitivity = 0.25
): { isAnomaly: boolean; reason: string; severity: SeverityLevel | null } {
  // Night-time or negligible sunlight is NEVER treated as a fault
  if (expectedKw <= 5.0 || (irradiation !== null && irradiation < 0.01)) {
    return { isAnomaly: false, reason: '', severity: null };
  }

  const shortfall = expectedKw - actualKw;
  const shortfallRatio = shortfall / expectedKw;

  if (shortfallRatio >= sensitivity && shortfall >= 15.0) {
    let reason = 'Significant power shortfall vs solar irradiance';
    let severity: SeverityLevel = 'Low';

    if (actualKw <= 1.0 && expectedKw > 50.0) {
      reason = 'Inverter Trip / AC Breaker Open: Zero output under daylight';
      severity = 'High';
    } else if (moduleTemp !== null && moduleTemp >= 52.0 && shortfallRatio >= 0.35) {
      reason = `Thermal Inverter Throttling: Heatsink high temp (${moduleTemp.toFixed(1)}°C)`;
      severity = 'High';
    } else if (shortfallRatio >= 0.30 && shortfallRatio <= 0.38) {
      reason = 'Possible String Disconnect: ~33% drop indicative of open DC string';
      severity = 'Medium';
    } else if (shortfallRatio >= 0.40) {
      reason = 'Severe Soiling or Panel Shading: >40% shortfall under irradiance';
      severity = shortfallRatio > 0.6 ? 'High' : 'Medium';
    } else {
      reason = `Generation Derating: ${Math.round(shortfallRatio * 100)}% below expected model`;
      severity = 'Low';
    }

    return { isAnomaly: true, reason, severity };
  }

  return { isAnomaly: false, reason: '', severity: null };
}

/**
 * Filter and compute dashboard metrics from records
 */
export function computeDashboardMetrics(
  records: SolarRecord[],
  totalKnownInverters = 22
): DashboardMetrics {
  let totalLoss = 0;
  let totalActual = 0;
  let totalExpected = 0;
  let faultCount = 0;
  const reportingInverterIds = new Set<string>();
  const timepointInverterCounts = new Map<number, number>();

  for (const r of records) {
    reportingInverterIds.add(r.sourceKey);
    totalLoss += r.energyLossKwh;
    totalActual += r.acPower * 0.25; // 15-min kWh
    totalExpected += r.expectedPower * 0.25;

    if (r.isAnomaly) {
      faultCount++;
    }

    const currentCount = timepointInverterCounts.get(r.timestamp) || 0;
    timepointInverterCounts.set(r.timestamp, currentCount + 1);
  }

  let lowReportingCount = 0;
  for (const count of timepointInverterCounts.values()) {
    if (count < totalKnownInverters) {
      lowReportingCount++;
    }
  }

  // Plant health score: (totalActual / totalExpected) * 100 during daylight periods
  let healthScore = 100;
  if (totalExpected > 0) {
    healthScore = Math.min(100, Math.max(0, (totalActual / totalExpected) * 100));
  }

  return {
    totalEnergyLossKwh: Math.max(0, Math.round(totalLoss * 10) / 10),
    totalFaultsCount: faultCount,
    plantHealthScore: Math.round(healthScore * 10) / 10,
    reportingInverters: reportingInverterIds.size,
    totalInverters: Math.max(totalKnownInverters, reportingInverterIds.size),
    totalActualEnergyKwh: Math.round(totalActual),
    totalExpectedEnergyKwh: Math.round(totalExpected),
    lowReportingTimestampsCount: lowReportingCount,
  };
}

/**
 * Aggregate chart series for selected inverter (or entire plant sum)
 * Inserts null points for data gaps > 25 minutes
 */
export function generateChartSeries(
  records: SolarRecord[],
  selectedInverter: string,
  totalInvertersExpected = 22
): ChartDataPoint[] {
  if (records.length === 0) return [];

  // Filter by inverter if specific
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
    entry.expecteds.push(r.expectedPower);
    if (r.irradiation !== null) entry.irradiations.push(r.irradiation);
    if (r.moduleTemp !== null) entry.moduleTemps.push(r.moduleTemp);
    entry.inverters.add(r.sourceKey);
    if (r.isAnomaly) {
      entry.anomalies.push({
        reason: r.anomalyReason,
        severity: r.severity || 'Medium',
      });
    }
  }

  // Sort timestamps chronologically
  const sortedTimestamps = Array.from(map.keys()).sort((a, b) => a - b);
  const result: ChartDataPoint[] = [];

  for (let idx = 0; idx < sortedTimestamps.length; idx++) {
    const t = sortedTimestamps[idx];
    const prevT = idx > 0 ? sortedTimestamps[idx - 1] : null;

    // Detect missing gap (> 25 minutes between consecutive readings)
    // Show as visible gap in charts without plotting as 0 or fault
    if (prevT !== null && t - prevT > 25 * 60 * 1000) {
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
        anomalyReason: 'Data gap (no reporting data)',
        isGap: true,
      });
    }

    const item = map.get(t)!;
    const dateObj = new Date(t);
    const formattedTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const formattedDate = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });

    let actualSum = 0;
    let expectedSum = 0;

    if (selectedInverter === 'all') {
      // Plant-level total is the sum across all reporting inverters
      actualSum = item.actuals.reduce((a, b) => a + b, 0);
      expectedSum = item.expecteds.reduce((a, b) => a + b, 0);
    } else {
      actualSum = item.actuals[0] ?? 0;
      expectedSum = item.expecteds[0] ?? 0;
    }

    const avgIrrad = item.irradiations.length > 0
      ? Number((item.irradiations.reduce((a, b) => a + b, 0) / item.irradiations.length).toFixed(3))
      : null;

    const avgModTemp = item.moduleTemps.length > 0
      ? Number((item.moduleTemps.reduce((a, b) => a + b, 0) / item.moduleTemps.length).toFixed(1))
      : null;

    const shortfall = Math.max(0, expectedSum - actualSum);
    const reportingCount = item.inverters.size;
    const isLowReporting = selectedInverter === 'all' && reportingCount < totalInvertersExpected;
    const isAnomaly = item.anomalies.length > 0;
    const anomalyReason = isAnomaly ? item.anomalies.map((a) => a.reason).join('; ') : null;

    result.push({
      timestamp: t,
      dateTime: item.dateTime,
      formattedTime,
      formattedDate,
      actualPower: Number(actualSum.toFixed(1)),
      expectedPower: Number(expectedSum.toFixed(1)),
      shortfall: Number(shortfall.toFixed(1)),
      irradiation: avgIrrad,
      moduleTemp: avgModTemp,
      reportingCount,
      isLowReporting,
      isAnomaly,
      anomalyReason,
    });
  }

  // Downsample if dataset is very large (> 2000 points) to maintain 60 FPS
  if (result.length > 2000) {
    return downsampleChartData(result, 1800);
  }

  return result;
}

/**
 * Intelligent downsampling that retains anomaly peaks and data gaps
 */
function downsampleChartData(data: ChartDataPoint[], targetCount: number): ChartDataPoint[] {
  if (data.length <= targetCount) return data;

  const factor = Math.ceil(data.length / targetCount);
  const downsampled: ChartDataPoint[] = [];

  for (let i = 0; i < data.length; i += factor) {
    const chunk = data.slice(i, i + factor);
    // Always preserve anomalies or gaps if present in chunk
    const specialPoint = chunk.find((p) => p.isAnomaly || p.isGap || p.isLowReporting);
    if (specialPoint) {
      downsampled.push(specialPoint);
    } else {
      // Pick representative point with max actualPower or midpoint
      const mid = chunk[Math.floor(chunk.length / 2)];
      downsampled.push(mid);
    }
  }

  return downsampled;
}

/**
 * Compute health summaries for all inverters (sorted by energy loss descending)
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
    entry.actualKwh += r.acPower * 0.25;
    entry.expectedKwh += r.expectedPower * 0.25;
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

  // Sort by energy loss descending
  return summaries.sort((a, b) => b.totalLossKwh - a.totalLossKwh);
}

/**
 * Extract anomaly alerts list from records
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
        expectedKw: Number(Math.max(0, r.expectedPower).toFixed(2)),
        lossKwh: Number(Math.max(0, r.energyLossKwh).toFixed(3)),
        reason: r.anomalyReason || 'Unexplained daylight shortfall',
        severity: r.severity || 'Medium',
        irradiation: r.irradiation,
        moduleTemp: r.moduleTemp,
      });
    }
  }

  // Sort newest first by default
  return alerts.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Parse CSV file uploaded in browser
 */
export interface ParseCsvResult {
  success: boolean;
  records?: SolarRecord[];
  missingColumns?: string[];
  error?: string;
  rowCount?: number;
}

export function parseSolarCsv(csvText: string, sensitivity = 0.25): Promise<ParseCsvResult> {
  return new Promise((resolve) => {
    Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (results) => {
        if (!results.data || results.data.length === 0) {
          resolve({ success: false, error: 'The uploaded CSV file is empty.' });
          return;
        }

        const headers = results.meta.fields || [];
        const normalizedHeaders = new Map<string, string>();
        for (const h of headers) {
          normalizedHeaders.set(h.trim().toUpperCase().replace(/[\s_-]+/g, ''), h);
        }

        // Column mapping matcher
        const findColumn = (possibleNames: string[]): string | undefined => {
          for (const name of possibleNames) {
            const clean = name.toUpperCase().replace(/[\s_-]+/g, '');
            if (normalizedHeaders.has(clean)) {
              return normalizedHeaders.get(clean);
            }
          }
          return undefined;
        };

        const dateCol = findColumn(['DATE_TIME', 'DATETIME', 'TIMESTAMP', 'DATE', 'TIME']);
        const invCol = findColumn(['SOURCE_KEY', 'INVERTER', 'INVERTER_ID', 'KEY', 'SOURCE']);
        const acPowerCol = findColumn(['AC_POWER', 'ACPOWER', 'POWER', 'ACTUAL_POWER', 'ACTUAL']);

        const missingCols: string[] = [];
        if (!dateCol) missingCols.push('DATE_TIME');
        if (!invCol) missingCols.push('SOURCE_KEY');
        if (!acPowerCol) missingCols.push('AC_POWER');

        if (missingCols.length > 0) {
          resolve({
            success: false,
            missingColumns: missingCols,
            error: `Missing required column(s): ${missingCols.join(', ')}. Please ensure your CSV includes DATE_TIME, SOURCE_KEY, and AC_POWER.`,
          });
          return;
        }

        // Optional columns
        const irradCol = findColumn(['IRRADIATION', 'IRRAD', 'SUNLIGHT', 'SOLAR_IRRADIATION', 'RADIATION']);
        const ambTempCol = findColumn(['AMBIENT_TEMPERATURE', 'AMBIENT_TEMP', 'AMB_TEMP', 'AMBIENT']);
        const modTempCol = findColumn(['MODULE_TEMPERATURE', 'MODULE_TEMP', 'MOD_TEMP', 'PANEL_TEMP']);
        const expCol = findColumn(['EXPECTED_POWER', 'EXPECTED', 'PREDICTED_POWER', 'P_EXP']);
        const isAnomalyCol = findColumn(['IS_ANOMALY', 'ANOMALY', 'FAULT', 'IS_FAULT']);
        const reasonCol = findColumn(['ANOMALY_REASON', 'REASON', 'FAULT_REASON', 'CAUSE']);
        const lossCol = findColumn(['ENERGY_LOSS', 'ENERGY_LOSS_KWH', 'LOSS', 'SHORTFALL_KWH']);

        const parsedRecords: SolarRecord[] = [];

        for (let rowIdx = 0; rowIdx < results.data.length; rowIdx++) {
          const row = results.data[rowIdx];
          const rawDate = row[dateCol!];
          const rawInv = row[invCol!];
          const rawAc = row[acPowerCol!];

          if (!rawDate || !rawInv || rawAc === undefined || rawAc === '') {
            continue;
          }

          // Parse timestamp
          let parsedDate = new Date(rawDate);
          if (isNaN(parsedDate.getTime())) {
            // Handle DD-MM-YYYY or DD/MM/YYYY
            const parts = rawDate.split(/[\s/T:-]+/);
            if (parts.length >= 3) {
              parsedDate = new Date(`${parts[0]}-${parts[1]}-${parts[2]}`);
            }
          }
          const timestamp = isNaN(parsedDate.getTime()) ? Date.now() + rowIdx * 900000 : parsedDate.getTime();
          const acPower = Math.max(0, parseFloat(rawAc) || 0);

          // Weather values
          const rawIrrad = irradCol && row[irradCol] !== '' && row[irradCol] !== null ? parseFloat(row[irradCol]) : null;
          const rawAmb = ambTempCol && row[ambTempCol] !== '' && row[ambTempCol] !== null ? parseFloat(row[ambTempCol]) : null;
          const rawMod = modTempCol && row[modTempCol] !== '' && row[modTempCol] !== null ? parseFloat(row[modTempCol]) : null;

          const irradiation = rawIrrad !== null && !isNaN(rawIrrad) ? rawIrrad : null;
          const ambientTemp = rawAmb !== null && !isNaN(rawAmb) ? rawAmb : null;
          const moduleTemp = rawMod !== null && !isNaN(rawMod) ? rawMod : null;

          // Expected power: use pre-existing or compute
          let expectedPower = 0;
          if (expCol && row[expCol] !== undefined && row[expCol] !== '') {
            expectedPower = Math.max(0, parseFloat(row[expCol]) || 0);
          } else {
            expectedPower = calculateExpectedPower(irradiation, moduleTemp);
          }

          // Anomaly & Reason: use pre-existing or compute
          let isAnomaly = false;
          let anomalyReason = '';
          let severity: SeverityLevel | null = null;

          if (isAnomalyCol && row[isAnomalyCol] !== undefined && row[isAnomalyCol] !== '') {
            const val = String(row[isAnomalyCol]).toLowerCase().trim();
            isAnomaly = val === '1' || val === 'true' || val === 'yes' || val === 'y';
            anomalyReason = reasonCol && row[reasonCol] ? row[reasonCol] : (isAnomaly ? 'Pre-flagged anomaly' : '');
            severity = isAnomaly ? (acPower === 0 ? 'High' : 'Medium') : null;
          } else {
            const evaluated = evaluateAnomaly(acPower, expectedPower, irradiation, moduleTemp, sensitivity);
            isAnomaly = evaluated.isAnomaly;
            anomalyReason = evaluated.reason;
            severity = evaluated.severity;
          }

          // Energy loss: use pre-existing or calculate
          let energyLossKwh = 0;
          if (lossCol && row[lossCol] !== undefined && row[lossCol] !== '') {
            energyLossKwh = Math.max(0, parseFloat(row[lossCol]) || 0);
          } else {
            if (expectedPower > acPower && expectedPower > 1.0) {
              energyLossKwh = Number(((expectedPower - acPower) * 0.25).toFixed(3));
            }
          }

          // Strict night check
          if (expectedPower <= 0.1 && (irradiation === null || irradiation < 0.005)) {
            isAnomaly = false;
            anomalyReason = '';
            energyLossKwh = 0;
            severity = null;
          }

          parsedRecords.push({
            dateTime: rawDate,
            timestamp,
            sourceKey: rawInv.trim(),
            acPower: Number(acPower.toFixed(2)),
            irradiation,
            ambientTemp,
            moduleTemp,
            expectedPower: Number(expectedPower.toFixed(2)),
            isAnomaly,
            anomalyReason,
            energyLossKwh,
            severity,
          });
        }

        if (parsedRecords.length === 0) {
          resolve({
            success: false,
            error: 'No valid data rows could be parsed from the CSV file.',
          });
          return;
        }

        resolve({
          success: true,
          records: parsedRecords,
          rowCount: parsedRecords.length,
        });
      },
      error: (err: any) => {
        resolve({
          success: false,
          error: `Failed to parse CSV file: ${err?.message || 'Parsing error'}`,
        });
      },
    });
  });
}

/**
 * Generate CSV text and trigger browser download for alerts
 */
export function exportAlertsToCsv(alerts: AnomalyAlert[], plantName = 'SolarWatch_Alerts') {
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
      a.irradiation !== null ? a.irradiation.toFixed(3) : 'no data',
      a.moduleTemp !== null ? a.moduleTemp.toFixed(1) : 'no data',
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const dateStamp = new Date().toISOString().substring(0, 10);
  link.setAttribute('download', `${plantName}_${dateStamp}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
