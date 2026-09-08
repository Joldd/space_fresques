// components/planner/zone-panel.tsx
"use client";

import { useState } from "react";
import type { ZoneObject } from "@/lib/planner/types";
import { COLOR_PALETTE } from "@/lib/planner/color";
import { useCloseOnOutsideClick } from "@/lib/planner/use-close-on-outside-click";
import { MIN_ZONE_SIZE_CM } from "@/lib/planner/zones";
import { SizeFields } from "./size-fields";

type ZonePanelProps = {
  zone: ZoneObject;
  /** position d'ancrage, en px, relative au conteneur du canvas */
  x: number;
  y: number;
  onRename: (name: string) => void;
  onResize: (widthCm: number, heightCm: number) => void;
  onRecolor: (color: string) => void;
  onDelete: () => void;
  onClose: () => void;
  /** appelé une seule fois au début d'une édition (focus d'un champ, clic sur une pastille) — empile l'état pour Ctrl+Z */
  onBeginChange: () => void;
};

/**
 * Menu contextuel (nom, dimensions, couleur, suppression) d'une zone
 * sélectionnée. Le composant parent doit le monter avec `key={zone.id}` :
 * passer d'une zone à l'autre remonte alors le panneau et réinitialise ce
 * brouillon de nom, sans effet de synchronisation supplémentaire.
 */
export function ZonePanel({
  zone,
  x,
  y,
  onRename,
  onResize,
  onRecolor,
  onDelete,
  onClose,
  onBeginChange,
}: ZonePanelProps) {
  const [name, setName] = useState(zone.name);
  const panelRef = useCloseOnOutsideClick<HTMLDivElement>(onClose);

  function commitName() {
    const trimmed = name.trim();
    if (trimmed && trimmed !== zone.name) onRename(trimmed);
    else setName(zone.name);
  }

  return (
    <div
      ref={panelRef}
      style={{ left: x, top: y }}
      className="absolute z-20 w-60 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#232823] p-3 shadow-xl flex flex-col gap-3"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <input
        type="text"
        value={name}
        onFocus={onBeginChange}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        placeholder="Nom de la zone"
        className="w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-2.5 py-1.5 text-sm text-[#4A4636] dark:text-[#D8D2BE] outline-none focus:ring-2 focus:ring-[#7A9E7E]"
      />

      <SizeFields
        widthM={zone.widthCm / 100}
        heightM={zone.heightCm / 100}
        widthLabel="Largeur"
        heightLabel="Hauteur"
        min={MIN_ZONE_SIZE_CM / 100}
        onResize={(widthM, heightM) => onResize(Math.round(widthM * 100), Math.round(heightM * 100))}
        onBeginEdit={onBeginChange}
      />

      <div className="flex items-center gap-2 flex-wrap">
        {COLOR_PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              onBeginChange();
              onRecolor(c);
            }}
            aria-label={`Couleur ${c}`}
            title={c}
            className="h-6 w-6 shrink-0 rounded-full border-2 transition-transform hover:scale-110"
            style={{ backgroundColor: c, borderColor: c === zone.color ? "#3F5A45" : "transparent" }}
          />
        ))}
        <input
          type="color"
          value={zone.color}
          onFocus={onBeginChange}
          onChange={(e) => onRecolor(e.target.value)}
          title="Couleur personnalisée"
          className="h-6 w-7 shrink-0 cursor-pointer rounded border border-black/10 dark:border-white/20 bg-transparent p-0"
        />
      </div>

      <button
        type="button"
        onClick={onDelete}
        className="rounded-xl bg-[#D9765F] text-white text-sm font-medium py-1.5 hover:bg-[#c76650] transition-colors"
      >
        🗑 Supprimer la zone
      </button>
    </div>
  );
}
