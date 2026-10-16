// lib/planner/plan-file.ts
// Format d'échange d'une configuration de plan (tables/chaises de chaque
// salle + zones) : utilisé pour l'export/import en fichier .json (partage) et pour
// les plans enregistrés dans le navigateur (voir saved-plans.ts).

import type { ChairObject, SceneObject, ShapeObject, TableObject, ZoneObject } from "./types";
import { DEFAULT_ROOM_ID, isRoomId } from "./rooms";
import { isValidZone } from "./zones";
import { isValidShape } from "./shapes";

/**
 * Les salles elles-mêmes (contours, obstacles...) ne font pas partie du
 * plan : elles sont définies dans le code (voir PLAN_ROOMS), chaque table ou
 * chaise indique seulement dans quelle salle elle est posée.
 */
export type PlanData = {
  objects: SceneObject[];
  zones: ZoneObject[];
  shapes: ShapeObject[];
};

/** marqueur permettant de reconnaître un fichier exporté par l'outil */
const PLAN_FILE_APP = "space-fresques-planner";
/** v1 : une seule salle (champ `room`), objets sans `roomId` ; v2 : plusieurs salles */
const PLAN_FILE_VERSION = 2;

type PlanFile = PlanData & {
  app: typeof PLAN_FILE_APP;
  version: number;
  name: string;
  savedAt: string;
};

const ROTATIONS = new Set([0, 90, 180, 270]);

function isValidTable(value: Partial<TableObject>): boolean {
  return (
    typeof value.widthCm === "number" &&
    typeof value.depthCm === "number" &&
    ROTATIONS.has(value.rotation as number) &&
    (value.color === undefined || typeof value.color === "string") &&
    (value.name === undefined || typeof value.name === "string")
  );
}

function isValidChair(value: Partial<ChairObject>): boolean {
  return typeof value.diameterCm === "number";
}

export function isValidSceneObject(value: unknown): value is SceneObject {
  if (!value || typeof value !== "object") return false;
  const obj = value as Partial<SceneObject>;
  if (typeof obj.id !== "string" || typeof obj.x !== "number" || typeof obj.y !== "number") return false;
  if (!isRoomId(obj.roomId)) return false;
  if (obj.kind === "table") return isValidTable(obj);
  if (obj.kind === "chair") return isValidChair(obj);
  return false;
}

/**
 * Objets enregistrés avant l'ajout d'une seconde salle (sans `roomId`), ou
 * rattachés à une salle qui n'existe plus : on les replace dans la salle
 * d'origine plutôt que de les perdre.
 */
function withDefaultRoomId(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  if (isRoomId((value as { roomId?: unknown }).roomId)) return value;
  return { ...value, roomId: DEFAULT_ROOM_ID };
}

/**
 * Vérifie et nettoie des données de plan venant de l'extérieur (fichier
 * importé, stockage local). Les éléments mal formés sont ignorés plutôt que
 * de faire échouer tout le chargement. Un plan enregistré avant l'ajout de
 * la seconde salle (un champ `room` unique) est rattaché à la salle
 * d'origine ; son ancien contour, lui, est ignoré au profit des salles
 * définies dans le code.
 */
export function sanitizePlanData(value: unknown): PlanData | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as { objects?: unknown; zones?: unknown; shapes?: unknown };
  if (!Array.isArray(raw.objects) && !Array.isArray(raw.zones)) return null;
  const objects = Array.isArray(raw.objects)
    ? raw.objects.map(withDefaultRoomId).filter(isValidSceneObject)
    : [];
  const zones = Array.isArray(raw.zones) ? raw.zones.filter(isValidZone) : [];
  // les formes sont apparues après la v2 : absentes des plans plus anciens
  const shapes = Array.isArray(raw.shapes) ? raw.shapes.filter(isValidShape) : [];
  return { objects, zones, shapes };
}

export function serializePlanFile(plan: PlanData, name: string): string {
  const file: PlanFile = {
    app: PLAN_FILE_APP,
    version: PLAN_FILE_VERSION,
    name,
    savedAt: new Date().toISOString(),
    objects: plan.objects,
    zones: plan.zones,
    shapes: plan.shapes,
  };
  return JSON.stringify(file, null, 2);
}

/** lit le contenu d'un fichier .json exporté ; lève une Error au message lisible sinon */
export function parsePlanFile(text: string): { plan: PlanData; name: string | null } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Ce fichier n'est pas un plan valide (JSON illisible).");
  }
  const file = json as Partial<PlanFile> | null;
  if (!file || typeof file !== "object" || file.app !== PLAN_FILE_APP) {
    throw new Error("Ce fichier n'a pas été exporté depuis le plan de salle.");
  }
  if (typeof file.version !== "number" || file.version > PLAN_FILE_VERSION) {
    throw new Error("Ce fichier vient d'une version plus récente de l'outil.");
  }
  const plan = sanitizePlanData(file);
  if (!plan) throw new Error("Ce fichier de plan est incomplet ou corrompu.");
  return { plan, name: typeof file.name === "string" && file.name.trim() ? file.name.trim() : null };
}

export function downloadPlanFile(plan: PlanData, name: string, filename: string) {
  const blob = new Blob([serializePlanFile(plan, name)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
