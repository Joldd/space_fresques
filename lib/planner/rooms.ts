// lib/planner/rooms.ts
import type { DimensionLabel, Point, Room, RoomId, RoomObstacle, RoomPartition, SceneObject } from "./types";
import { flattenCurvedPolygon, polygonBounds, type FloorArea } from "./geometry";

/** nom affiché à l'utilisateur pour la salle "passerelle" (nom de code interne inchangé) */
export const PASSERELLE_DISPLAY_NAME = "Rue intérieure Saint-Paul";
export const VICAT_DISPLAY_NAME = "Salle Louis Vicat";

/**
 * Contour approximatif de la salle "Passerelle" (plan fourni par le client),
 * L: 65,5 m × l: 14 m. Les deux dimensions principales sont fidèles au plan,
 * ainsi que la largeur au point le plus large de la bosse (21 m, mesurée sur
 * le croquis). Le reste de la bosse et le rétrécissement en pied sont
 * estimés à partir des proportions du croquis. La petite niche d'escalier
 * signalée en pointillés (passerelle en hauteur) n'est pas modélisée : elle
 * n'affecte pas le sol utilisable. L'escalier qui y monte, lui, est un
 * obstacle : voir PASSERELLE_OBSTACLES.
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

/**
 * Escalier montant à la passerelle (carré du croquis client, sous la
 * passerelle côté gauche) : ~4 m × 3,2 m, à 6 m du mur gauche et ~17,4 m du
 * mur du haut — position relevée sur le croquis, dans le même repère que
 * PASSERELLE_POINTS_M (calé sur les sommets de la bosse).
 */
const PASSERELLE_OBSTACLES: RoomObstacle[] = [
  { label: "Escalier", x: 600, y: 1740, widthCm: 400, heightCm: 320 },
];

function metersPolygonToCm(points: [number, number][]) {
  return points.map(([x, y]) => ({ x: x * 100, y: y * 100 }));
}

function roomFromPolygonM(
  id: RoomId,
  name: string,
  points: [number, number][],
  curvedVertices?: number[],
  dimensionLabels?: DimensionLabel[],
  obstacles?: RoomObstacle[],
): Room {
  const polygon = metersPolygonToCm(points);
  const bounds = polygonBounds(polygon);
  return {
    id,
    name,
    polygon,
    widthM: (bounds.maxX - bounds.minX) / 100,
    heightM: (bounds.maxY - bounds.minY) / 100,
    curvedVertices,
    dimensionLabels,
    obstacles,
  };
}

export const PASSERELLE_ROOM: Room = roomFromPolygonM(
  "passerelle",
  PASSERELLE_DISPLAY_NAME,
  PASSERELLE_POINTS_M,
  PASSERELLE_CURVED_VERTICES,
  PASSERELLE_DIMENSION_LABELS,
  PASSERELLE_OBSTACLES,
);

/**
 * Salle Louis Vicat (plan fourni par le client), L: 15,5 m × l: 14,25 m.
 * Seule la salle principale est modélisée : les annexes du croquis (office
 * traiteur et local voisin à droite, vestiaire en bas, petits locaux à
 * gauche de part et d'autre des entrées) sont des pièces fermées où l'on ne
 * pose pas de tables. Les deux dimensions principales sont fidèles au plan ;
 * le petit renfoncement en bas à gauche (~4,85 m × 0,85 m) est estimé à
 * partir des proportions du croquis.
 */
const VICAT_POINTS_M: [number, number][] = [
  [0, 0],
  [15.5, 0],
  [15.5, 14.25],
  [4.85, 14.25],
  [4.85, 15.1],
  [0, 15.1],
];

const VICAT_DIMENSION_LABELS: DimensionLabel[] = [
  { fromIndex: 0, toIndex: 1, side: "top" }, // largeur : 15,5 m
  { fromIndex: 1, toIndex: 2, side: "right" }, // profondeur : 14,25 m
];

/**
 * Bloc au mur gauche, entre les deux entrées (rectangle du croquis, sans
 * légende) : ~1 m × 2,45 m, position estimée sur le croquis.
 */
const VICAT_OBSTACLES: RoomObstacle[] = [{ label: "", x: 0, y: 565, widthCm: 100, heightCm: 245 }];

/** cloison mobile qui peut couper la salle en deux, à ~6,95 m du mur du haut */
const VICAT_PARTITIONS: RoomPartition[] = [
  { label: "Cloison mobile", from: { x: 100, y: 695 }, to: { x: 1550, y: 695 } },
];

export const VICAT_ROOM: Room = {
  ...roomFromPolygonM(
    "vicat",
    VICAT_DISPLAY_NAME,
    VICAT_POINTS_M,
    undefined,
    VICAT_DIMENSION_LABELS,
    VICAT_OBSTACLES,
  ),
  partitions: VICAT_PARTITIONS,
};

/** écart horizontal entre deux salles voisines sur le plan */
const ROOM_GAP_CM = 600;

export type PlacedRoom = {
  room: Room;
  /** position de l'origine du repère de la salle dans le repère du plan, en cm */
  offset: Point;
};

/**
 * Les salles affichées côte à côte, de gauche à droite, alignées en haut.
 * La première reste à l'origine du plan : le repère du plan coïncide ainsi
 * avec celui de la salle Rue intérieure Saint-Paul (compatibilité des zones
 * enregistrées avant l'ajout de la seconde salle).
 */
export const PLAN_ROOMS: PlacedRoom[] = (() => {
  const placed: PlacedRoom[] = [];
  let nextX = 0;
  for (const room of [PASSERELLE_ROOM, VICAT_ROOM]) {
    const bounds = polygonBounds(room.polygon);
    placed.push({ room, offset: { x: nextX - bounds.minX, y: -bounds.minY } });
    nextX += bounds.maxX - bounds.minX + ROOM_GAP_CM;
  }
  return placed;
})();

export const DEFAULT_ROOM_ID: RoomId = "passerelle";

export function isRoomId(value: unknown): value is RoomId {
  return PLAN_ROOMS.some(({ room }) => room.id === value);
}

export function getPlacedRoom(id: RoomId): PlacedRoom {
  return PLAN_ROOMS.find(({ room }) => room.id === id) ?? PLAN_ROOMS[0];
}

export function getRoom(id: RoomId): Room {
  return getPlacedRoom(id).room;
}

/** boîte englobante de toutes les salles, en cm, dans le repère du plan */
export function planBounds() {
  const boxes = PLAN_ROOMS.map(({ room, offset }) => {
    const b = polygonBounds(room.polygon);
    return { minX: b.minX + offset.x, maxX: b.maxX + offset.x, minY: b.minY + offset.y, maxY: b.maxY + offset.y };
  });
  return {
    minX: Math.min(...boxes.map((b) => b.minX)),
    maxX: Math.max(...boxes.map((b) => b.maxX)),
    minY: Math.min(...boxes.map((b) => b.minY)),
    maxY: Math.max(...boxes.map((b) => b.maxY)),
  };
}

const floorAreaCache = new WeakMap<Room, FloorArea>();

/**
 * Surface où l'on peut poser tables et chaises : le contour de la salle
 * telle que dessinée, arrondis compris (le `polygon` brut, lui, passe par
 * les points de contrôle des arrondis), moins ses obstacles. Mise en cache
 * par salle, car appelée en boucle pendant un drag.
 */
export function roomFloorArea(room: Room): FloorArea {
  let area = floorAreaCache.get(room);
  if (!area) {
    area = {
      outline: flattenCurvedPolygon(room.polygon, room.curvedVertices),
      holes: (room.obstacles ?? []).map(({ x, y, widthCm, heightCm }) => [
        { x, y },
        { x: x + widthCm, y },
        { x: x + widthCm, y: y + heightCm },
        { x, y: y + heightCm },
      ]),
    };
    floorAreaCache.set(room, area);
  }
  return area;
}

/** surface utilisable de la salle où est posé l'objet */
export function objectFloorArea(obj: SceneObject): FloorArea {
  return roomFloorArea(getRoom(obj.roomId));
}
