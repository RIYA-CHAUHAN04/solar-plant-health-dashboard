/**
 * Core type definitions for SolarWatch Dashboard
 */

export type SeverityLevel = 'High' | 'Medium' | 'Low';

export interface SolarRecord {
  dateTime: string;             // ISO or "YYYY-MM-DD HH:mm:ss"
  timestamp: number;            // Unix epoch ms
  sourceKey: string;            // Inverter identifier e.g. "INV-01"
  acPower: number;              // Actual AC power in kW
  irradiation: number | null;   // Solar irradiation (kW/m²), null if sensor missing
  ambientTemp: number | null;   // Ambient temperature (°C)
  moduleTemp: number | null;    // Module temperature (°C)
  expectedPower: number;        // Expected AC power (kW)
  isAnomaly: boolean;           // True if marked or detected as anomaly
  anomalyReason: string;        // Human-readable fault cause
  energyLossKwh: number;        // Energy lost during the 15-min interval: max(0, expected - actual) * 0.25h
  severity: SeverityLevel | null;
}

export interface ChartDataPoint {
  timestamp: number;
  dateTime: string;
  formattedTime: string;
  formattedDate: string;
  actualPower: number | null;     // null for missing data gap
  expectedPower: number | null;   // null for missing data gap
  shortfall: number | null;
  irradiation: number | null;
  moduleTemp: number | null;
  reportingCount: number;         // Number of inverters reporting at this timestamp
  isLowReporting: boolean;        // reportingCount < 22
  isAnomaly: boolean;
  anomalyReason: string | null;
  isGap?: boolean;
}

export interface InverterHealth {
  id: string;
  displayName: string;
  totalActualKwh: number;
  totalExpectedKwh: number;
  totalLossKwh: number;
  healthScore: number;           // 0 to 100 percentage
  faultCount: number;
  status: 'healthy' | 'warning' | 'critical';
  lastReportedTime?: string;
}

export interface AnomalyAlert {
  id: string;
  timestamp: number;
  dateTime: string;
  inverterId: string;
  actualKw: number;
  expectedKw: number;
  lossKwh: number;
  reason: string;
  severity: SeverityLevel;
  irradiation: number | null;
  moduleTemp: number | null;
}

export interface DashboardMetrics {
  totalEnergyLossKwh: number;
  totalFaultsCount: number;
  plantHealthScore: number;
  reportingInverters: number;
  totalInverters: number;
  totalActualEnergyKwh: number;
  totalExpectedEnergyKwh: number;
  lowReportingTimestampsCount: number;
}

export interface FilterState {
  selectedInverter: string;     // 'all' or inverter id
  dateRange: [string, string];  // [startDateStr, endDateStr]
  sensitivity: number;          // 0.10 to 0.50 (threshold fraction: e.g. 0.25 = 25% shortfall)
  showFaultsOnly: boolean;
  showWeatherOverlay: boolean;
}
