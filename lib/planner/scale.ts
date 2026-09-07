// lib/planner/scale.ts
import type { RoomDimensions } from "./types";

/** marge autour de la salle, en pixels, pour laisser de l'air dans le canvas */
const PADDING_PX = 48;

export type StageSize = { width: number; height: number };

/**
 * Calcule le nombre de pixels par centimètre pour que la salle tienne
 * toujours entièrement dans le stage, quelle que soit sa taille.
 */
export function computeScale(room: RoomDimensions, stage: StageSize): number {
  const roomWidthCm = Math.max(room.widthM, 0.1) * 100;
  const roomHeightCm = Math.max(room.heightM, 0.1) * 100;

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

/** position en haut à gauche de la salle dans le stage, pour la centrer */
export function roomOrigin(
  room: RoomDimensions,
  stage: StageSize,
  scale: number,
): { x: number; y: number } {
  const roomWidthPx = room.widthM * 100 * scale;
  const roomHeightPx = room.heightM * 100 * scale;
  return {
    x: (stage.width - roomWidthPx) / 2,
    y: (stage.height - roomHeightPx) / 2,
  };
}
