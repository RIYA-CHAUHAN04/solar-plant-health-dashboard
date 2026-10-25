/**
 * How It Works Panel for Solar Sense AI.
 * Conveys the core physical model and logic in 3 concise, clear bullets.
 */

import React from 'react';
import { Info, Sun, AlertTriangle, Clock } from 'lucide-react';

export const HowItWorksFooter: React.FC = () => {
  return (
    <footer id="how-it-works" className="bg-[#0b242c]/80 backdrop-blur-xl border border-teal-500/30 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)] text-neutral-300 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-md bg-teal-500/20 text-teal-400 flex items-center justify-center">
          <Info className="w-3.5 h-3.5" />
        </div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-teal-300">
          How This Works • Physical &amp; Anomaly Logic
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        {/* Bullet 1 */}
        <div className="flex items-start gap-3 bg-[#061418] border border-teal-900/40 p-3.5 rounded-xl">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5">
            <Sun className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="font-bold text-white mb-0.5">Physical Model Prediction</div>
            <p className="text-neutral-400 text-[11px] leading-relaxed">
              Expected output is predicted from solar irradiation and module temperature, accounting for standard silicon thermal derating (-0.38% per °C above 25°C).
            </p>
          </div>
        </div>

        {/* Bullet 2 */}
        <div className="flex items-start gap-3 bg-[#061418] border border-teal-900/40 p-3.5 rounded-xl">
          <div className="w-8 h-8 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <div>
            <div className="font-bold text-white mb-0.5">Daylight Anomaly Flagging</div>
            <p className="text-neutral-400 text-[11px] leading-relaxed">
              A fault is flagged when actual output falls significantly below expected output during daylight hours. Night-time zero power is normal and never flagged.
            </p>
          </div>
        </div>

        {/* Bullet 3 */}
        <div className="flex items-start gap-3 bg-[#061418] border border-teal-900/40 p-3.5 rounded-xl">
          <div className="w-8 h-8 rounded-lg bg-teal-500/15 border border-teal-500/30 flex items-center justify-center shrink-0 mt-0.5">
            <Clock className="w-4 h-4 text-teal-400" />
          </div>
          <div>
            <div className="font-bold text-white mb-0.5">Energy Loss Accounting</div>
            <p className="text-neutral-400 text-[11px] leading-relaxed">
              Energy loss is the generation shortfall integrated over time (Shortfall kW × 0.25 hours for 15-minute intervals), revealing true lost revenue.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};
