/**
 * Feature Hub Cards matching the 5 cards at the bottom of the Solar Sense design:
 * 1. Generation (actual vs expected trends)
 * 2. Inverter Health (status, health matrix)
 * 3. Weather (solar irradiance & temp)
 * 4. Anomaly Records (browse and analyze)
 * 5. Energy Insights (AI physical explanations)
 */

import React from 'react';
import {
  Sun,
  Cpu,
  CloudSun,
  AlertTriangle,
  Leaf,
  ArrowRight,
} from 'lucide-react';

interface FeatureHubCardsProps {
  onNavigateSection: (sectionId: string) => void;
  showWeatherOverlay: boolean;
  onToggleWeather: () => void;
}

export const FeatureHubCards: React.FC<FeatureHubCardsProps> = ({
  onNavigateSection,
  showWeatherOverlay,
  onToggleWeather,
}) => {
  const cards = [
    {
      id: 'generation',
      title: 'Generation',
      description: 'View actual vs expected generation and performance trends.',
      icon: Sun,
      iconColor: 'text-amber-300 bg-amber-400/20 border-amber-400/40 shadow-[0_0_12px_rgba(251,191,36,0.3)]',
      action: () => onNavigateSection('main-power-chart'),
      bgGradient: 'from-amber-950/40 via-[#0b242c]/85 to-[#06181f]/90',
      accentBorder: 'border-teal-500/30 hover:border-amber-400/60 hover:shadow-[0_8px_30px_rgba(245,158,11,0.25)]',
    },
    {
      id: 'inverter-health',
      title: 'Inverter Health',
      description: 'Check inverter status, health and performance matrix.',
      icon: Cpu,
      iconColor: 'text-teal-300 bg-teal-400/20 border-teal-400/40 shadow-[0_0_12px_rgba(45,212,191,0.3)]',
      action: () => onNavigateSection('inverter-matrix'),
      bgGradient: 'from-teal-950/40 via-[#0b242c]/85 to-[#06181f]/90',
      accentBorder: 'border-teal-500/30 hover:border-teal-400/60 hover:shadow-[0_8px_30px_rgba(20,184,166,0.25)]',
    },
    {
      id: 'weather',
      title: 'Weather',
      description: showWeatherOverlay
        ? 'Irradiance overlay is currently active on power chart.'
        : 'Monitor weather conditions and their impact on generation.',
      icon: CloudSun,
      iconColor: 'text-cyan-300 bg-cyan-400/20 border-cyan-400/40 shadow-[0_0_12px_rgba(34,211,238,0.3)]',
      action: () => {
        onToggleWeather();
        onNavigateSection('main-power-chart');
      },
      bgGradient: 'from-cyan-950/40 via-[#0b242c]/85 to-[#06181f]/90',
      accentBorder: 'border-teal-500/30 hover:border-cyan-400/60 hover:shadow-[0_8px_30px_rgba(6,182,212,0.25)]',
    },
    {
      id: 'anomaly-records',
      title: 'Anomaly Records',
      description: 'Browse and analyze detected anomalies and shortfalls.',
      icon: AlertTriangle,
      iconColor: 'text-red-300 bg-red-400/20 border-red-400/40 shadow-[0_0_12px_rgba(248,113,113,0.3)]',
      action: () => onNavigateSection('fault-log'),
      bgGradient: 'from-red-950/40 via-[#0b242c]/85 to-[#06181f]/90',
      accentBorder: 'border-teal-500/30 hover:border-red-400/60 hover:shadow-[0_8px_30px_rgba(239,68,68,0.25)]',
    },
    {
      id: 'energy-insights',
      title: 'Energy Insights',
      description: 'Get physical loss calculations & model explanations.',
      icon: Leaf,
      iconColor: 'text-emerald-300 bg-emerald-400/20 border-emerald-400/40 shadow-[0_0_12px_rgba(52,211,153,0.3)]',
      action: () => onNavigateSection('how-it-works'),
      bgGradient: 'from-emerald-950/40 via-[#0b242c]/85 to-[#06181f]/90',
      accentBorder: 'border-teal-500/30 hover:border-emerald-400/60 hover:shadow-[0_8px_30px_rgba(16,185,129,0.25)]',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.id}
            onClick={card.action}
            className={`rounded-3xl p-5 bg-gradient-to-b ${card.bgGradient} backdrop-blur-xl border ${card.accentBorder} shadow-[0_8px_32px_rgba(0,0,0,0.3)] flex flex-col justify-between cursor-pointer group transition-all duration-300 transform hover:-translate-y-1`}
          >
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-9 h-9 rounded-2xl flex items-center justify-center border ${card.iconColor}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-white tracking-wide">
                  {card.title}
                </h4>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed group-hover:text-white transition-colors">
                {card.description}
              </p>
            </div>

            <div className="mt-5 pt-3 border-t border-teal-500/20 flex justify-end">
              <div className="w-7 h-7 rounded-full bg-[#06181f] border border-teal-400/40 flex items-center justify-center text-teal-300 group-hover:bg-gradient-to-r group-hover:from-teal-400 group-hover:to-emerald-400 group-hover:text-neutral-950 group-hover:border-transparent transition-all shadow-[0_0_10px_rgba(20,184,166,0.3)]">
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
