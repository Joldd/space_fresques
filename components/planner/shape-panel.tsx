// components/planner/shape-panel.tsx
"use client";

import { useState } from "react";
import type { ShapeObject } from "@/lib/planner/types";
import { COLOR_PALETTE } from "@/lib/planner/color";
import { MIN_SHAPE_SIZE_CM, getShapeDefinition } from "@/lib/planner/shapes";
import { useCloseOnOutsideClick } from "@/lib/planner/use-close-on-outside-click";
import { SizeFields } from "./size-fields";

type ShapePanelProps = {
  shape: ShapeObject;
  /** position d'ancrage, en px, relative au conteneur du canvas */
  x: number;
  y: number;
  onChangeText: (text: string) => void;
  onResize: (widthCm: number, heightCm: number) => void;
  onRecolor: (color: string) => void;
  onRotate: () => void;
  onDelete: () => void;
  onClose: () => void;
  /** appelé une seule fois au début d'une édition (focus d'un champ, clic sur une pastille) — empile l'état pour Ctrl+Z */
  onBeginChange: () => void;
};

/**
 * Menu contextuel (texte, dimensions, couleur, rotation, suppression) d'une
 * forme sélectionnée — même principe que TablePanel (à monter avec
 * `key={shape.id}` pour réinitialiser le brouillon de texte). Le texte est
 * facultatif : le vider retire le texte affiché sur la forme.
 */
export function ShapePanel({
  shape,
  x,
  y,
  onChangeText,
  onResize,
  onRecolor,
  onRotate,
  onDelete,
  onClose,
  onBeginChange,
}: ShapePanelProps) {
  const [text, setText] = useState(shape.text ?? "");
  const panelRef = useCloseOnOutsideClick<HTMLDivElement>(onClose);

  function commitText() {
    const trimmed = text.trim();
    setText(trimmed);
    if (trimmed !== (shape.text ?? "")) onChangeText(trimmed);
  }

  return (
    <div
      ref={panelRef}
      style={{ left: x, top: y }}
      className="absolute z-20 w-60 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#232823] p-3 shadow-xl flex flex-col gap-3"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8368] dark:text-[#8FA090]">
        {getShapeDefinition(shape.shape).label}
      </p>

      <input
        type="text"
        value={text}
        onFocus={onBeginChange}
        onChange={(e) => setText(e.target.value)}
        onBlur={commitText}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        placeholder="Texte (facultatif)"
        className="w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-2.5 py-1.5 text-sm text-[#4A4636] dark:text-[#D8D2BE] outline-none focus:ring-2 focus:ring-[#7A9E7E]"
      />

      <SizeFields
        widthM={shape.widthCm / 100}
        heightM={shape.heightCm / 100}
        widthLabel="Largeur"
        heightLabel="Hauteur"
        min={MIN_SHAPE_SIZE_CM / 100}
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
            style={{ backgroundColor: c, borderColor: c === shape.color ? "#3F5A45" : "transparent" }}
          />
        ))}
        <input
          type="color"
          value={shape.color}
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
          title="Pivoter de 45° (touche R)"
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
