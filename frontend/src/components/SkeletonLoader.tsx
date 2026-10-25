/**
 * Smooth loading skeleton component shown during initial dataset computation or CSV ingestion.
 */

import React from 'react';

export const SkeletonLoader: React.FC = () => {
  return (
    <div className="flex-1 p-4 lg:p-6 space-y-6 animate-pulse" aria-label="Loading solar plant telemetry">
      {/* Metric Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-neutral-900/60 border border-neutral-800/80 rounded-xl p-4 h-32 flex flex-col justify-between">
            <div className="flex justify-between items-center">
              <div className="h-3 w-28 bg-neutral-800 rounded" />
              <div className="h-8 w-8 bg-neutral-800 rounded-lg" />
            </div>
            <div className="h-8 w-36 bg-neutral-800 rounded" />
            <div className="h-3 w-44 bg-neutral-800/80 rounded" />
          </div>
        ))}
      </div>

      {/* Main Chart Skeleton */}
      <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-xl p-4 h-[420px] flex flex-col justify-between">
        <div className="flex justify-between items-center mb-4">
          <div className="space-y-2">
            <div className="h-4 w-64 bg-neutral-800 rounded" />
            <div className="h-3 w-96 bg-neutral-800/60 rounded" />
          </div>
          <div className="h-6 w-32 bg-neutral-800 rounded" />
        </div>
        <div className="w-full flex-1 bg-neutral-950/40 rounded-lg border border-neutral-800/40" />
      </div>

      {/* Inverter Comparison Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-neutral-900/60 border border-neutral-800/80 rounded-xl p-4 h-[320px]">
          <div className="h-4 w-40 bg-neutral-800 rounded mb-4" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((k) => (
              <div key={k} className="h-6 bg-neutral-800/60 rounded" />
            ))}
          </div>
        </div>
        <div className="lg:col-span-7 bg-neutral-900/60 border border-neutral-800/80 rounded-xl p-4 h-[320px]">
          <div className="h-4 w-48 bg-neutral-800 rounded mb-4" />
          <div className="grid grid-cols-6 gap-2">
            {Array.from({ length: 18 }).map((_, idx) => (
              <div key={idx} className="h-12 bg-neutral-800/60 rounded" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
