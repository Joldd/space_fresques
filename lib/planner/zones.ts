// lib/planner/zones.ts
import type { ZoneObject } from "./types";

export const DEFAULT_ZONE_WIDTH_CM = 300;
export const DEFAULT_ZONE_HEIGHT_CM = 200;
export const MIN_ZONE_SIZE_CM = 50;

/** vérifie qu'une zone chargée depuis le stockage a bien la forme attendue */
export function isValidZone(value: unknown): value is ZoneObject {
  if (!value || typeof value !== "object") return false;
  const zone = value as Partial<ZoneObject>;
  return (
    zone.kind === "zone" &&
    typeof zone.id === "string" &&
    typeof zone.x === "number" &&
    typeof zone.y === "number" &&
    typeof zone.widthCm === "number" &&
    typeof zone.heightCm === "number" &&
    typeof zone.color === "string" &&
    typeof zone.name === "string"
  );
}
