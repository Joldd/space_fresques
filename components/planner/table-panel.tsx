// components/planner/table-panel.tsx
"use client";

import { useState } from "react";
import type { TableObject } from "@/lib/planner/types";
import { COLOR_PALETTE, DEFAULT_TABLE_COLOR } from "@/lib/planner/color";
import { useCloseOnOutsideClick } from "@/lib/planner/use-close-on-outside-click";
import { SizeFields } from "./size-fields";

type TablePanelProps = {
  table: TableObject;
  /** position d'ancrage, en px, relative au conteneur du canvas */
  x: number;
  y: number;
  onRename: (name: string) => void;
  onResize: (widthCm: number, depthCm: number) => void;
  onRecolor: (color: string) => void;
  onRotate: () => void;
  onDelete: () => void;
  onClose: () => void;
  /** appelé une seule fois au début d'une édition (focus d'un champ, clic sur une pastille) — empile l'état pour Ctrl+Z */
  onBeginChange: () => void;
};

/**
 * Menu contextuel (nom, dimensions, couleur, rotation, suppression) d'une
 * table sélectionnée seule — même principe que ZonePanel (à monter avec
 * `key={table.id}` pour réinitialiser le brouillon de nom). Une table ne se
 * redimensionne pas à la souris (contrairement à une zone), on ne peut que
 * la déplacer et ajuster ses dimensions ici. Le nom est facultatif : le
 * vider retire le nom affiché sur la table.
 */
export function TablePanel({
  table,
  x,
  y,
  onRename,
  onResize,
  onRecolor,
  onRotate,
  onDelete,
  onClose,
  onBeginChange,
}: TablePanelProps) {
  const [name, setName] = useState(table.name ?? "");
  const panelRef = useCloseOnOutsideClick<HTMLDivElement>(onClose);
  const color = table.color ?? DEFAULT_TABLE_COLOR;

  function commitName() {
    const trimmed = name.trim();
    setName(trimmed);
    if (trimmed !== (table.name ?? "")) onRename(trimmed);
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
        placeholder="Nom de la table"
        className="w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-2.5 py-1.5 text-sm text-[#4A4636] dark:text-[#D8D2BE] outline-none focus:ring-2 focus:ring-[#7A9E7E]"
      />

      <SizeFields
        widthM={table.widthCm / 100}
        heightM={table.depthCm / 100}
        widthLabel="Largeur"
        heightLabel="Profondeur"
        min={0.2}
        onResize={(widthM, depthM) => onResize(Math.round(widthM * 100), Math.round(depthM * 100))}
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
            style={{ backgroundColor: c, borderColor: c === color ? "#3F5A45" : "transparent" }}
          />
        ))}
        <input
          type="color"
          value={color}
          onFocus={onBeginChange}
          onChange={(e) => onRecolor(e.target.value)}
          title="Couleur personnalisée"
          className="h-6 w-7 shrink-0 cursor-pointer rounded border border-black/10 dark:border-white/20 bg-transparent p-0"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onRotate}
          title="Pivoter de 90° (touche R)"
          className="flex-1 rounded-xl bg-[#7A9E7E] text-white text-sm font-medium py-1.5 hover:bg-[#6b8f6f] transition-colors"
        >
          ↻ Pivoter
        </button>
        <button
          type="button"
          onClick={onDelete}
          title="Supprimer (touche Suppr)"
          className="flex-1 rounded-xl bg-[#D9765F] text-white text-sm font-medium py-1.5 hover:bg-[#c76650] transition-colors"
        >
          🗑 Supprimer
        </button>
      </div>
    </div>
  );
}
