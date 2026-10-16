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

/**
 * Version "à plat" du contour tel que dessiné par tracePolygonPath : chaque
 * arrondi (sommet de `curvedIndices`) est remplacé par `segments` points
 * échantillonnés sur la courbe quadratique. Sert à contenir les meubles le
 * long de l'arrondi visible plutôt que le long des deux segments droits qui
 * rejoignent son point de contrôle.
 */
export function flattenCurvedPolygon(
  points: Point[],
  curvedIndices?: Iterable<number>,
  segments = 24,
): Polygon {
  const curved = new Set(curvedIndices);
  const n = points.length;
  if (n === 0 || curved.size === 0) return points;

  // même parcours que tracePolygonPath : un sommet arrondi consomme aussi
  // son voisin suivant, qui devient l'extrémité de la courbe
  const out: Point[] = [points[0]];
  let i = 1;
  while (i <= n) {
    const idx = i % n;
    if (curved.has(idx)) {
      const start = out[out.length - 1];
      const control = points[idx];
      const end = points[(idx + 1) % n];
      for (let k = 1; k <= segments; k++) {
        const t = k / segments;
        const a = (1 - t) * (1 - t);
        const b = 2 * (1 - t) * t;
        const c = t * t;
        out.push({
          x: a * start.x + b * control.x + c * end.x,
          y: a * start.y + b * control.y + c * end.y,
        });
      }
      i += 2;
    } else {
      out.push(points[idx]);
      i += 1;
    }
  }

  // le parcours se termine en revenant sur le premier point : doublon inutile
  const last = out[out.length - 1];
  if (out.length > 1 && last.x === out[0].x && last.y === out[0].y) out.pop();
  return out;
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

/**
 * Surface au sol utilisable pour les meubles : le contour de la salle, moins
 * des "trous" (obstacles fixes comme un escalier) que rien ne peut chevaucher.
 */
export type FloorArea = { outline: Polygon; holes: Polygon[] };

/** orientation du triangle (a, b, c) : > 0 sens direct, < 0 sens indirect, 0 alignés */
function orientation(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

/** les segments [p1, p2] et [p3, p4] se croisent franchement (un simple contact ne compte pas) */
function segmentsCross(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const d1 = orientation(p3, p4, p1);
  const d2 = orientation(p3, p4, p2);
  const d3 = orientation(p1, p2, p3);
  const d4 = orientation(p1, p2, p4);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/**
 * Deux polygones se chevauchent : un sommet de l'un est dans l'autre, ou
 * deux côtés se croisent (cas d'un "+" où aucun sommet n'est dans l'autre).
 */
export function polygonsOverlap(a: Polygon, b: Polygon): boolean {
  if (a.some((pt) => pointInPolygon(pt, b)) || b.some((pt) => pointInPolygon(pt, a))) return true;
  for (let i = 0; i < a.length; i++) {
    const a1 = a[i];
    const a2 = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j++) {
      if (segmentsCross(a1, a2, b[j], b[(j + 1) % b.length])) return true;
    }
  }
  return false;
}

export function isObjectInsideArea(obj: SceneObject, area: FloorArea): boolean {
  const footprint = objectFootprintPoints(obj);
  // coins dans la salle ET aucun sommet du contour dans l'objet : sans ce
  // second test, un mur rentrant (ex. un arrondi qui bombe vers l'intérieur)
  // pourrait traverser le milieu d'un côté de table dont les coins, eux,
  // restent à l'intérieur
  return (
    footprint.every((pt) => pointInPolygon(pt, area.outline)) &&
    !area.outline.some((pt) => pointInPolygon(pt, footprint)) &&
    !area.holes.some((hole) => polygonsOverlap(footprint, hole))
  );
}

/**
 * Réduit un déplacement de groupe (dx, dy) pour que tous les objets fournis
 * restent entièrement dans leur surface utilisable — le groupe glisse et
 * s'arrête au contact du mur (ou d'un obstacle) plutôt que d'être bloqué net.
 * Seule la position d'arrivée compte : un drag qui "saute" par-dessus un
 * obstacle vers une place libre est accepté. `areaOf` donne la surface de
 * chaque objet : un groupe peut mêler des objets de salles différentes.
 */
export function clampGroupDelta(
  objects: SceneObject[],
  dxCm: number,
  dyCm: number,
  areaOf: (obj: SceneObject) => FloorArea,
): { dx: number; dy: number } {
  const validAt = (t: number) =>
    objects.every((obj) =>
      isObjectInsideArea({ ...obj, x: obj.x + dxCm * t, y: obj.y + dyCm * t }, areaOf(obj)),
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
 * Si l'objet est hors de la surface utilisable (hors salle ou sur un
 * obstacle), le ramène au plus près (en le rapprochant progressivement du
 * centroïde de la salle).
 */
export function clampObjectPosition(obj: SceneObject, area: FloorArea): Point {
  if (isObjectInsideArea(obj, area)) return { x: obj.x, y: obj.y };

  const target = polygonCentroid(area.outline);
  const dx = target.x - obj.x;
  const dy = target.y - obj.y;
  const validAt = (t: number) =>
    isObjectInsideArea({ ...obj, x: obj.x + dx * t, y: obj.y + dy * t }, area);

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
