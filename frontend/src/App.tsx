/**
 * Solar Sense AI: Solar Plant Health Dashboard
 * High-brightness, luminous frosted glass UI with panoramic solar farm backdrop.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Sun,
  Search,
  Calendar,
  Upload,
  Download,
  Menu,
  X,
  ChevronDown,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  SolarRecord,
  FilterState,
  ChartDataPoint,
} from './types/solar';
import { generateSampleDataset } from './data/sampleDataset';
import {
  computeDashboardMetrics,
  generateChartSeries,
  computeInverterSummaries,
  extractAnomalyAlerts,
  evaluateAnomaly,
  exportAlertsToCsv,
} from './utils/solarCalculations';
import { Sidebar } from './components/Sidebar';
import { HeroSection } from './components/HeroSection';
import { MetricCards } from './components/MetricCards';
import { FeatureHubCards } from './components/FeatureHubCards';
import { PowerChart } from './components/PowerChart';
import { InverterBars } from './components/InverterBars';
import { InverterGrid } from './components/InverterGrid';
import { AlertsTable } from './components/AlertsTable';
import { UploadModal } from './components/UploadModal';
import { HowItWorksFooter } from './components/HowItWorksFooter';
import { SkeletonLoader } from './components/SkeletonLoader';

export default function App() {
  const [rawRecords, setRawRecords] = useState<SolarRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUsingCustomData, setIsUsingCustomData] = useState<boolean>(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [jumpTimestamp, setJumpTimestamp] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [globalSearch, setGlobalSearch] = useState<string>('');

  // Core filters state
  const [filters, setFilters] = useState<FilterState>({
    selectedInverter: 'all',
    dateRange: ['2020-05-15', '2020-05-21'],
    sensitivity: 0.25,
    showFaultsOnly: false,
    showWeatherOverlay: true,
  });

 
  // Load real plant data from the Python API
  useEffect(() => {
    const loadPlantData = async () => {
      try {
        const response = await fetch(
  'https://solar-plant-health-api.onrender.com/api/plant-data'
);

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const result = await response.json();

        const records: SolarRecord[] = result.data.map(
          (item: Record<string, any>) => {
            const dateTime = String(item.DATE_TIME);
            const timestamp = new Date(
              dateTime.replace(' ', 'T')
            ).getTime();

            const acPower = Number(item.AC_POWER ?? 0);
            const fleetMedian = Number(item.FLEET_AC_MEDIAN ?? 0);

            // Fleet median is a comparison-based estimate,
            // not a measured expected-power value.
            const expectedPower = Math.max(acPower, fleetMedian);

            const status = String(item.HEALTH_STATUS ?? '');
            const isAnomaly = Boolean(item.IS_ANOMALOUS);

            return {
              dateTime,
              timestamp,
              sourceKey: String(item.SOURCE_KEY),
              acPower,
              irradiation: item.IRRADIATION == null
                ? null : Number(item.IRRADIATION),
              ambientTemp: item.AMBIENT_TEMPERATURE == null
                ? null : Number(item.AMBIENT_TEMPERATURE),
              moduleTemp: item.MODULE_TEMPERATURE == null
                ? null : Number(item.MODULE_TEMPERATURE),
              expectedPower,
              isAnomaly,
              anomalyReason: isAnomaly ? status : '',
              energyLossKwh: Math.max(
                0,
                (expectedPower - acPower) * 0.25
              ),
              severity: isAnomaly
                ? status === 'CRITICAL_INVERTER_TRIP'
                  ? 'High'
                  : 'Medium'
                : null,
            };
          }
        );

        setRawRecords(records);
        setIsUsingCustomData(false);

        if (records.length > 0) {
          const dates = records
            .map((record) => record.dateTime.substring(0, 10))
            .sort();

          setFilters((prev) => ({
            ...prev,
            dateRange: [dates[0], dates[dates.length - 1]],
          }));
        }
      } catch (error) {
        console.error('Failed to load plant data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPlantData();
  }, []);

  const availableDates = useMemo(() => {
    if (rawRecords.length === 0) {
      return { min: '2020-05-15', max: '2020-05-21' };
    }
    const dates = rawRecords.map((r) => r.dateTime.substring(0, 10)).sort();
    return {
      min: dates[0] || '2020-05-15',
      max: dates[dates.length - 1] || '2020-05-21',
    };
  }, [rawRecords]);

  // Dynamically re-evaluate anomalies based on sensitivity threshold
   const recordsWithSensitivity = useMemo(() => {
    // Keep backend anomaly labels for the real plant dataset.
    // Custom uploaded data uses the frontend sensitivity logic.
    if (!isUsingCustomData) {
      return rawRecords;
    }

    return rawRecords.map((r) => {
      const evaluated = evaluateAnomaly(
        r.acPower,
        r.expectedPower,
        r.irradiation,
        r.moduleTemp,
        filters.sensitivity
      );

      let lossKwh = 0;

      if (r.expectedPower > r.acPower && r.expectedPower > 1.0) {
        lossKwh = Number(
          ((r.expectedPower - r.acPower) * 0.25).toFixed(3)
        );
      }

      if (r.expectedPower <= 0.1) {
        lossKwh = 0;
      }

      return {
        ...r,
        isAnomaly: evaluated.isAnomaly,
        anomalyReason: evaluated.reason || r.anomalyReason,
        severity: evaluated.severity,
        energyLossKwh: lossKwh,
      };
    });
  }, [rawRecords, filters.sensitivity, isUsingCustomData]);

    
  // Date filtering
  const dateFilteredRecords = useMemo(() => {
    const [startStr, endStr] = filters.dateRange;
    return recordsWithSensitivity.filter((r) => {
      const datePart = r.dateTime.substring(0, 10);
      return datePart >= startStr && datePart <= endStr;
    });
  }, [recordsWithSensitivity, filters.dateRange]);

  // Memoized aggregations
  const metrics = useMemo(() => {
    return computeDashboardMetrics(dateFilteredRecords);
  }, [dateFilteredRecords]);

  const inverterSummaries = useMemo(() => {
    return computeInverterSummaries(dateFilteredRecords);
  }, [dateFilteredRecords]);

  const chartSeries = useMemo(() => {
    return generateChartSeries(dateFilteredRecords, filters.selectedInverter);
  }, [dateFilteredRecords, filters.selectedInverter]);

  const anomalyAlerts = useMemo(() => {
    return extractAnomalyAlerts(dateFilteredRecords);
  }, [dateFilteredRecords]);

  // Handlers
  const handleFilterChange = useCallback((newFilters: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const handleSelectInverter = useCallback((inverterId: string) => {
    setFilters((prev) => ({ ...prev, selectedInverter: inverterId }));
  }, []);

  const handleSelectAlertTimestamp = useCallback((timestamp: number) => {
    setJumpTimestamp(timestamp);
    const chartEl = document.getElementById('main-power-chart');
    if (chartEl) {
      chartEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  const handleDataLoaded = useCallback((newRecords: SolarRecord[]) => {
    setIsLoading(true);
    setTimeout(() => {
      setRawRecords(newRecords);
      setIsUsingCustomData(true);
      if (newRecords.length > 0) {
        const dates = newRecords.map((r) => r.dateTime.substring(0, 10)).sort();
        setFilters((prev) => ({
          ...prev,
          selectedInverter: 'all',
          dateRange: [dates[0], dates[dates.length - 1]],
        }));
      }
      setIsLoading(false);
    }, 300);
  }, []);

  const handleResetSampleData = useCallback(() => {
    setIsLoading(true);
    setTimeout(() => {
      const sample = generateSampleDataset();
      setRawRecords(sample);
      setIsUsingCustomData(false);
      setFilters((prev) => ({
        ...prev,
        selectedInverter: 'all',
        dateRange: ['2020-05-15', '2020-05-21'],
        sensitivity: 0.25,
      }));
      setIsLoading(false);
    }, 300);
  }, []);

  const handleExportAlerts = useCallback(() => {
    exportAlertsToCsv(anomalyAlerts, `SolarSense_${filters.selectedInverter}_Alerts`);
  }, [anomalyAlerts, filters.selectedInverter]);

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    if (tabId === 'overview') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (tabId === 'analytics') {
      scrollToSection('main-power-chart');
    } else if (tabId === 'inverters') {
      scrollToSection('inverter-matrix');
    } else if (tabId === 'anomalies' || tabId === 'alerts') {
      scrollToSection('fault-log');
    } else if (tabId === 'settings') {
      setIsUploadModalOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#071920] text-slate-100 flex flex-col font-sans selection:bg-teal-400 selection:text-neutral-950 relative overflow-x-hidden">
      {/* Background Panoramic Solar Landscape (Vividly Visible & Bright) */}
      <div
        className="fixed inset-0 pointer-events-none bg-cover bg-center transition-all duration-700"
        style={{
          backgroundImage: `url('/assets/aistudio/WhatsApp_Image_2026-10-25_at_5.34.27_PM_31923755.jpeg')`,
          backgroundPosition: 'center 30%',
          opacity: 0.38,
          filter: 'brightness(1.15) saturate(1.2)',
        }}
      />

      {/* Luminous Golden Sun Flares and Ambient Radial Glows */}
      <div className="fixed top-0 right-1/4 w-[700px] h-[700px] rounded-full bg-gradient-to-br from-amber-400/25 via-yellow-400/15 to-transparent blur-[130px] pointer-events-none" />
      <div className="fixed top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-teal-400/18 blur-[120px] pointer-events-none" />
      <div className="fixed bottom-0 right-10 w-[500px] h-[500px] rounded-full bg-emerald-500/15 blur-[120px] pointer-events-none" />

      {/* Top Bar matching Solar Sense Mockup */}
      <header className="h-16 border-b border-teal-500/30 bg-[#081e26]/85 backdrop-blur-xl px-4 lg:px-6 flex items-center justify-between gap-4 sticky top-0 z-40 shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
        {/* Mobile menu toggle & Global Search */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl text-neutral-300 hover:text-white hover:bg-teal-900/40"
            aria-label="Toggle Navigation"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Search bar from mockup */}
          <div className="relative hidden sm:block w-72 lg:w-96">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-teal-300" />
            <input
              type="text"
              placeholder="Search by inverter ID, date or keyword..."
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="w-full bg-[#0a232b]/80 border border-teal-500/35 rounded-full pl-10 pr-4 py-2 text-xs text-white placeholder:text-neutral-400 focus:outline-none focus:border-teal-300 focus:ring-1 focus:ring-teal-400 shadow-[inset_0_1px_3px_rgba(0,0,0,0.3)]"
            />
          </div>
        </div>

        {/* Right Zone Controls: Date selector, Inverter selector, Avatar */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          {/* Date Range Selector Pill */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0a232b]/80 border border-teal-500/35 text-xs text-white font-semibold shadow-xs">
            <Calendar className="w-3.5 h-3.5 text-teal-300" />
            <span className="hidden md:inline font-mono">
              {filters.dateRange[0]} – {filters.dateRange[1]}
            </span>
            <span className="md:hidden font-mono">7 Days</span>
            <ChevronDown className="w-3.5 h-3.5 text-teal-400" />
          </div>

          {/* Inverter Selector Pill */}
          <div className="relative">
            <select
              value={filters.selectedInverter}
              onChange={(e) => handleSelectInverter(e.target.value)}
              className="appearance-none bg-[#0a232b]/80 border border-teal-500/35 rounded-full py-1.5 pl-3.5 pr-8 text-xs text-teal-200 font-bold focus:outline-none focus:border-teal-300 cursor-pointer shadow-xs"
            >
              <option value="all">All Inverters</option>
              {inverterSummaries.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.id} {inv.faultCount > 0 ? `(!${inv.faultCount})` : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-teal-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Upload Button */}
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="hidden lg:flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-neutral-950 font-bold text-xs transition-all shadow-[0_0_15px_rgba(20,184,166,0.35)] cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-neutral-950" />
            <span>Upload CSV</span>
          </button>

          {/* User Profile Avatar Pill matching "SJ" */}
          <div
            className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-400 via-emerald-400 to-cyan-300 text-neutral-950 font-extrabold text-xs flex items-center justify-center shadow-[0_0_15px_rgba(45,212,191,0.5)] cursor-pointer transform hover:scale-105 transition-transform"
            title="Solar Plant Operator (SJ)"
          >
            SJ
          </div>
        </div>
      </header>

      {/* Main Workspace Layout with Translucent Panes */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* Left Sidebar */}
        <Sidebar
          filters={filters}
          onFilterChange={handleFilterChange}
          inverterSummaries={inverterSummaries}
          onUploadClick={() => setIsUploadModalOpen(true)}
          onExportAlerts={handleExportAlerts}
          onResetSampleData={handleResetSampleData}
          alertsCount={anomalyAlerts.length}
          availableDates={availableDates}
          isUsingCustomData={isUsingCustomData}
          totalRecordsCount={rawRecords.length}
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />

        {/* Main Dashboard Canvas */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {isLoading ? (
            <SkeletonLoader />
          ) : (
            <>
              {/* 1. Hero Section with Visible Panoramic Solar Landscape, Recent Alerts, and Aerial 22-Inverter Field */}
              <HeroSection
                onExploreDashboard={() => scrollToSection('main-power-chart')}
                recentAlerts={anomalyAlerts}
                inverterSummaries={inverterSummaries}
                onSelectAlertTimestamp={handleSelectAlertTimestamp}
                onSelectInverter={handleSelectInverter}
                onViewAllAlerts={() => scrollToSection('fault-log')}
              />

              {/* 2. Top Row: 4 Metric Cards with Glowing Wave Sparklines */}
              <MetricCards
                metrics={metrics}
                selectedInverter={filters.selectedInverter}
                totalDataPoints={dateFilteredRecords.length}
              />

              {/* 3. 5 Feature Navigation Cards (Generation, Inverter Health, Weather, Anomaly Records, Energy Insights) */}
              <FeatureHubCards
                onNavigateSection={scrollToSection}
                showWeatherOverlay={filters.showWeatherOverlay}
                onToggleWeather={() =>
                  handleFilterChange({ showWeatherOverlay: !filters.showWeatherOverlay })
                }
              />

              {/* 4. Main Generation Power Chart (Actual vs Expected + Brush + Weather Overlay) */}
              <section id="main-power-chart">
                <PowerChart
                  data={chartSeries}
                  selectedInverter={filters.selectedInverter}
                  showWeatherOverlay={filters.showWeatherOverlay}
                  jumpTimestamp={jumpTimestamp}
                  onSelectInverter={handleSelectInverter}
                />
              </section>

              {/* 5. Inverter Comparison: Horizontal Loss Bar Chart + 22 Inverter Health Grid */}
              <section id="inverter-matrix" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5">
                  <InverterBars
                    inverterSummaries={inverterSummaries}
                    selectedInverter={filters.selectedInverter}
                    onSelectInverter={handleSelectInverter}
                  />
                </div>
                <div className="lg:col-span-7">
                  <InverterGrid
                    inverterSummaries={inverterSummaries}
                    selectedInverter={filters.selectedInverter}
                    onSelectInverter={handleSelectInverter}
                  />
                </div>
              </section>

              {/* 6. Fault & Anomaly Log Table (Searchable, Sortable, 10 per page, Jump) */}
              <section id="fault-log">
                <AlertsTable
                  alerts={anomalyAlerts}
                  onSelectAlertTimestamp={handleSelectAlertTimestamp}
                  selectedInverter={filters.selectedInverter}
                />
              </section>

              {/* 7. How This Works Footer Panel */}
              <HowItWorksFooter />
            </>
          )}
        </main>
      </div>

      {/* CSV Upload Modal */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onDataLoaded={handleDataLoaded}
        sensitivity={filters.sensitivity}
      />
    </div>
  );
}
