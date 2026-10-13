// lib/planner/plan-file.ts
// Format d'échange d'une configuration de plan (salle + tables/chaises +
// zones) : utilisé pour l'export/import en fichier .json (partage) et pour
// les plans enregistrés dans le navigateur (voir saved-plans.ts).

import type { ChairObject, Room, SceneObject, TableObject, ZoneObject } from "./types";
import { PASSERELLE_ROOM, isValidRoom } from "./rooms";
import { isValidZone } from "./zones";

export type PlanData = {
  room: Room;
  objects: SceneObject[];
  zones: ZoneObject[];
};

/** marqueur permettant de reconnaître un fichier exporté par l'outil */
const PLAN_FILE_APP = "space-fresques-planner";
const PLAN_FILE_VERSION = 1;

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
  if (obj.kind === "table") return isValidTable(obj);
  if (obj.kind === "chair") return isValidChair(obj);
  return false;
}

/**
 * Vérifie et nettoie des données de plan venant de l'extérieur (fichier
 * importé, stockage local). La salle "passerelle" est toujours remplacée par
 * sa définition actuelle dans le code : un plan enregistré avant une
 * retouche du contour profite ainsi du contour à jour. Les éléments mal
 * formés sont ignorés plutôt que de faire échouer tout le chargement.
 */
export function sanitizePlanData(value: unknown): PlanData | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as { room?: unknown; objects?: unknown; zones?: unknown };
  if (!isValidRoom(raw.room)) return null;
  const room = raw.room.kind === "passerelle" ? PASSERELLE_ROOM : raw.room;
  const objects = Array.isArray(raw.objects) ? raw.objects.filter(isValidSceneObject) : [];
  const zones = Array.isArray(raw.zones) ? raw.zones.filter(isValidZone) : [];
  return { room, objects, zones };
}

export function serializePlanFile(plan: PlanData, name: string): string {
  const file: PlanFile = {
    app: PLAN_FILE_APP,
    version: PLAN_FILE_VERSION,
    name,
    savedAt: new Date().toISOString(),
    room: plan.room,
    objects: plan.objects,
    zones: plan.zones,
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
