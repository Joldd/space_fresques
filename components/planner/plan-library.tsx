// components/planner/plan-library.tsx
"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { downloadPlanFile, parsePlanFile, type PlanData } from "@/lib/planner/plan-file";
import { useSavedPlans, type SavedPlan } from "@/lib/planner/saved-plans";
import { slugify } from "@/lib/planner/slugify";

type PlanLibraryProps = {
  /** configuration actuellement affichée sur le canvas */
  /** plan en cours, lu seulement au moment d'enregistrer ou d'exporter (getter stable : pas de re-rendu à chaque drag) */
  getCurrentPlan: () => PlanData;
  /** remplace le plan en cours (annulable par Ctrl+Z) */
  onOpenPlan: (plan: PlanData) => void;
};

const SECONDARY_BUTTON =
  "rounded-xl bg-black/5 dark:bg-white/10 text-[#4A4636] dark:text-[#D8D2BE] text-sm font-medium py-2 hover:bg-black/10 dark:hover:bg-white/15 transition-colors";
const ICON_BUTTON =
  "shrink-0 flex h-7 w-7 items-center justify-center rounded-lg text-sm hover:bg-black/10 dark:hover:bg-white/15 transition-colors";

function formatSavedAt(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

function confirmReplace(name: string): boolean {
  return window.confirm(
    `Ouvrir « ${name} » ?\n\nLe plan actuel sera remplacé. Ctrl+Z permet de revenir en arrière juste après.`,
  );
}

/**
 * Contenu de la carte "Mes plans" : enregistre plusieurs configurations
 * nommées dans le navigateur, et exporte/importe un plan en fichier .json
 * pour le partager (la personne qui le reçoit l'importe de son côté).
 */
export function PlanLibrary({ getCurrentPlan, onOpenPlan }: PlanLibraryProps) {
  const { plans, savePlan, deletePlan } = useSavedPlans();
  const [name, setName] = useState("");
  const [message, setMessage] = useState<{ kind: "info" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const trimmedName = name.trim();

  function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!trimmedName) return;
    const exists = plans.some((p) => p.name === trimmedName);
    if (exists && !window.confirm(`Un plan « ${trimmedName} » existe déjà. Le remplacer ?`)) return;
    if (savePlan(trimmedName, getCurrentPlan())) {
      setMessage({ kind: "info", text: `Plan « ${trimmedName} » enregistré.` });
    } else {
      setMessage({ kind: "error", text: "Impossible d'enregistrer : le stockage du navigateur est indisponible ou plein." });
    }
  }

  function handleOpen(saved: SavedPlan) {
    if (!confirmReplace(saved.name)) return;
    onOpenPlan(saved.plan);
    setName(saved.name);
    setMessage(null);
  }

  function handleDelete(saved: SavedPlan) {
    if (!window.confirm(`Supprimer le plan enregistré « ${saved.name} » ?`)) return;
    deletePlan(saved.id);
  }

  function handleExportCurrent() {
    const exportName = trimmedName || "Plan de salle";
    downloadPlanFile(getCurrentPlan(), exportName, `plan-${slugify(exportName)}.json`);
  }

  async function handleImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // vide le champ pour pouvoir réimporter le même fichier ensuite
    e.target.value = "";
    if (!file) return;
    try {
      const { plan, name: fileName } = parsePlanFile(await file.text());
      const importedName = fileName ?? file.name.replace(/\.json$/i, "");
      if (!confirmReplace(importedName)) return;
      onOpenPlan(plan);
      setName(importedName);
      setMessage({ kind: "info", text: `Plan « ${importedName} » importé. Enregistre-le pour le retrouver ici.` });
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Import impossible." });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={handleSave} className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom du plan"
          className="min-w-0 flex-1 rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-[#20241f] px-2.5 py-1.5 text-sm text-[#4A4636] dark:text-[#D8D2BE] outline-none focus:ring-2 focus:ring-[#7A9E7E]"
        />
        <button
          type="submit"
          disabled={!trimmedName}
          title="Enregistrer le plan actuel sous ce nom, dans ce navigateur"
          className="shrink-0 rounded-xl bg-[#3F5A45] px-3 text-white text-sm font-medium hover:bg-[#33492b] disabled:opacity-40 disabled:hover:bg-[#3F5A45] transition-colors"
        >
          💾 Enregistrer
        </button>
      </form>

      {message && (
        <p
          className={`text-xs ${
            message.kind === "error" ? "text-[#D9765F]" : "text-[#3F5A45] dark:text-[#B9D3BC]"
          }`}
        >
          {message.text}
        </p>
      )}

      {plans.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {plans.map((saved) => (
            <li
              key={saved.id}
              className="flex items-center gap-1 rounded-xl bg-black/[0.03] dark:bg-white/5 pl-2.5 pr-1 py-1"
            >
              <button
                type="button"
                onClick={() => handleOpen(saved)}
                title={`Ouvrir « ${saved.name} »`}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate text-sm font-medium text-[#4A4636] dark:text-[#D8D2BE]">
                  {saved.name}
                </span>
                <span className="block text-xs text-[#8A8368] dark:text-[#8FA090]">
                  {formatSavedAt(saved.savedAt)}
                </span>
              </button>
              <button
                type="button"
                onClick={() => downloadPlanFile(saved.plan, saved.name, `plan-${slugify(saved.name)}.json`)}
                aria-label={`Télécharger « ${saved.name} »`}
                title="Télécharger le fichier, pour le partager"
                className={ICON_BUTTON}
              >
                ⬇
              </button>
              <button
                type="button"
                onClick={() => handleDelete(saved)}
                aria-label={`Supprimer « ${saved.name} »`}
                title="Supprimer"
                className={ICON_BUTTON}
              >
                🗑
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-[#8A8368] dark:text-[#8FA090]">
          Aucun plan enregistré pour l&apos;instant.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleExportCurrent}
          title="Télécharger le plan actuel en fichier .json, pour le partager"
          className={SECONDARY_BUTTON}
        >
          ⬇ Exporter
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Ouvrir un fichier .json reçu"
          className={SECONDARY_BUTTON}
        >
          ⬆ Importer
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleImport}
        className="hidden"
      />
    </div>
  );
}
