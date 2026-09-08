// components/planner/size-fields.tsx
"use client";

import { useState } from "react";

type SizeFieldsProps = {
  widthM: number;
  heightM: number;
  widthLabel: string;
  heightLabel: string;
  /** taille minimale acceptée, en mètres */
  min: number;
  onResize: (widthM: number, heightM: number) => void;
};

/** 2 -> "2", 2.5 -> "2.5" (pas de zéro final superflu) */
function formatMeters(m: number): string {
  return (Math.round(m * 100) / 100).toString();
}

function parseMeters(text: string): number | null {
  const value = Number(text.replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** brouillon de texte d'un champ, resynchronisé depuis la prop pendant le rendu — plutôt que dans un
 *  effet — quand elle change pour une raison extérieure à ce que l'utilisateur est en train de taper
 *  (ex. redimensionnement d'une zone via ses poignées Konva pendant que ce panneau est ouvert) */
function useSyncedDraft(valueM: number) {
  const [text, setText] = useState(() => formatMeters(valueM));
  const [prevValueM, setPrevValueM] = useState(valueM);

  if (valueM !== prevValueM) {
    setPrevValueM(valueM);
    const parsed = parseMeters(text);
    // ne pas écraser ce que l'utilisateur tape si ça correspond déjà à la
    // valeur reçue (ex. "2.50" en train d'être tapé alors que la prop vaut 2.5)
    if (parsed === null || Math.abs(parsed - valueM) > 0.001) {
      setText(formatMeters(valueM));
    }
  }

  return [text, setText] as const;
}

/**
 * Deux champs numériques liés (largeur/hauteur, en mètres) pour un menu
 * contextuel de zone ou de table.
 */
export function SizeFields({ widthM, heightM, widthLabel, heightLabel, min, onResize }: SizeFieldsProps) {
  const [widthText, setWidthText] = useSyncedDraft(widthM);
  const [heightText, setHeightText] = useSyncedDraft(heightM);

  function handleWidthChange(text: string) {
    setWidthText(text);
    const value = parseMeters(text);
    if (value !== null) onResize(Math.max(value, min), heightM);
  }
  function handleHeightChange(text: string) {
    setHeightText(text);
    const value = parseMeters(text);
    if (value !== null) onResize(widthM, Math.max(value, min));
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="flex flex-col gap-1 text-xs text-[#8A8368] dark:text-[#8FA090]">
        <span>{widthLabel} (m)</span>
        <input
          type="number"
          min={min}
          step={0.1}
          value={widthText}
          onChange={(e) => handleWidthChange(e.target.value)}
          onBlur={() => setWidthText(formatMeters(widthM))}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-2 py-1.5 text-sm text-[#4A4636] dark:text-[#D8D2BE] outline-none focus:ring-2 focus:ring-[#7A9E7E]"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-[#8A8368] dark:text-[#8FA090]">
        <span>{heightLabel} (m)</span>
        <input
          type="number"
          min={min}
          step={0.1}
          value={heightText}
          onChange={(e) => handleHeightChange(e.target.value)}
          onBlur={() => setHeightText(formatMeters(heightM))}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-2 py-1.5 text-sm text-[#4A4636] dark:text-[#D8D2BE] outline-none focus:ring-2 focus:ring-[#7A9E7E]"
        />
      </label>
    </div>
  );
}
