// lib/planner/rooms.ts
import type { Room } from "./types";
import { polygonBounds, rectanglePolygon } from "./geometry";

/**
 * Contour approximatif de la salle "Passerelle" (plan fourni par le client),
 * L: 65,5 m × l: 14 m. Les deux dimensions principales sont fidèles au plan ;
 * la bosse et le rétrécissement en pied sont estimés à partir des
 * proportions du croquis (seules L et l y sont chiffrées). La petite
 * niche d'escalier signalée en pointillés (passerelle en hauteur) n'est
 * pas modélisée : elle n'affecte pas le sol utilisable.
 */
const PASSERELLE_POINTS_M: [number, number][] = [
  [0, 0],
  [14, 0],
  [18, 13],
  [19, 20],
  [18, 27],
  [14, 40],
  [9, 52],
  [9, 65.5],
  [0, 65.5],
];

function metersPolygonToCm(points: [number, number][]) {
  return points.map(([x, y]) => ({ x: x * 100, y: y * 100 }));
}

function roomFromPolygonM(
  kind: Room["kind"],
  points: [number, number][],
): Room {
  const polygon = metersPolygonToCm(points);
  const bounds = polygonBounds(polygon);
  return {
    kind,
    polygon,
    widthM: (bounds.maxX - bounds.minX) / 100,
    heightM: (bounds.maxY - bounds.minY) / 100,
  };
}

export const PASSERELLE_ROOM: Room = roomFromPolygonM("passerelle", PASSERELLE_POINTS_M);

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
