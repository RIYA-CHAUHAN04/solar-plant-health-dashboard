/**
 * Upload CSV Modal for Solar Sense AI.
 * Parses CSV files in the browser using Papa Parse with Solar Sense theme.
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
  const [previewResult, setPreviewResult] = useState<{ rowCount: number; records: SolarRecord[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileProcess = async (file: File) => {
    if (!file) return;
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      setErrorDetails({
        message: 'Unsupported file type. Please upload a comma-separated values (.csv) file.',
      });
      return;
    }

    setIsProcessing(true);
    setErrorDetails(null);
    setPreviewResult(null);

    try {
      const text = await file.text();
      const result: ParseCsvResult = await parseSolarCsv(text, sensitivity);

      if (!result.success || !result.records) {
        setErrorDetails({
          message: result.error || 'Failed to parse CSV.',
          missing: result.missingColumns,
        });
      } else {
        setPreviewResult({
          rowCount: result.rowCount || result.records.length,
          records: result.records,
        });
      }
    } catch (err: any) {
      setErrorDetails({
        message: `Error reading file: ${err.message || 'Unknown read error'}`,
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
    const sampleHeaders =
      'DATE_TIME,SOURCE_KEY,AC_POWER,IRRADIATION,AMBIENT_TEMPERATURE,MODULE_TEMPERATURE\n';
    const sampleRows = [
      '2020-05-15 06:00:00,INV-01,12.5,0.024,21.5,22.0',
      '2020-05-15 06:15:00,INV-01,48.2,0.085,22.1,23.4',
      '2020-05-15 12:00:00,INV-01,585.0,0.950,31.2,52.8',
      '2020-05-15 12:15:00,INV-01,592.4,0.962,31.4,53.5',
      '2020-05-15 12:00:00,INV-02,0.0,0.950,31.2,52.8',
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
        <div className="p-5 space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileProcess(e.dataTransfer.files[0]);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center ${
              isDragging
                ? 'border-teal-400 bg-teal-500/10 shadow-[0_0_20px_rgba(20,184,166,0.2)]'
                : 'border-teal-900/50 hover:border-teal-600/60 bg-[#061418]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileProcess(e.target.files[0]);
                }
              }}
            />

            {isProcessing ? (
              <div className="flex flex-col items-center py-3">
                <Loader2 className="w-8 h-8 text-teal-400 animate-spin mb-2" />
                <span className="text-xs text-neutral-300 font-medium">
                  Parsing CSV and calculating expected solar curves...
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center py-2">
                <div className="w-12 h-12 rounded-2xl bg-teal-950/60 border border-teal-800/40 flex items-center justify-center mb-2 text-teal-400">
                  <FileText className="w-6 h-6" />
                </div>
                <p className="text-xs font-semibold text-neutral-200">
                  Drop your solar CSV file here, or <span className="text-teal-400 underline">browse</span>
                </p>
                <p className="text-[11px] text-neutral-500 mt-1">
                  Supports Kaggle Plant 1 &amp; Plant 2 files or custom inverter exports
                </p>
              </div>
            )}
          </div>

          <div className="bg-[#061418] border border-teal-900/40 rounded-xl p-3 text-[11px] space-y-1.5">
            <div className="font-semibold text-neutral-300 flex items-center justify-between">
              <span>Required Schema Columns:</span>
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
                <span className="text-teal-300 font-bold">DATE_TIME</span>: Timestamp string (e.g. 2020-05-15 06:15:00)
              </div>
              <div>
                <span className="text-teal-300 font-bold">SOURCE_KEY</span>: Inverter ID (e.g. INV-01 or 1BY6WEcD...)
              </div>
              <div>
                <span className="text-teal-300 font-bold">AC_POWER</span>: Actual power output in kW
              </div>
            </div>
          </div>

          {errorDetails && (
            <div className="p-3.5 rounded-xl bg-red-500/20 border border-red-500/40 text-xs text-red-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-red-300 mb-0.5">Missing Required Columns</div>
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

          {previewResult && (
            <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-xs text-emerald-200 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-bold text-emerald-300 mb-0.5">CSV Parsed Successfully</div>
                <p className="text-[11px] text-emerald-200/90">
                  Ready to load <span className="font-mono font-bold text-white">{previewResult.rowCount.toLocaleString()}</span> readings into Solar Sense AI.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-teal-900/40 bg-[#061418] flex items-center justify-end gap-2">
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
  );
};
