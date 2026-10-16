// lib/planner/rooms.ts
import type { Point, Room, RoomId, RoomObstacle, RoomPartition, SceneObject } from "./types";
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
  [lengthM, widthM]: [number, number],
  points: [number, number][],
  curvedVertices?: number[],
  obstacles?: RoomObstacle[],
): Room {
  return {
    id,
    name,
    polygon: metersPolygonToCm(points),
    lengthM,
    widthM,
    curvedVertices,
    obstacles,
  };
}

export const PASSERELLE_ROOM: Room = roomFromPolygonM(
  "passerelle",
  PASSERELLE_DISPLAY_NAME,
  [65.5, 14],
  PASSERELLE_POINTS_M,
  PASSERELLE_CURVED_VERTICES,
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
    [15.5, 14.25],
    VICAT_POINTS_M,
    undefined,
    VICAT_OBSTACLES,
  ),
  partitions: VICAT_PARTITIONS,
};

/** écart horizontal entre deux salles voisines sur le plan */
export const ROOM_GAP_CM = 600;

export type PlacedRoom = {
  room: Room;
  /** position de l'origine du repère de la salle dans le repère du plan, en cm */
  offset: Point;
};

/**
 * Hauteur (en cm, repère de la salle) du milieu de l'arc de cercle de la
 * salle Rue intérieure Saint-Paul : l'arrondi va du voisin précédent au
 * voisin suivant de son sommet de contrôle.
 */
function passerelleArcCenterY(): number {
  const [curved] = PASSERELLE_CURVED_VERTICES;
  const { polygon } = PASSERELLE_ROOM;
  return (polygon[curved - 1].y + polygon[curved + 1].y) / 2;
}

/**
 * Les salles affichées côte à côte, de gauche à droite. La première reste à
 * l'origine du plan : le repère du plan coïncide ainsi avec celui de la
 * salle Rue intérieure Saint-Paul (compatibilité des zones enregistrées
 * avant l'ajout de la seconde salle). La salle Louis Vicat est centrée
 * verticalement sur l'arc de cercle de la première, en face duquel elle se
 * trouve.
 */
export const PLAN_ROOMS: PlacedRoom[] = (() => {
  const passerelleBounds = polygonBounds(PASSERELLE_ROOM.polygon);
  const vicatBounds = polygonBounds(VICAT_ROOM.polygon);
  const vicatHeight = vicatBounds.maxY - vicatBounds.minY;
  return [
    { room: PASSERELLE_ROOM, offset: { x: 0, y: 0 } },
    {
      room: VICAT_ROOM,
      offset: {
        x: passerelleBounds.maxX + ROOM_GAP_CM - vicatBounds.minX,
        y: passerelleArcCenterY() - vicatHeight / 2 - vicatBounds.minY,
      },
    },
  ];
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
