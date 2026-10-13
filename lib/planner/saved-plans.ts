// lib/planner/saved-plans.ts
"use client";

import { useCallback, useState } from "react";
import { sanitizePlanData, type PlanData } from "./plan-file";

/** distinct de la sauvegarde automatique du plan en cours (use-planner-store.ts) */
const STORAGE_KEY = "space-fresques:saved-plans";

export type SavedPlan = {
  id: string;
  name: string;
  /** date ISO de la dernière sauvegarde */
  savedAt: string;
  plan: PlanData;
};

function readSavedPlans(): SavedPlan[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry): SavedPlan[] => {
      if (!entry || typeof entry !== "object") return [];
      const { id, name, savedAt, plan } = entry as Partial<SavedPlan>;
      const clean = sanitizePlanData(plan);
      if (typeof id !== "string" || typeof name !== "string" || typeof savedAt !== "string" || !clean) return [];
      return [{ id, name, savedAt, plan: clean }];
    });
  } catch {
    // localStorage indisponible ou données corrompues : liste vide
    return [];
  }
}

function writeSavedPlans(plans: SavedPlan[]): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
    return true;
  } catch {
    return false;
  }
}

/**
 * Bibliothèque de plans enregistrés sous un nom, dans le navigateur (le
 * planner n'est rendu que côté client, la lecture initiale peut donc se
 * faire directement). Enregistrer sous un nom déjà pris écrase ce plan.
 * Les fonctions renvoient false si le stockage a échoué (quota, mode privé).
 */
export function useSavedPlans() {
  const [plans, setPlans] = useState<SavedPlan[]>(readSavedPlans);

  const commit = useCallback((next: SavedPlan[]) => {
    if (!writeSavedPlans(next)) return false;
    setPlans(next);
    return true;
  }, []);

  const savePlan = useCallback(
    (name: string, plan: PlanData) => {
      const savedAt = new Date().toISOString();
      const existing = plans.find((p) => p.name === name);
      const next = existing
        ? plans.map((p) => (p.id === existing.id ? { ...p, savedAt, plan } : p))
        : [...plans, { id: crypto.randomUUID(), name, savedAt, plan }];
      return commit(next);
    },
    [plans, commit],
  );

  const deletePlan = useCallback((id: string) => commit(plans.filter((p) => p.id !== id)), [plans, commit]);

  return { plans, savePlan, deletePlan };
}
