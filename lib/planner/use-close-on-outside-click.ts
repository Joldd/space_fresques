// lib/planner/use-close-on-outside-click.ts
"use client";

import { useEffect, useRef } from "react";

/**
 * Ferme un panneau flottant (menu contextuel de zone/table) au clic en
 * dehors, ou à Échap. Les clics sur le canvas sont volontairement ignorés :
 * ils sont déjà gérés par le Stage lui-même (sélectionner un autre élément,
 * le vide...) — les laisser décider évite une course où ce listener
 * fermerait le panneau juste après qu'un clic ailleurs sur le canvas l'ait
 * rouvert pour un autre élément.
 */
export function useCloseOnOutsideClick<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null);

  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      if (ref.current?.contains(e.target as Node)) return;
      if ((e.target as HTMLElement)?.tagName === "CANVAS") return;
      onClose();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return ref;
}
