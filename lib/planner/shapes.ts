// lib/planner/shapes.ts
// Catalogue des formes / pictos libres posables sur le plan (flèches,
// panneau attention, étoile...). Chaque forme est décrite par un ou
// plusieurs tracés SVG dans une boîte de 100 × 100 unités, étirée ensuite à
// la taille de la forme : le même tracé sert au dessin sur le canvas (Konva
// Path) et à l'icône du bouton dans la barre latérale.

import type { ShapeKind, ShapeObject } from "./types";

/** côté de la boîte de référence des tracés */
export const SHAPE_BOX = 100;

export const MIN_SHAPE_SIZE_CM = 30;
/** pas de rotation (bouton "Pivoter", touche R, poignée de rotation aimantée) */
export const SHAPE_ROTATION_STEP = 45;
export const DEFAULT_SHAPE_COLOR = "#D9B94D";

export type ShapePath = {
  /** tracé SVG, dans la boîte 0..SHAPE_BOX */
  d: string;
  /**
   * détail dessiné dans la couleur du texte (ex. le "!" du panneau
   * attention) ; masqué quand la forme porte un texte, qui prend sa place
   */
  detail?: boolean;
};

export type ShapeDefinition = {
  kind: ShapeKind;
  label: string;
  paths: ShapePath[];
  /** zone (dans la boîte 0..SHAPE_BOX) où placer le texte de la forme */
  textBox: { x: number; y: number; width: number; height: number };
  defaultWidthCm: number;
  defaultHeightCm: number;
};

/** étoile à 5 branches inscrite dans la boîte de référence */
function starPath(): string {
  const cx = 50;
  const cy = 54;
  const outer = 50;
  const inner = 21;
  const points = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    return `${(cx + r * Math.cos(angle)).toFixed(2)} ${(cy + r * Math.sin(angle)).toFixed(2)}`;
  });
  return `M${points.join(" L")} Z`;
}

export const SHAPES: ShapeDefinition[] = [
  {
    kind: "arrow",
    label: "Flèche",
    paths: [{ d: "M0 32 L58 32 L58 8 L100 50 L58 92 L58 68 L0 68 Z" }],
    textBox: { x: 4, y: 34, width: 54, height: 32 },
    defaultWidthCm: 300,
    defaultHeightCm: 150,
  },
  {
    kind: "double-arrow",
    label: "Flèche double",
    paths: [{ d: "M0 50 L32 8 L32 32 L68 32 L68 8 L100 50 L68 92 L68 68 L32 68 L32 92 Z" }],
    textBox: { x: 30, y: 34, width: 40, height: 32 },
    defaultWidthCm: 400,
    defaultHeightCm: 150,
  },
  {
    kind: "warning",
    label: "Attention",
    paths: [
      { d: "M50 4 L98 94 L2 94 Z" },
      { d: "M45.5 36 L54.5 36 L53 68 L47 68 Z", detail: true },
      { d: "M44.5 80 A5.5 5.5 0 1 0 55.5 80 A5.5 5.5 0 1 0 44.5 80 Z", detail: true },
    ],
    textBox: { x: 24, y: 48, width: 52, height: 42 },
    defaultWidthCm: 250,
    defaultHeightCm: 225,
  },
  {
    kind: "star",
    label: "Étoile",
    paths: [{ d: starPath() }],
    textBox: { x: 32, y: 40, width: 36, height: 30 },
    defaultWidthCm: 250,
    defaultHeightCm: 250,
  },
  {
    kind: "circle",
    label: "Cercle",
    paths: [{ d: "M0 50 A50 50 0 1 0 100 50 A50 50 0 1 0 0 50 Z" }],
    textBox: { x: 15, y: 15, width: 70, height: 70 },
    defaultWidthCm: 250,
    defaultHeightCm: 250,
  },
  {
    kind: "square",
    label: "Carré",
    paths: [{ d: "M0 0 L100 0 L100 100 L0 100 Z" }],
    textBox: { x: 6, y: 6, width: 88, height: 88 },
    defaultWidthCm: 250,
    defaultHeightCm: 250,
  },
  {
    kind: "triangle",
    label: "Triangle",
    paths: [{ d: "M50 0 L100 100 L0 100 Z" }],
    textBox: { x: 25, y: 50, width: 50, height: 44 },
    defaultWidthCm: 250,
    defaultHeightCm: 250,
  },
  {
    kind: "diamond",
    label: "Losange",
    paths: [{ d: "M50 0 L100 50 L50 100 L0 50 Z" }],
    textBox: { x: 25, y: 25, width: 50, height: 50 },
    defaultWidthCm: 250,
    defaultHeightCm: 250,
  },
  {
    kind: "heart",
    label: "Cœur",
    paths: [
      {
        d: "M50 94 C20 72 0 54 0 31 C0 14 13 3 28 3 C38 3 46 9 50 17 C54 9 62 3 72 3 C87 3 100 14 100 31 C100 54 80 72 50 94 Z",
      },
    ],
    textBox: { x: 18, y: 22, width: 64, height: 38 },
    defaultWidthCm: 250,
    defaultHeightCm: 250,
  },
  {
    kind: "cross",
    label: "Croix",
    paths: [{ d: "M34 0 L66 0 L66 34 L100 34 L100 66 L66 66 L66 100 L34 100 L34 66 L0 66 L0 34 L34 34 Z" }],
    textBox: { x: 34, y: 34, width: 32, height: 32 },
    defaultWidthCm: 250,
    defaultHeightCm: 250,
  },
  {
    kind: "pin",
    label: "Repère",
    paths: [
      { d: "M50 100 C42 88 14 62 14 36 A36 36 0 1 1 86 36 C86 62 58 88 50 100 Z" },
      { d: "M37 36 A13 13 0 1 0 63 36 A13 13 0 1 0 37 36 Z", detail: true },
    ],
    textBox: { x: 24, y: 16, width: 52, height: 40 },
    defaultWidthCm: 200,
    defaultHeightCm: 250,
  },
  {
    kind: "bubble",
    label: "Bulle",
    paths: [
      {
        d: "M8 4 L92 4 Q97 4 97 9 L97 66 Q97 71 92 71 L42 71 L20 94 L25 71 L8 71 Q3 71 3 66 L3 9 Q3 4 8 4 Z",
      },
    ],
    textBox: { x: 8, y: 9, width: 84, height: 57 },
    defaultWidthCm: 350,
    defaultHeightCm: 250,
  },
];

const SHAPES_BY_KIND = new Map(SHAPES.map((def) => [def.kind, def]));

export function getShapeDefinition(kind: ShapeKind): ShapeDefinition {
  return SHAPES_BY_KIND.get(kind) ?? SHAPES[0];
}

/** ramène un angle en degrés dans [0, 360) */
export function normalizeRotation(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** vérifie qu'une forme chargée depuis le stockage a bien la forme attendue */
export function isValidShape(value: unknown): value is ShapeObject {
  if (!value || typeof value !== "object") return false;
  const shape = value as Partial<ShapeObject>;
  return (
    shape.kind === "shape" &&
    typeof shape.id === "string" &&
    SHAPES_BY_KIND.has(shape.shape as ShapeKind) &&
    typeof shape.x === "number" &&
    typeof shape.y === "number" &&
    typeof shape.widthCm === "number" &&
    typeof shape.heightCm === "number" &&
    typeof shape.rotation === "number" &&
    typeof shape.color === "string" &&
    (shape.text === undefined || typeof shape.text === "string")
  );
}
