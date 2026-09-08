// lib/planner/geometry.ts
// Utilitaires géométriques pour une salle en forme de polygone quelconque
// (contour, contention des meubles, calcul de centre, etc.) — tout en cm.

import type { Point, SceneObject } from "./types";

export type Polygon = Point[];

/** test point-dans-polygone par ray casting (fonctionne pour des polygones concaves) */
export function pointInPolygon(pt: Point, poly: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect =
      yi > pt.y !== yj > pt.y &&
      pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function polygonBounds(poly: Polygon) {
  const xs = poly.map((p) => p.x);
  const ys = poly.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

/** centre "visuel" du polygone (centroïde pondéré par l'aire, avec repli si aire nulle) */
export function polygonCentroid(poly: Polygon): Point {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const { x: x0, y: y0 } = poly[i];
    const { x: x1, y: y1 } = poly[(i + 1) % poly.length];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  area /= 2;
  if (Math.abs(area) < 1e-6) {
    const n = poly.length || 1;
    return {
      x: poly.reduce((s, p) => s + p.x, 0) / n,
      y: poly.reduce((s, p) => s + p.y, 0) / n,
    };
  }
  return { x: cx / (6 * area), y: cy / (6 * area) };
}

/** contexte de dessin minimal requis par tracePolygonPath (compatible Canvas2D / Konva.Context) */
export type PathDrawingContext = {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  closePath(): void;
};

/**
 * Trace le contour d'un polygone sur un contexte de dessin, en remplaçant
 * les sommets listés dans `curvedIndices` par un arrondi : le sommet sert de
 * point de contrôle d'une courbe quadratique entre son voisin précédent et
 * son voisin suivant, au lieu de former un angle vif.
 */
export function tracePolygonPath(
  ctx: PathDrawingContext,
  points: Point[],
  curvedIndices?: Iterable<number>,
) {
  const n = points.length;
  if (n === 0) return;
  const curved = new Set(curvedIndices);
  ctx.moveTo(points[0].x, points[0].y);
  let i = 1;
  while (i <= n) {
    const idx = i % n;
    if (curved.has(idx)) {
      const end = points[(idx + 1) % n];
      ctx.quadraticCurveTo(points[idx].x, points[idx].y, end.x, end.y);
      i += 2;
    } else {
      ctx.lineTo(points[idx].x, points[idx].y);
      i += 1;
    }
  }
  ctx.closePath();
}

export function rectanglePolygon(widthCm: number, heightCm: number): Polygon {
  return [
    { x: 0, y: 0 },
    { x: widthCm, y: 0 },
    { x: widthCm, y: heightCm },
    { x: 0, y: heightCm },
  ];
}

/** points d'encombrement au sol d'un objet, dans le repère de la salle (cm) */
export function objectFootprintPoints(obj: SceneObject): Point[] {
  if (obj.kind === "chair") {
    const r = obj.diameterCm / 2;
    const steps = 8;
    return Array.from({ length: steps }, (_, i) => {
      const angle = (i / steps) * Math.PI * 2;
      return { x: obj.x + Math.cos(angle) * r, y: obj.y + Math.sin(angle) * r };
    });
  }
  const hw = obj.widthCm / 2;
  const hd = obj.depthCm / 2;
  const rad = (obj.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const corners: [number, number][] = [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ];
  return corners.map(([lx, ly]) => ({
    x: obj.x + lx * cos - ly * sin,
    y: obj.y + lx * sin + ly * cos,
  }));
}

export function isObjectInsidePolygon(obj: SceneObject, poly: Polygon): boolean {
  return objectFootprintPoints(obj).every((pt) => pointInPolygon(pt, poly));
}

/**
 * Réduit un déplacement de groupe (dx, dy) pour que tous les objets fournis
 * restent entièrement à l'intérieur du polygone — le groupe glisse et
 * s'arrête au contact du mur plutôt que d'être bloqué net.
 */
export function clampGroupDelta(
  objects: SceneObject[],
  dxCm: number,
  dyCm: number,
  poly: Polygon,
): { dx: number; dy: number } {
  const validAt = (t: number) =>
    objects.every((obj) =>
      isObjectInsidePolygon({ ...obj, x: obj.x + dxCm * t, y: obj.y + dyCm * t }, poly),
    );

  if (validAt(1)) return { dx: dxCm, dy: dyCm };
  if (!validAt(0)) return { dx: 0, dy: 0 };

  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (validAt(mid)) lo = mid;
    else hi = mid;
  }
  return { dx: dxCm * lo, dy: dyCm * lo };
}

/**
 * Si l'objet est hors du polygone, le ramène au plus près à l'intérieur
 * (en le rapprochant progressivement du centroïde de la salle).
 */
export function clampObjectPosition(obj: SceneObject, poly: Polygon): Point {
  if (isObjectInsidePolygon(obj, poly)) return { x: obj.x, y: obj.y };

  const target = polygonCentroid(poly);
  const dx = target.x - obj.x;
  const dy = target.y - obj.y;
  const validAt = (t: number) =>
    isObjectInsidePolygon({ ...obj, x: obj.x + dx * t, y: obj.y + dy * t }, poly);

  if (!validAt(1)) return target; // objet trop grand pour la salle : au mieux, au centre

  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (validAt(mid)) hi = mid;
    else lo = mid;
  }
  return { x: obj.x + dx * hi, y: obj.y + dy * hi };
}
