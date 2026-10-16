// lib/planner/scale.ts

/** marge autour du plan, en pixels, pour laisser de l'air dans le canvas */
export const PADDING_PX = 48;

/**
 * hauteur réservée sous les salles pour leur titre (et la cote du bas qui
 * peut s'intercaler entre le mur et le titre), en pixels
 */
export const ROOM_TITLE_SPACE_PX = 72;

export type StageSize = { width: number; height: number };

/** boîte englobante en cm (voir polygonBounds) */
export type Bounds = { minX: number; maxX: number; minY: number; maxY: number };

/**
 * Calcule le nombre de pixels par centimètre pour que le plan (sa boîte
 * englobante, plus la place des titres sous les salles) tienne toujours
 * entièrement dans le stage.
 */
export function computeScale(bounds: Bounds, stage: StageSize): number {
  const planWidthCm = Math.max(bounds.maxX - bounds.minX, 10);
  const planHeightCm = Math.max(bounds.maxY - bounds.minY, 10);

  const availableWidth = Math.max(stage.width - PADDING_PX * 2, 10);
  const availableHeight = Math.max(stage.height - PADDING_PX * 2 - ROOM_TITLE_SPACE_PX, 10);

  const scale = Math.min(
    availableWidth / planWidthCm,
    availableHeight / planHeightCm,
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

/**
 * décalage à appliquer aux coordonnées (cm) du plan pour le centrer dans le
 * stage, titres sous les salles compris
 */
export function planOrigin(
  bounds: Bounds,
  stage: StageSize,
  scale: number,
): { x: number; y: number } {
  const planWidthPx = (bounds.maxX - bounds.minX) * scale;
  const planHeightPx = (bounds.maxY - bounds.minY) * scale + ROOM_TITLE_SPACE_PX;
  return {
    x: (stage.width - planWidthPx) / 2 - bounds.minX * scale,
    y: (stage.height - planHeightPx) / 2 - bounds.minY * scale,
  };
}
