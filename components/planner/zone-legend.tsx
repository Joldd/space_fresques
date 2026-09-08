// components/planner/zone-legend.tsx
"use client";

import type { ZoneObject } from "@/lib/planner/types";

/** légende récapitulant les zones posées sur le plan (couleur + nom) */
export function ZoneLegend({ zones }: { zones: ZoneObject[] }) {
  if (zones.length === 0) return null;

  return (
    <div className="absolute bottom-4 left-4 z-10 max-w-56 rounded-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-[#232823]/90 backdrop-blur px-3 py-2.5 shadow-lg">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8368] dark:text-[#8FA090] mb-1.5">
        Zones
      </p>
      <ul className="flex flex-col gap-1 max-h-40 overflow-y-auto">
        {zones.map((zone) => (
          <li key={zone.id} className="flex items-center gap-2 text-sm text-[#4A4636] dark:text-[#D8D2BE]">
            <span
              className="h-3 w-3 shrink-0 rounded-sm border border-black/10 dark:border-white/20"
              style={{ backgroundColor: zone.color }}
            />
            <span className="truncate">{zone.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
