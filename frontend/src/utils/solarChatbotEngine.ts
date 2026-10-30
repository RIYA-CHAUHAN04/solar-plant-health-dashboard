/**
 * solarChatbotEngine.ts
 * Intelligent Solar Telemetry Reasoning and Knowledge Engine for SolarWatch Assistant.
 * Grounded directly in live dashboard metrics, active records, inverters, and anomalies.
 */

import { DashboardMetrics, InverterHealth, AnomalyAlert, SolarRecord } from '../types/solar';

export interface ChatbotContext {
  metrics: DashboardMetrics;
  inverterSummaries: InverterHealth[];
  anomalyAlerts: AnomalyAlert[];
  selectedInverter: string;
  isUsingCustomData: boolean;
  dateRange: [string, string];
  totalRecords: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: number;
  highlightStats?: Array<{ label: string; value: string; color?: string }>;
}

export const SUGGESTED_QUESTIONS = [
  'Explain my solar plant performance.',
  'Why is my plant health score low?',
  'What are the detected anomalies?',
  'How much energy are we losing?',
  'Explain AC Power vs DC Power.',
  'Which inverter needs attention?',
  'What maintenance actions are recommended?',
];

/**
 * Summarize live context into clean structured metrics
 */
export function extractLiveTelemetrySummary(ctx: ChatbotContext) {
  const { metrics, inverterSummaries, anomalyAlerts, selectedInverter, isUsingCustomData, dateRange, totalRecords } = ctx;

  // Inverter status breakdown
  let healthyCount = 0;
  let warningCount = 0;
  let criticalCount = 0;
  for (const inv of inverterSummaries) {
    if (inv.status === 'critical') criticalCount++;
    else if (inv.status === 'warning') warningCount++;
    else healthyCount++;
  }

  // Identify worst inverters by energy loss and faults
  const sortedByLoss = [...inverterSummaries].sort((a, b) => b.totalLossKwh - a.totalLossKwh);
  const worstInverter = sortedByLoss[0] || null;
  const criticalInverters = inverterSummaries.filter(
    (inv) => inv.status === 'critical' || inv.healthScore < 85 || inv.faultCount > 0
  );

  // Group anomalies by type
  const anomalyReasons: Record<string, number> = {};
  let highSeverityCount = 0;
  let mediumSeverityCount = 0;
  let lowSeverityCount = 0;

  for (const alert of anomalyAlerts) {
    const key = alert.reason || 'General Underperformance';
    anomalyReasons[key] = (anomalyReasons[key] || 0) + 1;
    if (alert.severity === 'High') highSeverityCount++;
    else if (alert.severity === 'Medium') mediumSeverityCount++;
    else lowSeverityCount++;
  }

  // Selected inverter details
  let selectedInvData: InverterHealth | null = null;
  if (selectedInverter && selectedInverter !== 'all') {
    selectedInvData = inverterSummaries.find((inv) => inv.id === selectedInverter) || null;
  }

  return {
    metrics,
    totalRecords,
    dateRange,
    isUsingCustomData,
    inverterCount: inverterSummaries.length,
    healthyCount,
    warningCount,
    criticalCount,
    worstInverter,
    sortedByLoss,
    criticalInverters,
    anomalyReasons,
    highSeverityCount,
    mediumSeverityCount,
    lowSeverityCount,
    selectedInverter,
    selectedInvData,
  };
}

/**
 * Main query processor that analyzes intent and crafts rich, grounded answers
 */
export function generateSolarAssistantResponse(query: string, ctx: ChatbotContext): { text: string; stats?: Array<{ label: string; value: string; color?: string }> } {
  const q = query.trim().toLowerCase();
  const summary = extractLiveTelemetrySummary(ctx);
  const {
    metrics,
    totalRecords,
    dateRange,
    isUsingCustomData,
    inverterCount,
    healthyCount,
    warningCount,
    criticalCount,
    worstInverter,
    criticalInverters,
    anomalyReasons,
    highSeverityCount,
    mediumSeverityCount,
    lowSeverityCount,
    selectedInverter,
    selectedInvData,
  } = summary;

  // Check if no data is loaded
  if (totalRecords === 0) {
    return {
      text: `### ⚠️ No Solar Plant Data Available\n\nThere is currently no telemetry data loaded in the dashboard.\n\n- **Action Required:** Please upload a plant generation CSV file via the **Upload CSV** button, or click **Reset to Sample Data** in the left sidebar to load baseline telemetry.\n- Once data is loaded, I will immediately analyze generation, losses, inverter health scores, and detected anomalies.`,
      stats: [
        { label: 'Status', value: 'No Telemetry', color: 'amber' },
        { label: 'Total Records', value: '0', color: 'rose' },
      ],
    };
  }

  // 1. PERFORMANCE OVERVIEW
  if (
    q.includes('explain my solar plant performance') ||
    q.includes('performance') ||
    q.includes('how is the plant doing') ||
    q.includes('overall status') ||
    q.includes('plant overview')
  ) {
    const health = metrics.plantHealthScore;
    let rating = '🟢 Optimal';
    let ratingDesc = 'The plant is performing near baseline expectations with minimal generation loss.';
    if (health < 80) {
      rating = '🔴 Critical Underperformance';
      ratingDesc = 'Multiple inverters have experienced severe generation deficits or zero-generation trips.';
    } else if (health < 92) {
      rating = '🟡 Derated / Needs Attention';
      ratingDesc = 'Several inverters are underperforming against physical solar irradiance baselines.';
    }

    const lossPct = metrics.totalExpectedEnergyKwh > 0
      ? ((metrics.totalEnergyLossKwh / metrics.totalExpectedEnergyKwh) * 100).toFixed(1)
      : '0.0';

    let text = `### ☀️ Plant Performance Overview\n\n`;
    text += `Your solar installation is currently operating at **${rating}** with a plant health score of **${health}%**.\n\n`;
    text += `${ratingDesc}\n\n`;
    text += `#### 📊 Key Telemetry Summary:\n`;
    text += `- **Plant Health Score:** **${health}%** (Actual vs Expected ratio)\n`;
    text += `- **Total Actual Generation:** **${metrics.totalActualEnergyKwh.toLocaleString()} kWh**\n`;
    text += `- **Total Expected Generation:** **${metrics.totalExpectedEnergyKwh.toLocaleString()} kWh**\n`;
    text += `- **Cumulative Energy Loss:** **${metrics.totalEnergyLossKwh.toLocaleString()} kWh** (~${lossPct}% lost)\n`;
    text += `- **Fleet Status:** **${metrics.reportingInverters}** of **${metrics.totalInverters}** inverters reporting (${healthyCount} Healthy, ${warningCount} Warning, ${criticalCount} Critical)\n`;
    text += `- **Active Dataset:** ${isUsingCustomData ? 'Uploaded Custom CSV' : 'Plant 1 Baseline'} (${dateRange[0]} to ${dateRange[1]}, ${totalRecords.toLocaleString()} readings analyzed)\n\n`;

    if (criticalInverters.length > 0) {
      text += `#### ⚠️ Inverters Requiring Attention:\n`;
      criticalInverters.slice(0, 3).forEach((inv) => {
        text += `- **${inv.displayName || inv.id}:** Health **${inv.healthScore.toFixed(1)}%**, Loss **${Math.round(inv.totalLossKwh).toLocaleString()} kWh**, **${inv.faultCount}** anomaly flags\n`;
      });
      text += `\n*Select any inverter from the dropdown above to filter the dashboard charts.*`;
    } else {
      text += `✅ All inverters are operating cleanly with zero critical trips detected in the selected time range.`;
    }

    return {
      text,
      stats: [
        { label: 'Health Score', value: `${health}%`, color: health >= 90 ? 'emerald' : 'amber' },
        { label: 'Actual Gen', value: `${(metrics.totalActualEnergyKwh / 1000).toFixed(1)} MWh`, color: 'teal' },
        { label: 'Energy Loss', value: `${metrics.totalEnergyLossKwh.toLocaleString()} kWh`, color: 'rose' },
        { label: 'Active Inverters', value: `${metrics.reportingInverters}/${metrics.totalInverters}`, color: 'blue' },
      ],
    };
  }

  // 2. WHY HEALTH SCORE IS LOW / HEALTH SCORE EXPLANATION
  if (
    q.includes('health score') ||
    q.includes('why is my plant health score low') ||
    q.includes('why is the health score') ||
    q.includes('score low')
  ) {
    const health = metrics.plantHealthScore;
    let text = `### 🎯 Plant Health Score Analysis\n\n`;
    text += `Your plant's current Health Score is **${health}%**.\n\n`;
    text += `#### 🧮 How is this calculated?\n`;
    text += `The health score is calculated as the ratio of **Total Actual AC Generation** to **Physical Expected AC Generation** across all reporting intervals:\n\n`;
    text += `$$\\text{Health Score} = \\left( \\frac{\\text{Total Actual Generation (${metrics.totalActualEnergyKwh.toLocaleString()} kWh)}}{\\text{Total Expected Generation (${metrics.totalExpectedEnergyKwh.toLocaleString()} kWh)}} \\right) \\times 100\\%$$\n\n`;

    if (health >= 95) {
      text += `#### ✅ High Performance Status\n`;
      text += `Your health score is exceptionally strong at **${health}%**. The plant is operating with minimal clipping or downtime.\n\n`;
      text += `- **Total Deficit:** Only **${metrics.totalEnergyLossKwh.toLocaleString()} kWh** lost across the selected period.\n`;
    } else {
      text += `#### 🔍 Drivers of Health Score Reduction:\n`;
      if (metrics.totalFaultsCount > 0) {
        text += `1. **Detected Anomalies:** A total of **${metrics.totalFaultsCount} anomaly events** were flagged, accounting for **${metrics.totalEnergyLossKwh.toLocaleString()} kWh** of generation shortfall.\n`;
      }
      if (criticalInverters.length > 0) {
        text += `2. **Lagging Inverters:** The following inverters experienced the steepest underperformance:\n`;
        criticalInverters.slice(0, 3).forEach((inv) => {
          text += `   - **${inv.displayName || inv.id}:** Health **${inv.healthScore.toFixed(1)}%** (${Math.round(inv.totalLossKwh).toLocaleString()} kWh lost)\n`;
        });
      }
      if (Object.keys(anomalyReasons).length > 0) {
        text += `3. **Primary Root Causes in Telemetry:**\n`;
        Object.entries(anomalyReasons).slice(0, 3).forEach(([reason, count]) => {
          text += `   - *${reason}* (**${count}** occurrences)\n`;
        });
      }
    }

    text += `\n**Recommendation:** Check inverters with health scores below 85% to verify DC string fuses, inverter heatsink temperatures, and AC breaker statuses.`;

    return {
      text,
      stats: [
        { label: 'Health Score', value: `${health}%`, color: health >= 90 ? 'emerald' : 'amber' },
        { label: 'Deficit kWh', value: `${metrics.totalEnergyLossKwh.toLocaleString()} kWh`, color: 'rose' },
        { label: 'Anomalies', value: `${metrics.totalFaultsCount}`, color: 'amber' },
      ],
    };
  }

  // 3. DETECTED ANOMALIES
  if (
    q.includes('what are the detected anomalies') ||
    q.includes('detected anomalies') ||
    q.includes('anomaly') ||
    q.includes('anomalies') ||
    q.includes('fault') ||
    q.includes('alerts')
  ) {
    const count = metrics.totalFaultsCount;
    let text = `### 🚨 Detected Anomalies & Fault Analysis\n\n`;

    if (count === 0) {
      text += `✅ **No anomalies detected** in the current dataset and active filter range!\n\n`;
      text += `- All inverters generated within standard tolerance bounds of physical expected power.\n`;
      text += `- You can adjust the **Anomaly Sensitivity Slider** in the left sidebar (default 25%) if you want to detect smaller partial deficits.\n`;
      return {
        text,
        stats: [{ label: 'Anomalies', value: '0', color: 'emerald' }],
      };
    }

    text += `A total of **${count.toLocaleString()} anomalies** have been detected in the active telemetry window.\n\n`;
    text += `#### 🚦 Severity Breakdown:\n`;
    text += `- **High / Critical:** **${highSeverityCount}** events (Inverter trip / near zero generation during daylight or severe derating >60%)\n`;
    text += `- **Medium:** **${mediumSeverityCount}** events (String disconnects ~33% drop, or derating 40–60%)\n`;
    text += `- **Low:** **${lowSeverityCount}** events (Minor operational derating above sensitivity threshold)\n\n`;

    text += `#### 📋 Anomaly Classification:\n`;
    const reasonEntries = Object.entries(anomalyReasons);
    if (reasonEntries.length > 0) {
      reasonEntries.forEach(([reason, num]) => {
        text += `- **${reason}:** ${num} occurrence${num > 1 ? 's' : ''}\n`;
      });
    }

    if (ctx.anomalyAlerts.length > 0) {
      text += `\n#### 🕒 Recent Anomaly Samples:\n`;
      ctx.anomalyAlerts.slice(0, 4).forEach((alert) => {
        text += `- **${alert.dateTime}** | **${alert.inverterId}**: Actual **${alert.actualKw.toFixed(1)} kW** vs Expected **${alert.expectedKw.toFixed(1)} kW** (Loss: **${alert.lossKwh.toFixed(1)} kWh**) — *${alert.reason}*\n`;
      });
    }

    text += `\n*Tip: Click any row in the **Fault & Anomaly Log** table on the dashboard to jump directly to that timestamp on the power chart.*`;

    return {
      text,
      stats: [
        { label: 'Total Faults', value: `${count}`, color: 'rose' },
        { label: 'High Severity', value: `${highSeverityCount}`, color: 'rose' },
        { label: 'Medium Severity', value: `${mediumSeverityCount}`, color: 'amber' },
      ],
    };
  }

  // 4. ENERGY LOSS
  if (
    q.includes('how much energy are we losing') ||
    q.includes('energy loss') ||
    q.includes('loss') ||
    q.includes('losing') ||
    q.includes('revenue') ||
    q.includes('financial')
  ) {
    const lossKwh = metrics.totalEnergyLossKwh;
    const estRevenueLoss = Math.round(lossKwh * 0.12);
    const lossPct = metrics.totalExpectedEnergyKwh > 0
      ? ((lossKwh / metrics.totalExpectedEnergyKwh) * 100).toFixed(1)
      : '0.0';

    let text = `### ⚡ Energy & Financial Loss Breakdown\n\n`;
    text += `Across the active observation period, the plant has recorded a cumulative energy loss of **${lossKwh.toLocaleString()} kWh**.\n\n`;
    text += `#### 💵 Key Financial & Impact Metrics:\n`;
    text += `- **Total Energy Lost:** **${lossKwh.toLocaleString()} kWh**\n`;
    text += `- **Loss Ratio:** **${lossPct}%** of total expected generation (${metrics.totalExpectedEnergyKwh.toLocaleString()} kWh)\n`;
    text += `- **Estimated Revenue Loss:** **~$${estRevenueLoss.toLocaleString()}** (calculated at commercial tariff benchmark of $0.12 / kWh)\n`;
    text += `- **Total Actual Energy Delivered:** **${metrics.totalActualEnergyKwh.toLocaleString()} kWh**\n\n`;

    if (worstInverter) {
      const worstPct = lossKwh > 0 ? ((worstInverter.totalLossKwh / lossKwh) * 100).toFixed(1) : '0';
      text += `#### 🎯 Highest Contributing Inverter:\n`;
      text += `- Inverter **${worstInverter.displayName || worstInverter.id}** is responsible for **${Math.round(worstInverter.totalLossKwh).toLocaleString()} kWh** lost (**${worstPct}%** of the entire plant's loss) with **${worstInverter.faultCount}** logged fault events.\n\n`;
    }

    text += `#### 💡 How to Mitigate Losses:\n`;
    text += `1. Prioritize servicing the top 2 underperforming inverters.\n`;
    text += `2. Check for open DC string disconnects or blown fuses.\n`;
    text += `3. Clear dust or soiling from solar PV modules to restore peak irradiance capture.`;

    return {
      text,
      stats: [
        { label: 'Total Loss', value: `${lossKwh.toLocaleString()} kWh`, color: 'rose' },
        { label: 'Loss %', value: `${lossPct}%`, color: 'amber' },
        { label: 'Est. Revenue Loss', value: `~$${estRevenueLoss.toLocaleString()}`, color: 'rose' },
      ],
    };
  }

  // 5. AC POWER VS DC POWER
  if (
    q.includes('ac power vs dc power') ||
    q.includes('ac vs dc') ||
    q.includes('ac power') ||
    q.includes('dc power') ||
    q.includes('inverter efficiency')
  ) {
    let text = `### 🔌 AC Power vs. DC Power in Solar Plants\n\n`;
    text += `Here is a clear, beginner-friendly explanation of the fundamental electrical difference in your solar installation:\n\n`;

    text += `#### ☀️ 1. DC Power (Direct Current)\n`;
    text += `- **What it is:** The raw electrical energy generated by the solar photovoltaic (PV) modules on the mounting racks.\n`;
    text += `- **How it works:** When sunlight (photons) strikes silicon PV cells, electrons are knocked loose and flow in one steady direction (Direct Current).\n`;
    text += `- **In your plant:** Module strings feed DC power into combiner boxes and then into the inverter DC inputs.\n\n`;

    text += `#### ⚡ 2. AC Power (Alternating Current)\n`;
    text += `- **What it is:** The electricity converted and shaped by your solar inverters.\n`;
    text += `- **How it works:** Grid transmission and domestic/industrial equipment operate on Alternating Current (e.g. 50 Hz or 60 Hz sine wave). The inverter rapidly switches DC to produce synchronized AC.\n`;
    text += `- **In your plant:** The AC power measured at the inverter output is what is delivered through step-up transformers to the electrical grid.\n\n`;

    text += `#### ⚙️ 3. Inverter Efficiency & Conversion Loss\n`;
    text += `- Inverter efficiency is expressed as: $$\\eta = \\frac{\\text{AC Power}}{\\text{DC Power}} \\times 100\\%$$\n`;
    text += `- High-grade commercial inverters typically achieve **96% to 98.5% efficiency**.\n`;
    text += `- The missing 1.5% - 4% is dissipated as heat through the inverter heatsinks and internal semiconductor switching losses.\n`;
    text += `- **Telemetry Note:** In this dashboard, if your CSV includes both \`DC_POWER\` and \`AC_POWER\`, inverter efficiency is dynamically monitored to detect internal bridge or filter degradation!`;

    return {
      text,
      stats: [
        { label: 'DC Power', value: 'Module Output', color: 'amber' },
        { label: 'AC Power', value: 'Grid Feed', color: 'teal' },
        { label: 'Typical Efficiency', value: '96 - 98.5%', color: 'emerald' },
      ],
    };
  }

  // 6. WHICH INVERTER NEEDS ATTENTION / SPECIFIC INVERTER
  // Check if user is asking about a specific inverter (e.g., INV-01, INV-04, etc.)
  const invMatch = q.match(/inv[-\s]?([0-9]{1,2})/i);
  if (invMatch) {
    const targetNum = invMatch[1].padStart(2, '0');
    const targetKey = `INV-${targetNum}`;
    const found = summary.sortedByLoss.find(
      (inv) => inv.id.toLowerCase().includes(targetKey.toLowerCase()) || inv.displayName.toLowerCase().includes(targetKey.toLowerCase())
    );

    if (found) {
      let statusColor = '🟢 Healthy';
      if (found.status === 'critical') statusColor = '🔴 Critical Fault';
      else if (found.status === 'warning') statusColor = '🟡 Warning';

      const relatedAlerts = ctx.anomalyAlerts.filter((a) => a.inverterId === found.id);

      let text = `### 🔎 Inverter Inspection: ${found.displayName || found.id}\n\n`;
      text += `Status: **${statusColor}** | Health Score: **${found.healthScore.toFixed(1)}%**\n\n`;
      text += `#### 📊 Performance Telemetry:\n`;
      text += `- **Actual AC Generation:** **${Math.round(found.totalActualKwh).toLocaleString()} kWh**\n`;
      text += `- **Expected Generation:** **${Math.round(found.totalExpectedKwh).toLocaleString()} kWh**\n`;
      text += `- **Energy Loss:** **${Math.round(found.totalLossKwh).toLocaleString()} kWh**\n`;
      text += `- **Anomaly Event Count:** **${found.faultCount}**\n\n`;

      if (relatedAlerts.length > 0) {
        text += `#### ⚠️ Logged Anomaly Causes for this Inverter:\n`;
        const causes = Array.from(new Set(relatedAlerts.map((a) => a.reason)));
        causes.forEach((c) => {
          text += `- *${c}*\n`;
        });
      } else {
        text += `✅ No active anomalies recorded for ${found.id} during this timeframe.\n`;
      }

      text += `\n*You can select "${found.id}" from the Inverter Selector pill in the top navbar to focus all charts on this unit.*`;

      return {
        text,
        stats: [
          { label: 'Inverter', value: found.id, color: 'teal' },
          { label: 'Health Score', value: `${found.healthScore.toFixed(1)}%`, color: found.healthScore >= 90 ? 'emerald' : 'amber' },
          { label: 'Loss', value: `${Math.round(found.totalLossKwh).toLocaleString()} kWh`, color: 'rose' },
          { label: 'Faults', value: `${found.faultCount}`, color: 'amber' },
        ],
      };
    }
  }

  if (
    q.includes('which inverter needs attention') ||
    q.includes('needs attention') ||
    q.includes('worst inverter') ||
    q.includes('inverter status') ||
    q.includes('inverter health')
  ) {
    let text = `### 🔧 Inverter Priority Ranking\n\n`;

    if (criticalInverters.length === 0) {
      text += `✅ **All inverters are performing within expected limits.**\n\n`;
      text += `None of the inverters currently fall below the 85% health score threshold or have active critical trips.\n\n`;
      if (worstInverter) {
        text += `For reference, the inverter with the lowest relative score is **${worstInverter.displayName || worstInverter.id}** with a healthy score of **${worstInverter.healthScore.toFixed(1)}%** and ${Math.round(worstInverter.totalLossKwh).toLocaleString()} kWh minor variance.`;
      }
      return {
        text,
        stats: [{ label: 'Fleet Health', value: '100% OK', color: 'emerald' }],
      };
    }

    text += `Based on live analysis of actual generation vs. expected generation, the following inverters have experienced the greatest deficits:\n\n`;

    criticalInverters.slice(0, 5).forEach((inv, idx) => {
      let icon = inv.status === 'critical' ? '🔴' : '🟡';
      text += `#### ${idx + 1}. ${icon} ${inv.displayName || inv.id}\n`;
      text += `- **Health Score:** **${inv.healthScore.toFixed(1)}%**\n`;
      text += `- **Energy Loss:** **${Math.round(inv.totalLossKwh).toLocaleString()} kWh**\n`;
      text += `- **Detected Anomalies:** **${inv.faultCount} events**\n`;

      // Find top reason for this inverter
      const invAlerts = ctx.anomalyAlerts.filter((a) => a.inverterId === inv.id);
      if (invAlerts.length > 0) {
        text += `- **Primary Anomaly:** *${invAlerts[0].reason}*\n`;
      }
      text += `\n`;
    });

    text += `#### 🛠️ Immediate Recommended Action:\n`;
    text += `Dispatch a field inspection team to test **${criticalInverters[0].displayName || criticalInverters[0].id}** first, as it represents the highest cumulative kilowatt-hour shortfall in your fleet.`;

    return {
      text,
      stats: [
        { label: 'Urgent Inverter', value: criticalInverters[0]?.id || 'None', color: 'rose' },
        { label: 'Urgent Loss', value: `${Math.round(criticalInverters[0]?.totalLossKwh || 0).toLocaleString()} kWh`, color: 'rose' },
        { label: 'At Risk Units', value: `${criticalInverters.length}`, color: 'amber' },
      ],
    };
  }

  // 7. MAINTENANCE RECOMMENDATIONS
  if (
    q.includes('what maintenance actions are recommended') ||
    q.includes('maintenance') ||
    q.includes('action') ||
    q.includes('recommendation') ||
    q.includes('preventive') ||
    q.includes('service')
  ) {
    let text = `### 🛠️ Preventive Maintenance Recommendations\n\n`;
    text += `Based on real telemetry data and anomalies detected in your plant, here is a prioritized maintenance action plan:\n\n`;

    let actionStep = 1;

    // Check for inverter trips
    const hasTrips = Object.keys(anomalyReasons).some((r) => r.toLowerCase().includes('trip') || r.toLowerCase().includes('zero'));
    if (hasTrips || highSeverityCount > 0) {
      text += `#### ${actionStep++}. 🔴 High Priority: Inverter Trip & Breaker Inspection\n`;
      text += `- **Telemetry Finding:** Inverters logged zero or near-zero AC power during daylight hours with active solar irradiation.\n`;
      text += `- **Recommended Action:**\n`;
      text += `  - Inspect AC output circuit breakers and contactors.\n`;
      text += `  - Check inverter fault log on the physical display for grid-voltage, frequency trip, or ground fault (GFDI) codes.\n`;
      text += `  - Inspect DC main disconnect switch and surge protection devices (SPDs).\n\n`;
    }

    // Check for thermal throttling
    const hasThermal = Object.keys(anomalyReasons).some((r) => r.toLowerCase().includes('thermal') || r.toLowerCase().includes('temperature'));
    if (hasThermal) {
      text += `#### ${actionStep++}. 🌡️ Temperature & Cooling Fan Servicing\n`;
      text += `- **Telemetry Finding:** Elevated module or internal heatsink temperatures caused thermal derating (>50°C).\n`;
      text += `- **Recommended Action:**\n`;
      text += `  - Inspect and clean air intake filters on inverter enclosures.\n`;
      text += `  - Verify that forced-cooling ventilation fans spin freely without bearing friction.\n`;
      text += `  - Check heat sink fins for accumulated dust, debris, or bird nests.\n\n`;
    }

    // Check for string disconnect
    const hasString = Object.keys(anomalyReasons).some((r) => r.toLowerCase().includes('string') || r.toLowerCase().includes('circuit'));
    if (hasString) {
      text += `#### ${actionStep++}. 🔌 DC String & Combiner Box Audit\n`;
      text += `- **Telemetry Finding:** Persistent ~30%–38% power deficits indicate one or more disconnected DC strings.\n`;
      text += `- **Recommended Action:**\n`;
      text += `  - Measure open-circuit voltage ($V_{oc}$) and operating current ($I_{mp}$) on each string using a DC clamp meter.\n`;
      text += `  - Check for blown string fuses in DC combiner boxes.\n`;
      text += `  - Check MC4 connector crimps for thermal discoloration or loose contacts.\n\n`;
    }

    // Standard preventive items
    text += `#### ${actionStep++}. 🧹 Module Soiling & Shading Assessment\n`;
    text += `- Schedule automated or manual panel washing if dust, pollen, or bird droppings have accumulated.\n`;
    text += `- Perform a thermal infrared (IR) drone scan or handheld thermography inspection to detect cracked cells or hot spots.\n\n`;

    text += `#### ${actionStep++}. 📡 Communications & SCADA Health\n`;
    text += `- Verify RS-485 Modbus daisy-chain termination resistors and gateway uptime.\n`;
    text += `- Current reporting status: **${metrics.reportingInverters}/${metrics.totalInverters} inverters communicating** successfully.`;

    return {
      text,
      stats: [
        { label: 'Top Action', value: hasTrips ? 'Breaker Check' : hasThermal ? 'Fan Service' : 'String Audit', color: 'rose' },
        { label: 'Priority Units', value: criticalInverters.length > 0 ? criticalInverters[0].id : 'Fleet Normal', color: 'amber' },
        { label: 'Health Score', value: `${metrics.plantHealthScore}%`, color: 'emerald' },
      ],
    };
  }

  // 8. DATASET / CSV / UPLOAD QUESTIONS
  if (
    q.includes('dataset') ||
    q.includes('csv') ||
    q.includes('upload') ||
    q.includes('source') ||
    q.includes('data points') ||
    q.includes('readings')
  ) {
    let text = `### 📁 Telemetry Dataset Information\n\n`;
    text += `Here is the metadata for the active dataset currently driving this dashboard:\n\n`;
    text += `- **Data Origin:** ${isUsingCustomData ? '📂 Custom Uploaded CSV File' : '☀️ Plant 1 Generation & Weather Telemetry (Baseline)'}\n`;
    text += `- **Total Readings Analyzed:** **${totalRecords.toLocaleString()}** data points\n`;
    text += `- **Active Date Window:** **${dateRange[0]}** to **${dateRange[1]}**\n`;
    text += `- **Monitored Inverters:** **${inverterCount}** unique units\n`;
    text += `- **Anomaly Status:** **${metrics.totalFaultsCount}** anomalies detected across this dataset\n\n`;
    text += `If you upload a new generation or weather CSV using the **Upload CSV** button in the header, I will immediately recompute all KPIs, charts, and recommendations based on your new data!`;

    return {
      text,
      stats: [
        { label: 'Source', value: isUsingCustomData ? 'Custom CSV' : 'Plant 1', color: 'teal' },
        { label: 'Records', value: `${totalRecords.toLocaleString()}`, color: 'blue' },
        { label: 'Inverters', value: `${inverterCount}`, color: 'emerald' },
      ],
    };
  }

  // 9. WEATHER / IRRADIATION / TEMPERATURE
  if (
    q.includes('weather') ||
    q.includes('irradiation') ||
    q.includes('irradiance') ||
    q.includes('temperature') ||
    q.includes('ambient') ||
    q.includes('module temp')
  ) {
    let text = `### 🌤️ Solar Weather & Environmental Telemetry\n\n`;
    text += `Environmental factors directly influence the physical expected power model:\n\n`;
    text += `1. **Solar Irradiation ($kW/m^2$):**\n`;
    text += `   - Measures the solar energy flux hitting the PV array per unit area.\n`;
    text += `   - Peak clear-sky solar irradiance typically reaches $0.9 - 1.05 kW/m^2$ around solar noon.\n`;
    text += `   - Generation increases linearly with irradiance.\n\n`;
    text += `2. **Module Temperature (°C):**\n`;
    text += `   - Silicon photovoltaic cells suffer from a negative temperature coefficient (typically $-0.38\\%/^\\circ C$ above $25^\\circ C$ STC standard test conditions).\n`;
    text += `   - On sunny days with low wind, dark solar panels often reach $45^\\circ C - 60^\\circ C$, leading to significant efficiency derating.\n\n`;
    text += `3. **Weather Overlay Feature:**\n`;
    text += `   - You can toggle the **Weather** button on the Feature Hub Cards or in the chart controls to visually plot solar irradiance curves alongside actual inverter power output!`;

    return {
      text,
      stats: [
        { label: 'Weather Model', value: 'Physical PV', color: 'teal' },
        { label: 'Temp Derating', value: '-0.38%/°C', color: 'amber' },
        { label: 'Standard Temp', value: '25°C STC', color: 'blue' },
      ],
    };
  }

  // 10. DEFAULT / GENERAL QUERY RESPONSE
  // Provide an intelligent, grounded general response with guidance
  let defaultText = `### ☀️ SolarWatch Assistant\n\n`;
  defaultText += `I'm analyzing your active solar plant telemetry. Here is a snapshot of your current operating state:\n\n`;
  defaultText += `- **Plant Health Score:** **${metrics.plantHealthScore}%**\n`;
  defaultText += `- **Total Energy Generated:** **${metrics.totalActualEnergyKwh.toLocaleString()} kWh**\n`;
  defaultText += `- **Estimated Energy Loss:** **${metrics.totalEnergyLossKwh.toLocaleString()} kWh**\n`;
  defaultText += `- **Detected Anomalies:** **${metrics.totalFaultsCount}** events across **${inverterCount}** inverters\n`;
  if (selectedInverter !== 'all') {
    defaultText += `- **Filtered Inverter Focus:** **${selectedInverter}**\n`;
  }
  defaultText += `\nFeel free to ask me any question about your plant's performance, inverters, energy loss calculations, or click one of the suggested quick questions below!`;

  return {
    text: defaultText,
    stats: [
      { label: 'Health Score', value: `${metrics.plantHealthScore}%`, color: metrics.plantHealthScore >= 90 ? 'emerald' : 'amber' },
      { label: 'Loss', value: `${metrics.totalEnergyLossKwh.toLocaleString()} kWh`, color: 'rose' },
      { label: 'Anomalies', value: `${metrics.totalFaultsCount}`, color: 'amber' },
    ],
  };
}
