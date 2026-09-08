// lib/planner/rooms.ts
import type { DimensionLabel, Room } from "./types";
import { polygonBounds, rectanglePolygon } from "./geometry";

/** nom affiché à l'utilisateur pour la salle "passerelle" (nom de code interne inchangé) */
export const PASSERELLE_DISPLAY_NAME = "Rue intérieure Saint-Paul";

/**
 * Contour approximatif de la salle "Passerelle" (plan fourni par le client),
 * L: 65,5 m × l: 14 m. Les deux dimensions principales sont fidèles au plan,
 * ainsi que la largeur au point le plus large de la bosse (21 m, mesurée sur
 * le croquis). Le reste de la bosse et le rétrécissement en pied sont
 * estimés à partir des proportions du croquis. La petite niche d'escalier
 * signalée en pointillés (passerelle en hauteur) n'est pas modélisée : elle
 * n'affecte pas le sol utilisable.
 *
 * Le mur de la bosse (haut-droit) est en réalité arrondi : le sommet à
 * 21 m sert de point de contrôle d'une courbe entre ses deux voisins plutôt
 * que de former un angle vif — voir `curvedVertices` sur PASSERELLE_ROOM.
 */
const PASSERELLE_POINTS_M: [number, number][] = [
  [0, 0],
  [12, 0],
  [17, 10.48],
  [21.5, 17.685],
  [19, 25.545],
  [21.5, 32.75],
  [17, 39.3],
  [8.5, 56.33],
  [8.5, 65.5],
  [0, 65.5],
];

/** index (dans PASSERELLE_POINTS_M) du sommet le plus large de la bosse, arrondi à l'affichage */
const PASSERELLE_CURVED_VERTICES = [4];

/**
 * Cotes affichées sur le plan : uniquement les trois segments droits qui
 * donnent la mesure du couloir (largeur en haut, longueur du mur gauche,
 * largeur en bas) — le reste du contour (bosse, rétrécissement) n'est pas
 * coté, comme sur le croquis fourni par le client.
 */
const PASSERELLE_DIMENSION_LABELS: DimensionLabel[] = [
  { fromIndex: 0, toIndex: 1, side: "top" }, // (0,0) -> (12,0) : 12 m
  { fromIndex: 9, toIndex: 0, side: "left" }, // (0,65.5) -> (0,0) : 65.5 m
  { fromIndex: 8, toIndex: 9, side: "bottom" }, // (8.5,65.5) -> (0,65.5) : 8.5 m
];

function metersPolygonToCm(points: [number, number][]) {
  return points.map(([x, y]) => ({ x: x * 100, y: y * 100 }));
}

function roomFromPolygonM(
  kind: Room["kind"],
  points: [number, number][],
  curvedVertices?: number[],
  dimensionLabels?: DimensionLabel[],
): Room {
  const polygon = metersPolygonToCm(points);
  const bounds = polygonBounds(polygon);
  return {
    kind,
    polygon,
    widthM: (bounds.maxX - bounds.minX) / 100,
    heightM: (bounds.maxY - bounds.minY) / 100,
    curvedVertices,
    dimensionLabels,
  };
}

export const PASSERELLE_ROOM: Room = roomFromPolygonM(
  "passerelle",
  PASSERELLE_POINTS_M,
  PASSERELLE_CURVED_VERTICES,
  PASSERELLE_DIMENSION_LABELS,
);

export function makeRectangleRoom(widthM: number, heightM: number): Room {
  return {
    kind: "rectangle",
    polygon: rectanglePolygon(widthM * 100, heightM * 100),
    widthM,
    heightM,
  };
}

/** vérifie qu'un objet chargé depuis le stockage a bien la forme d'une salle valide */
export function isValidRoom(value: unknown): value is Room {
  if (!value || typeof value !== "object") return false;
  const room = value as Partial<Room>;
  return (
    (room.kind === "rectangle" || room.kind === "passerelle") &&
    Array.isArray(room.polygon) &&
    room.polygon.length >= 3 &&
    typeof room.widthM === "number" &&
    typeof room.heightM === "number"
  );
}
