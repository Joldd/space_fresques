// lib/planner/scale.ts
import type { Room } from "./types";
import { polygonBounds } from "./geometry";

/** marge autour de la salle, en pixels, pour laisser de l'air dans le canvas */
const PADDING_PX = 48;

export type StageSize = { width: number; height: number };

/**
 * Calcule le nombre de pixels par centimètre pour que la salle (sa boîte
 * englobante) tienne toujours entièrement dans le stage.
 */
export function computeScale(room: Room, stage: StageSize): number {
  const bounds = polygonBounds(room.polygon);
  const roomWidthCm = Math.max(bounds.maxX - bounds.minX, 10);
  const roomHeightCm = Math.max(bounds.maxY - bounds.minY, 10);

  const availableWidth = Math.max(stage.width - PADDING_PX * 2, 10);
  const availableHeight = Math.max(stage.height - PADDING_PX * 2, 10);

  const scale = Math.min(
    availableWidth / roomWidthCm,
    availableHeight / roomHeightCm,
  );

  // on évite une échelle absurde (salle minuscule dans un immense écran)
  return Math.min(scale, 6);
}

export function cmToPx(cm: number, scale: number): number {
  return cm * scale;
}

export function pxToCm(px: number, scale: number): number {
  return px / scale;
}

/** décalage à appliquer aux coordonnées (cm) de la salle pour la centrer dans le stage */
export function roomOrigin(
  room: Room,
  stage: StageSize,
  scale: number,
): { x: number; y: number } {
  const bounds = polygonBounds(room.polygon);
  const roomWidthPx = (bounds.maxX - bounds.minX) * scale;
  const roomHeightPx = (bounds.maxY - bounds.minY) * scale;
  return {
    x: (stage.width - roomWidthPx) / 2 - bounds.minX * scale,
    y: (stage.height - roomHeightPx) / 2 - bounds.minY * scale,
  };
}
