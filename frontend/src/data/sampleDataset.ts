/**
 * Built-in realistic sample dataset generator for SolarWatch.
 * Generates 22 inverters over 7 days (15 May 2020 to 21 May 2020) at 15-minute intervals.
 * 
 * Includes:
 * - Realistic diurnal solar radiation curves and ambient/module temperatures
 * - 4 distinct injected faults across different inverters
 * - Realistic data gap (6 hours on 20 May 21:00 to 21 May 03:00 where readings are omitted)
 * - Occasional missing weather sensor values (testing "no data" display)
 * - Occasional comms dropouts where fewer than 22 inverters report
 */

import { SolarRecord, SeverityLevel } from '../types/solar';

export const INVERTER_IDS = [
  'INV-01', 'INV-02', 'INV-03', 'INV-04', 'INV-05', 'INV-06',
  'INV-07', 'INV-08', 'INV-09', 'INV-10', 'INV-11', 'INV-12',
  'INV-13', 'INV-14', 'INV-15', 'INV-16', 'INV-17', 'INV-18',
  'INV-19', 'INV-20', 'INV-21', 'INV-22',
];

// Map of canonical inverter IDs and real plant hardware keys to realistic hardware serials
export const INVERTER_NAMES: Record<string, string> = {
  // Sample IDs
  'INV-01': 'INV-01 (1BY6WEcD)',
  'INV-02': 'INV-02 (1IF53aiR)',
  'INV-03': 'INV-03 (3PZuoBAv)',
  'INV-04': 'INV-04 (7JYdWkrx)',
  'INV-05': 'INV-05 (MCL5Dx2X)',
  'INV-06': 'INV-06 (adLQvlD1)',
  'INV-07': 'INV-07 (bvBOhCHM)',
  'INV-08': 'INV-08 (ih0vzXRI)',
  'INV-09': 'INV-09 (pkci93gP)',
  'INV-10': 'INV-10 (sgMb2f1R)',
  'INV-11': 'INV-11 (uHbR9irS)',
  'INV-12': 'INV-12 (wCURE6d6)',
  'INV-13': 'INV-13 (z9Y9g04E)',
  'INV-14': 'INV-14 (zVJPg836)',
  'INV-15': 'INV-15 (ZoE2b9a7)',
  'INV-16': 'INV-16 (WR007aC8)',
  'INV-17': 'INV-17 (qT91L1XN)',
  'INV-18': 'INV-18 (VH941e1E)',
  'INV-19': 'INV-19 (Yk92lB10)',
  'INV-20': 'INV-20 (ZN08aC99)',
  'INV-21': 'INV-21 (PL10398A)',
  'INV-22': 'INV-22 (X7890AA1)',

  // Real Plant 1 Telemetry Source Keys
  '1BY6WEcLGh8j5v7': 'INV-01 (1BY6WEcLGh8j5v7)',
  '1IF53ai7Xc0U56Y': 'INV-02 (1IF53ai7Xc0U56Y)',
  '3PZuoBAID5Wc2HD': 'INV-03 (3PZuoBAID5Wc2HD)',
  '7JYdWkrLSPkdwr4': 'INV-04 (7JYdWkrLSPkdwr4)',
  'McdE0feGgRqW7Ca': 'INV-05 (McdE0feGgRqW7Ca)',
  'VHMLBKoKgIrUVDU': 'INV-06 (VHMLBKoKgIrUVDU)',
  'WRmjgnKYAwPKWDb': 'INV-07 (WRmjgnKYAwPKWDb)',
  'YxYtjZvoooNbGkE': 'INV-08 (YxYtjZvoooNbGkE)',
  'ZnxXDlPa8U1GXgE': 'INV-09 (ZnxXDlPa8U1GXgE)',
  'ZoEaEvLYb1n2sOq': 'INV-10 (ZoEaEvLYb1n2sOq)',
  'adLQvlD726eNBSB': 'INV-11 (adLQvlD726eNBSB)',
  'bvBOhCH3iADSZry': 'INV-12 (bvBOhCH3iADSZry)',
  'iCRJl6heRkivqQ3': 'INV-13 (iCRJl6heRkivqQ3)',
  'ih0vzX44oOqAx2f': 'INV-14 (ih0vzX44oOqAx2f)',
  'pkci93gMrogZuBj': 'INV-15 (pkci93gMrogZuBj)',
  'rGa61gmuvPhdLxV': 'INV-16 (rGa61gmuvPhdLxV)',
  'sjndEbLyjtCKgGv': 'INV-17 (sjndEbLyjtCKgGv)',
  'uHbuxQJl8lW7ozc': 'INV-18 (uHbuxQJl8lW7ozc)',
  'wCURE6d3bPkepu2': 'INV-19 (wCURE6d3bPkepu2)',
  'z9Y9gH1T5YWrNuG': 'INV-20 (z9Y9gH1T5YWrNuG)',
  'zBIq5rxdHJRwDNY': 'INV-21 (zBIq5rxdHJRwDNY)',
  'zVJPv84UY57bAof': 'INV-22 (zVJPv84UY57bAof)',
};

/**
 * Returns formatted labels for inverters for display in cards and tables.
 */
export function getInverterDisplayInfo(id: string): { label: string; subLabel: string; fullName: string } {
  const mapped = INVERTER_NAMES[id];
  if (mapped) {
    const match = mapped.match(/^(INV-\d+)\s*\((.+)\)$/);
    if (match) {
      return {
        label: match[1],
        subLabel: match[2],
        fullName: mapped,
      };
    }
    return { label: mapped, subLabel: id, fullName: mapped };
  }
  return {
    label: id.length > 8 ? `${id.substring(0, 7)}…` : id,
    subLabel: id,
    fullName: id,
  };
}

const NOMINAL_CAPACITY_KW = 620; // kW peak per inverter

// Helper: pad numbers with leading zeros
const pad = (n: number) => n.toString().padStart(2, '0');

export function generateSampleDataset(): SolarRecord[] {
  const records: SolarRecord[] = [];
  
  // Start from May 15, 2020 00:00:00 UTC
  const startDate = new Date(2020, 4, 15, 0, 0, 0); // Month 4 is May
  const daysCount = 7;
  const intervalsPerDay = 96; // 24 * 4 (every 15 min)

  for (let d = 0; d < daysCount; d++) {
    // Slight daily weather variation
    const dayFactor = 0.92 + Math.sin(d * 1.3) * 0.08; // 0.84 to 1.00
    const maxDayIrrad = 0.98 * dayFactor; // peak irradiation kW/m²

    for (let i = 0; i < intervalsPerDay; i++) {
      const minutesTotal = i * 15;
      const hours = Math.floor(minutesTotal / 60);
      const mins = minutesTotal % 60;
      
      const current = new Date(startDate.getTime() + (d * 86400000) + (minutesTotal * 60000));
      const year = current.getFullYear();
      const month = pad(current.getMonth() + 1);
      const day = pad(current.getDate());
      const hourStr = pad(hours);
      const minStr = pad(mins);
      const dateStr = `${year}-${month}-${day} ${hourStr}:${minStr}:00`;
      const timestamp = current.getTime();

      // SPEC REQUIREMENT: Gaps in data
      // "Some timestamps are completely missing from the data (for example a gap of about 6 hours around 20 May, 23:00)"
      // Let's omit timestamps from May 20, 21:00 through May 21, 03:00
      if (month === '05' && day === '20' && hours >= 21) {
        continue;
      }
      if (month === '05' && day === '21' && hours < 3) {
        continue;
      }

      // Compute solar position and irradiation
      // Daylight: approximately 05:45 to 18:45
      const fractionalHour = hours + mins / 60;
      let rawIrradiation = 0;
      if (fractionalHour >= 5.75 && fractionalHour <= 18.75) {
        const solarElevation = Math.sin(((fractionalHour - 5.75) / (18.75 - 5.75)) * Math.PI);
        if (solarElevation > 0) {
          rawIrradiation = maxDayIrrad * Math.pow(solarElevation, 1.15);
        }
      }

      // Small natural micro-cloud fluctuation
      if (rawIrradiation > 0.05) {
        const cloudNoise = Math.sin((d * 10 + i) * 0.45) * 0.02;
        rawIrradiation = Math.max(0, rawIrradiation + cloudNoise);
      }

      // Ambient temperature: 20°C min at night, 34°C max in afternoon
      const ambTemp = 20 + 13 * Math.sin(((fractionalHour - 8) / 16) * Math.PI) + (Math.sin(d) * 1.5);
      
      // Module temperature: ambient + irradiance heating (up to ~58°C)
      const modTemp = rawIrradiation > 0 ? ambTemp + rawIrradiation * 28 : ambTemp - 1;

      // Occasional missing weather sensor rows on Day 3 (May 17) at 10:30 and 10:45
      const isMissingWeather = (month === '05' && day === '17' && hours === 10 && (mins === 30 || mins === 45));
      const irradiationValue = isMissingWeather ? null : Number(rawIrradiation.toFixed(4));
      const ambientValue = isMissingWeather ? null : Number(ambTemp.toFixed(1));
      const moduleValue = isMissingWeather ? null : Number(modTemp.toFixed(1));

      // Calculate baseline expected AC power for this time interval
      let baselineExpected = 0;
      if (rawIrradiation > 0.005) {
        // Temperature derating: -0.38% per °C above 25°C
        const tempLoss = 1 - 0.0038 * Math.max(0, modTemp - 25);
        baselineExpected = NOMINAL_CAPACITY_KW * (rawIrradiation / 1.0) * tempLoss * 0.985;
        baselineExpected = Math.max(0, Math.min(NOMINAL_CAPACITY_KW, baselineExpected));
      }

      // SPEC REQUIREMENT: Communication dropouts where fewer than 22 inverters report
      // On May 18 (Day 4) at 13:15, 13:30, 13:45, three inverters (INV-02, INV-08, INV-19) dropped offline (did not report rows)
      const isCommsDropoutTime = (month === '05' && day === '18' && hours === 13 && (mins === 15 || mins === 30 || mins === 45));

      // Generate readings for all 22 inverters
      for (const invId of INVERTER_IDS) {
        if (isCommsDropoutTime && (invId === 'INV-02' || invId === 'INV-08' || invId === 'INV-19')) {
          // Omit reading for this inverter to create real < 22 reporting scenario
          continue;
        }

        // Slight natural variance between inverters (±2%)
        const invHash = (invId.charCodeAt(4) * 7 + invId.charCodeAt(5) * 13) % 17;
        const invVariance = 0.98 + (invHash / 17) * 0.04;
        
        const expectedPower = baselineExpected > 0 ? Number((baselineExpected * invVariance).toFixed(2)) : 0;
        let actualPower = expectedPower > 0 ? expectedPower * (0.985 + (Math.sin(timestamp + invHash) * 0.015)) : 0;
        
        let isAnomaly = false;
        let anomalyReason = '';
        let severity: SeverityLevel | null = null;

        // INJECTED FAULT 1: Inverter Trip on INV-04
        // Date: May 16, 11:30 to 14:00 (high daylight)
        if (invId === 'INV-04' && month === '05' && day === '16' && (fractionalHour >= 11.5 && fractionalHour <= 14.0)) {
          actualPower = 0;
          isAnomaly = true;
          anomalyReason = 'Inverter Trip / AC Breaker Open: Zero output under high irradiance';
          severity = 'High';
        }

        // INJECTED FAULT 2: Severe Panel Soiling & Shading on INV-09
        // Date: May 17, 09:00 to 16:30
        else if (invId === 'INV-09' && month === '05' && day === '17' && (fractionalHour >= 9.0 && fractionalHour <= 16.5)) {
          actualPower = actualPower * 0.52; // ~48% shortfall
          isAnomaly = true;
          anomalyReason = 'Severe Soiling / Dust Layer: ~48% power shortfall vs expected';
          severity = 'Medium';
        }

        // INJECTED FAULT 3: Thermal Inverter Throttling on INV-15
        // Date: May 19, 12:45 to 15:30 (hot afternoon, modTemp > 52°C)
        else if (invId === 'INV-15' && month === '05' && day === '19' && (fractionalHour >= 12.75 && fractionalHour <= 15.5)) {
          actualPower = Math.min(210, actualPower * 0.45);
          isAnomaly = true;
          anomalyReason = 'Thermal Throttling: Internal heatsink cooling fan failure';
          severity = 'High';
        }

        // INJECTED FAULT 4: String Disconnect / Blown DC Fuse on INV-18
        // Date: May 21, 10:00 to 17:00
        else if (invId === 'INV-18' && month === '05' && day === '21' && (fractionalHour >= 10.0 && fractionalHour <= 17.0)) {
          actualPower = actualPower * 0.67; // 33% shortfall (1 of 3 strings lost)
          isAnomaly = true;
          anomalyReason = 'String Disconnect: DC string fuse open (33% power shortfall)';
          severity = 'Medium';
        }

        // Calculate energy loss in kWh for 15 minutes (0.25 hours)
        // Energy loss only counts during daytime when expected > actual
        let energyLossKwh = 0;
        if (expectedPower > actualPower && expectedPower > 1.0) {
          const shortfallKw = expectedPower - actualPower;
          energyLossKwh = Number((shortfallKw * 0.25).toFixed(3));
        }

        // Night time safety rule: night time is never a fault
        if (expectedPower <= 0.1) {
          actualPower = 0;
          isAnomaly = false;
          anomalyReason = '';
          energyLossKwh = 0;
          severity = null;
        }

        records.push({
          dateTime: dateStr,
          timestamp,
          sourceKey: invId,
          acPower: Number(actualPower.toFixed(2)),
          irradiation: irradiationValue,
          ambientTemp: ambientValue,
          moduleTemp: moduleValue,
          expectedPower: Number(expectedPower.toFixed(2)),
          isAnomaly,
          anomalyReason,
          energyLossKwh,
          severity,
        });
      }
    }
  }

  return records;
}
