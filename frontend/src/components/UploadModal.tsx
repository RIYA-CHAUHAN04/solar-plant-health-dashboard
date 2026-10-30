/**
 * Upload CSV Modal for Solar Sense AI.
 * Parses generation + optional weather CSV files in the browser using Papa Parse.
 * Supports Kaggle Plant 1 & Plant 2 formats plus custom inverter exports.
 */

import React, { useState, useRef } from 'react';
import {
  Upload,
  X,
  FileText,
  AlertCircle,
  CheckCircle2,
  Download,
  Loader2,
  CloudSun,
} from 'lucide-react';
import { parseSolarCsv, ParseCsvResult } from '../utils/solarCalculations';
import { SolarRecord } from '../types/solar';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataLoaded: (records: SolarRecord[]) => void;
  sensitivity: number;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onDataLoaded,
  sensitivity,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorDetails, setErrorDetails] = useState<{ message: string; missing?: string[] } | null>(null);
  const [previewResult, setPreviewResult] = useState<{
    rowCount: number;
    inverterCount?: number;
    anomalyCount?: number;
    samplingIntervalHours?: number;
    records: SolarRecord[];
  } | null>(null);
  const [genFileName, setGenFileName] = useState<string>('');
  const [weatherFileName, setWeatherFileName] = useState<string>('');
  const [genCsvText, setGenCsvText] = useState<string | null>(null);
  const [weatherCsvText, setWeatherCsvText] = useState<string | null>(null);

  const genFileInputRef = useRef<HTMLInputElement>(null);
  const weatherFileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  /** Read a file as text and validate it's a CSV */
  const readCsvFile = async (file: File): Promise<string | null> => {
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      setErrorDetails({
        message: 'Unsupported file type. Please upload a comma-separated values (.csv) file.',
      });
      return null;
    }
    return file.text();
  };

  /** Process generation CSV (required) */
  const handleGenFileSelect = async (file: File) => {
    setErrorDetails(null);
    setPreviewResult(null);
    const text = await readCsvFile(file);
    if (text === null) return;
    setGenFileName(file.name);
    setGenCsvText(text);
    // Auto-process with current weather CSV if already loaded
    await processFiles(text, weatherCsvText);
  };

  /** Process weather CSV (optional) */
  const handleWeatherFileSelect = async (file: File) => {
    setErrorDetails(null);
    const text = await readCsvFile(file);
    if (text === null) return;
    setWeatherFileName(file.name);
    setWeatherCsvText(text);
    // Re-process with updated weather data
    if (genCsvText) {
      await processFiles(genCsvText, text);
    }
  };

  /** Run parseSolarCsv with current gen + weather texts */
  const processFiles = async (gen: string | null, weather: string | null) => {
    if (!gen) return;
    setIsProcessing(true);
    setErrorDetails(null);
    setPreviewResult(null);

    try {
      let result: ParseCsvResult;
      if (weather) {
        result = await parseSolarCsv(gen, weather, sensitivity);
      } else {
        result = await parseSolarCsv(gen, sensitivity);
      }

      if (!result.success || !result.records) {
        setErrorDetails({
          message: result.error || 'Failed to parse CSV.',
          missing: result.missingColumns,
        });
      } else {
        setPreviewResult({
          rowCount: result.rowCount || result.records.length,
          inverterCount: result.inverterCount,
          anomalyCount: result.anomalyCount,
          samplingIntervalHours: result.samplingIntervalHours,
          records: result.records,
        });
      }
    } catch (err: any) {
      setErrorDetails({
        message: `Error parsing file: ${err.message || 'Unknown error'}`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyData = () => {
    if (previewResult && previewResult.records) {
      onDataLoaded(previewResult.records);
      onClose();
    }
  };

  const handleDownloadSample = () => {
    // Multi-inverter template so the peer-baseline works correctly
    const sampleHeaders =
      'DATE_TIME,SOURCE_KEY,AC_POWER,DC_POWER,DAILY_YIELD,IRRADIATION,AMBIENT_TEMPERATURE,MODULE_TEMPERATURE\n';
    const sampleRows = [
      '2020-05-15 06:00:00,INV-01,12.5,13.1,0.0,0.024,21.5,22.0',
      '2020-05-15 06:00:00,INV-02,11.8,12.4,0.0,0.024,21.5,22.0',
      '2020-05-15 06:15:00,INV-01,48.2,50.6,11.2,0.085,22.1,23.4',
      '2020-05-15 06:15:00,INV-02,51.0,53.5,12.1,0.085,22.1,23.4',
      '2020-05-15 12:00:00,INV-01,585.0,614.0,3420.0,0.950,31.2,52.8',
      '2020-05-15 12:00:00,INV-02,0.0,0.0,3410.0,0.950,31.2,52.8',
      '2020-05-15 12:15:00,INV-01,592.4,621.8,3568.0,0.962,31.4,53.5',
      '2020-05-15 12:15:00,INV-02,588.1,617.0,3550.0,0.962,31.4,53.5',
    ].join('\n');

    const blob = new Blob([sampleHeaders + sampleRows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'solar_sample_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setGenFileName('');
    setWeatherFileName('');
    setGenCsvText(null);
    setWeatherCsvText(null);
    setPreviewResult(null);
    setErrorDetails(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0a1c22] border border-teal-800/60 rounded-2xl w-full max-w-xl shadow-[0_12px_48px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-4 border-b border-teal-900/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
              <Upload className="w-4 h-4 text-teal-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Upload Plant CSV</h3>
              <p className="text-xs text-neutral-400">
                In-browser parsing via Papa Parse. Replaces active dashboard dataset.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-teal-900/30 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[70vh]">

          {/* Generation CSV Drop Zone (Required) */}
          <div>
            <p className="text-xs font-semibold text-neutral-300 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-teal-400" />
              Generation CSV
              <span className="text-red-400 text-[10px]">(required)</span>
            </p>
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleGenFileSelect(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => genFileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center ${
                isDragging
                  ? 'border-teal-400 bg-teal-500/10 shadow-[0_0_20px_rgba(20,184,166,0.2)]'
                  : genFileName
                  ? 'border-teal-600/60 bg-teal-950/30'
                  : 'border-teal-900/50 hover:border-teal-600/60 bg-[#061418]'
              }`}
            >
              <input
                ref={genFileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleGenFileSelect(e.target.files[0]);
                  }
                }}
              />
              {isProcessing ? (
                <div className="flex flex-col items-center py-2">
                  <Loader2 className="w-7 h-7 text-teal-400 animate-spin mb-1.5" />
                  <span className="text-xs text-neutral-300 font-medium">
                    Parsing CSV and calculating expected solar curves…
                  </span>
                </div>
              ) : genFileName ? (
                <div className="flex flex-col items-center py-1">
                  <CheckCircle2 className="w-6 h-6 text-teal-400 mb-1" />
                  <p className="text-xs font-semibold text-teal-200">{genFileName}</p>
                  <p className="text-[10px] text-neutral-500 mt-0.5">Click to replace</p>
                </div>
              ) : (
                <div className="flex flex-col items-center py-2">
                  <div className="w-10 h-10 rounded-2xl bg-teal-950/60 border border-teal-800/40 flex items-center justify-center mb-2 text-teal-400">
                    <FileText className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-semibold text-neutral-200">
                    Drop generation CSV here, or <span className="text-teal-400 underline">browse</span>
                  </p>
                  <p className="text-[11px] text-neutral-500 mt-1">
                    Kaggle Plant 1 &amp; Plant 2 or custom inverter export
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Weather CSV Drop Zone (Optional) */}
          <div>
            <p className="text-xs font-semibold text-neutral-300 mb-1.5 flex items-center gap-1.5">
              <CloudSun className="w-3.5 h-3.5 text-amber-400" />
              Weather Sensor CSV
              <span className="text-neutral-500 text-[10px]">(optional — improves expected power accuracy)</span>
            </p>
            <div
              onClick={() => weatherFileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-3.5 text-center cursor-pointer transition-all flex items-center justify-center gap-3 ${
                weatherFileName
                  ? 'border-amber-600/50 bg-amber-950/20'
                  : 'border-teal-900/40 hover:border-teal-700/50 bg-[#061418]'
              }`}
            >
              <input
                ref={weatherFileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleWeatherFileSelect(e.target.files[0]);
                  }
                }}
              />
              {weatherFileName ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                  <div className="text-left">
                    <p className="text-xs font-semibold text-amber-200">{weatherFileName}</p>
                    <p className="text-[10px] text-neutral-500">Click to replace</p>
                  </div>
                </>
              ) : (
                <>
                  <CloudSun className="w-4 h-4 text-neutral-500 shrink-0" />
                  <p className="text-[11px] text-neutral-500">
                    Optional: IRRADIATION, AMBIENT_TEMPERATURE, MODULE_TEMPERATURE
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Schema hint */}
          <div className="bg-[#061418] border border-teal-900/40 rounded-xl p-3 text-[11px] space-y-1.5">
            <div className="font-semibold text-neutral-300 flex items-center justify-between">
              <span>Required &amp; Optional Columns:</span>
              <button
                type="button"
                onClick={handleDownloadSample}
                className="text-teal-400 hover:underline flex items-center gap-1 font-normal text-[10px]"
              >
                <Download className="w-3 h-3" />
                Download template
              </button>
            </div>
            <div className="font-mono text-neutral-400 space-y-0.5 text-[10px]">
              <div>
                <span className="text-teal-300 font-bold">DATE_TIME</span>
                {' '}— timestamp (2020-05-15 06:15:00 or 15-05-2020 14:30)
              </div>
              <div>
                <span className="text-teal-300 font-bold">SOURCE_KEY</span>
                {' '}— inverter ID (INV-01 or Kaggle hash)
              </div>
              <div>
                <span className="text-teal-300 font-bold">AC_POWER</span>
                {' '}— actual output in kW
              </div>
              <div className="text-neutral-500">
                <span className="text-amber-400/80">IRRADIATION, AMBIENT_TEMPERATURE, MODULE_TEMPERATURE</span>
                {' '}— optional, improves expected-power model
              </div>
            </div>
          </div>

          {/* Error Panel */}
          {errorDetails && (
            <div className="p-3.5 rounded-xl bg-red-500/20 border border-red-500/40 text-xs text-red-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-red-300 mb-0.5">Upload Error</div>
                <p className="text-[11px] leading-relaxed">{errorDetails.message}</p>
                {errorDetails.missing && errorDetails.missing.length > 0 && (
                  <ul className="list-disc list-inside mt-1 font-mono text-[11px] text-red-300 font-bold">
                    {errorDetails.missing.map((col) => (
                      <li key={col}>{col}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Success Panel */}
          {previewResult && (
            <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-xs text-emerald-200 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-bold text-emerald-300 mb-1">CSV Parsed Successfully</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
                  <span className="text-emerald-200/70">Readings:</span>
                  <span className="font-mono font-bold text-white">{previewResult.rowCount.toLocaleString()}</span>
                  {previewResult.inverterCount != null && (
                    <>
                      <span className="text-emerald-200/70">Inverters:</span>
                      <span className="font-mono font-bold text-white">{previewResult.inverterCount}</span>
                    </>
                  )}
                  {previewResult.samplingIntervalHours != null && (
                    <>
                      <span className="text-emerald-200/70">Interval:</span>
                      <span className="font-mono font-bold text-white">
                        {previewResult.samplingIntervalHours === 0.25
                          ? '15 min'
                          : `${Math.round(previewResult.samplingIntervalHours * 60)} min`}
                      </span>
                    </>
                  )}
                  {previewResult.anomalyCount != null && (
                    <>
                      <span className="text-emerald-200/70">Anomalies:</span>
                      <span className="font-mono font-bold text-amber-300">{previewResult.anomalyCount.toLocaleString()}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-teal-900/40 bg-[#061418] flex items-center justify-between gap-2">
          <button
            onClick={handleReset}
            className="px-3 py-1.5 rounded-xl text-xs text-neutral-500 hover:text-neutral-200 hover:bg-teal-900/20 transition-colors"
          >
            Reset
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl text-xs text-neutral-400 hover:text-white hover:bg-teal-900/30 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApplyData}
              disabled={!previewResult}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${
                previewResult
                  ? 'bg-teal-500 text-neutral-950 hover:bg-teal-400 cursor-pointer shadow-[0_0_15px_rgba(20,184,166,0.4)]'
                  : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
              }`}
            >
              Apply to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
