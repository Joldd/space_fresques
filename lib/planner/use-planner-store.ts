// lib/planner/use-planner-store.ts
"use client";

import { useCallback, useEffect, useReducer } from "react";
import type { ChairObject, Point, RoomId, Rotation, SceneObject, TableObject, ZoneObject } from "./types";
import { getPlacedRoom, objectFloorArea } from "./rooms";
import { clampGroupDelta, clampObjectPosition, polygonBounds } from "./geometry";
import {
  DEFAULT_ZONE_HEIGHT_CM,
  DEFAULT_ZONE_WIDTH_CM,
  MIN_ZONE_SIZE_CM,
} from "./zones";
import { COLOR_PALETTE, DEFAULT_TABLE_COLOR } from "./color";
import { sanitizePlanData, type PlanData } from "./plan-file";

const STORAGE_KEY = "space-fresques:planner";

export const DEFAULT_TABLE = { widthCm: 200, depthCm: 300 };
export const DEFAULT_CHAIR = { diameterCm: 80 };
/** en dessous, une table devient trop petite pour être maniable */
const MIN_TABLE_SIZE_CM = 20;
/** nombre d'états conservés pour Ctrl+Z */
const MAX_HISTORY = 50;
/** décalage appliqué à un collage, pour qu'il ne tombe pas exactement sur l'original */
const PASTE_OFFSET_CM = 30;

type State = {
  objects: SceneObject[];
  zones: ZoneObject[];
  selectedIds: string[];
  /** id de la zone sélectionnée (une seule à la fois, exclusif avec `selectedIds`) */
  selectedZoneId: string | null;
  /** true dès que la lecture du localStorage a été tentée (succès ou non) */
  hydrated: boolean;
  /** états antérieurs pour Ctrl+Z — le plus récent en dernier */
  past: HistorySnapshot[];
  /** dernier élément copié (Ctrl+C), en mémoire uniquement (pas persisté) */
  clipboard: ClipboardData | null;
};

type HistorySnapshot = { objects: SceneObject[]; zones: ZoneObject[] };
type ClipboardData = { objects: SceneObject[]; zones: ZoneObject[] };

type ZonePatch = Partial<Omit<ZoneObject, "id" | "kind">>;

type Action =
  | { type: "LOAD"; objects: SceneObject[]; zones: ZoneObject[] }
  | { type: "MARK_HYDRATED" }
  | { type: "ADD_TABLE"; roomId: RoomId; widthCm: number; depthCm: number }
  | { type: "ADD_CHAIR"; roomId: RoomId; diameterCm: number }
  | { type: "MOVE_TABLE_TO_ROOM"; id: string; roomId: RoomId }
  | { type: "REMOVE_SELECTED" }
  | { type: "MOVE_SELECTED"; dxCm: number; dyCm: number }
  | { type: "ROTATE_SELECTED_TABLES" }
  | { type: "SELECT"; ids: string[]; additive: boolean }
  | { type: "SELECT_RECT"; ids: string[]; additive: boolean }
  | { type: "CLEAR_SELECTION" }
  | { type: "ADD_ZONE"; center: Point }
  | { type: "UPDATE_ZONE"; id: string; patch: ZonePatch }
  | { type: "REMOVE_ZONE"; id: string }
  | { type: "REMOVE_SELECTED_ZONE" }
  | { type: "SELECT_ZONE"; id: string | null }
  | { type: "UPDATE_TABLE"; id: string; patch: Partial<Pick<TableObject, "widthCm" | "depthCm" | "color" | "name">> }
  | { type: "PUSH_HISTORY" }
  | { type: "UNDO" }
  | { type: "COPY_SELECTION" }
  | { type: "PASTE" }
  | { type: "RESET" }
  | { type: "OPEN_PLAN"; plan: PlanData };

function nextRotation(rotation: Rotation): Rotation {
  return ((rotation + 90) % 360) as Rotation;
}

function toggleSelection(current: string[], ids: string[]): string[] {
  const set = new Set(current);
  for (const id of ids) {
    if (set.has(id)) set.delete(id);
    else set.add(id);
  }
  return Array.from(set);
}

function mergeSelection(current: string[], ids: string[]): string[] {
  return Array.from(new Set([...current, ...ids]));
}

/** replace chaque objet à l'intérieur de sa salle (best-effort, un par un) */
function clampAllObjects(objects: SceneObject[]): SceneObject[] {
  return objects.map((obj) => {
    const { x, y } = clampObjectPosition(obj, objectFloorArea(obj));
    return x === obj.x && y === obj.y ? obj : { ...obj, x, y };
  });
}

/**
 * Empile l'état courant (avant la modification en cours) sur la pile
 * d'annulation, plafonnée à MAX_HISTORY entrées. À appeler avec l'état
 * *avant* changement — jamais avec le nouvel état en cours de construction.
 */
function withHistory(state: State): HistorySnapshot[] {
  const next = [...state.past, { objects: state.objects, zones: state.zones }];
  return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
}

type Footprint = Omit<TableObject, "id" | "x" | "y"> | Omit<ChairObject, "id" | "x" | "y">;

/**
 * point de départ (centre de la boîte englobante de la salle) + décalage en
 * cascade selon le nombre d'objets déjà dans cette salle, ramené dans la salle
 */
function spawnPosition(state: State, footprint: Footprint): {
  x: number;
  y: number;
} {
  const step = 28; // cm
  const cascadeLength = 8;
  const countInRoom = state.objects.filter((obj) => obj.roomId === footprint.roomId).length;
  const offset = (countInRoom % cascadeLength) * step;
  const bounds = polygonBounds(getPlacedRoom(footprint.roomId).room.polygon);
  const candidate = {
    x: (bounds.minX + bounds.maxX) / 2 + offset,
    y: (bounds.minY + bounds.maxY) / 2 + offset,
  };
  const probe = { id: "spawn-probe", ...footprint, ...candidate } as SceneObject;
  return clampObjectPosition(probe, objectFloorArea(probe));
}

/**
 * point de départ d'une nouvelle zone (centrée sur `center` + cascade), dans
 * le repère du plan — pas de clamp ici, une zone peut librement dépasser du
 * contour des salles.
 */
function spawnZonePosition(state: State, center: Point): { x: number; y: number } {
  const step = 24; // cm
  const cascadeLength = 8;
  const offset = (state.zones.length % cascadeLength) * step;
  return {
    x: center.x - DEFAULT_ZONE_WIDTH_CM / 2 + offset,
    y: center.y - DEFAULT_ZONE_HEIGHT_CM / 2 + offset,
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "LOAD":
      return {
        ...state,
        objects: clampAllObjects(action.objects),
        zones: action.zones,
        selectedIds: [],
        selectedZoneId: null,
        hydrated: true,
        past: [],
        clipboard: null,
      };

    case "MARK_HYDRATED":
      return state.hydrated ? state : { ...state, hydrated: true };

    case "ADD_TABLE": {
      const { x, y } = spawnPosition(state, {
        kind: "table",
        roomId: action.roomId,
        widthCm: action.widthCm,
        depthCm: action.depthCm,
        rotation: 0,
      });
      const table: TableObject = {
        id: crypto.randomUUID(),
        kind: "table",
        roomId: action.roomId,
        x,
        y,
        widthCm: action.widthCm,
        depthCm: action.depthCm,
        rotation: 0,
        color: DEFAULT_TABLE_COLOR,
      };
      return {
        ...state,
        past: withHistory(state),
        objects: [...state.objects, table],
        selectedIds: [table.id],
        selectedZoneId: null,
      };
    }

    case "ADD_CHAIR": {
      const { x, y } = spawnPosition(state, {
        kind: "chair",
        roomId: action.roomId,
        diameterCm: action.diameterCm,
      });
      const chair: ChairObject = {
        id: crypto.randomUUID(),
        kind: "chair",
        roomId: action.roomId,
        x,
        y,
        diameterCm: action.diameterCm,
      };
      return {
        ...state,
        past: withHistory(state),
        objects: [...state.objects, chair],
        selectedIds: [chair.id],
        selectedZoneId: null,
      };
    }

    // le drag ne permet pas de sortir une table de sa salle : on la change
    // de salle explicitement (menu de la table), en la reposant au centre
    // de la salle d'arrivée comme une table fraîchement ajoutée
    case "MOVE_TABLE_TO_ROOM": {
      const table = state.objects.find((obj) => obj.id === action.id);
      if (!table || table.kind !== "table" || table.roomId === action.roomId) return state;
      const { x, y } = spawnPosition(state, { ...table, roomId: action.roomId });
      return {
        ...state,
        past: withHistory(state),
        objects: state.objects.map((obj) =>
          obj.id === action.id ? { ...table, roomId: action.roomId, x, y } : obj,
        ),
      };
    }

    case "REMOVE_SELECTED": {
      if (state.selectedIds.length === 0) return state;
      const selected = new Set(state.selectedIds);
      return {
        ...state,
        past: withHistory(state),
        objects: state.objects.filter((obj) => !selected.has(obj.id)),
        selectedIds: [],
      };
    }

    case "MOVE_SELECTED": {
      if (state.selectedIds.length === 0) return state;
      const selected = new Set(state.selectedIds);
      const selectedObjects = state.objects.filter((obj) => selected.has(obj.id));
      const { dx, dy } = clampGroupDelta(selectedObjects, action.dxCm, action.dyCm, objectFloorArea);
      if (dx === 0 && dy === 0) return state;
      return {
        ...state,
        objects: state.objects.map((obj) =>
          selected.has(obj.id) ? { ...obj, x: obj.x + dx, y: obj.y + dy } : obj,
        ),
      };
    }

    case "ROTATE_SELECTED_TABLES": {
      const selected = new Set(state.selectedIds);
      return {
        ...state,
        past: withHistory(state),
        objects: state.objects.map((obj) =>
          obj.kind === "table" && selected.has(obj.id)
            ? { ...obj, rotation: nextRotation(obj.rotation) }
            : obj,
        ),
      };
    }

    case "SELECT":
      return {
        ...state,
        selectedIds: action.additive
          ? toggleSelection(state.selectedIds, action.ids)
          : action.ids,
        selectedZoneId: null,
      };

    case "SELECT_RECT":
      return {
        ...state,
        selectedIds: action.additive
          ? mergeSelection(state.selectedIds, action.ids)
          : action.ids,
        selectedZoneId: null,
      };

    case "CLEAR_SELECTION":
      return state.selectedIds.length === 0 && state.selectedZoneId === null
        ? state
        : { ...state, selectedIds: [], selectedZoneId: null };

    case "ADD_ZONE": {
      const { x, y } = spawnZonePosition(state, action.center);
      const zone: ZoneObject = {
        id: crypto.randomUUID(),
        kind: "zone",
        x,
        y,
        widthCm: DEFAULT_ZONE_WIDTH_CM,
        heightCm: DEFAULT_ZONE_HEIGHT_CM,
        color: COLOR_PALETTE[state.zones.length % COLOR_PALETTE.length],
        name: `Zone ${state.zones.length + 1}`,
      };
      return {
        ...state,
        past: withHistory(state),
        zones: [...state.zones, zone],
        selectedZoneId: zone.id,
        selectedIds: [],
      };
    }

    case "UPDATE_ZONE": {
      const patch = { ...action.patch };
      if (patch.widthCm !== undefined) {
        patch.widthCm = Math.max(patch.widthCm, MIN_ZONE_SIZE_CM);
      }
      if (patch.heightCm !== undefined) {
        patch.heightCm = Math.max(patch.heightCm, MIN_ZONE_SIZE_CM);
      }
      return {
        ...state,
        zones: state.zones.map((z) => (z.id === action.id ? { ...z, ...patch } : z)),
      };
    }

    case "REMOVE_ZONE":
      return {
        ...state,
        past: withHistory(state),
        zones: state.zones.filter((z) => z.id !== action.id),
        selectedZoneId: state.selectedZoneId === action.id ? null : state.selectedZoneId,
      };

    case "REMOVE_SELECTED_ZONE":
      return state.selectedZoneId === null
        ? state
        : {
            ...state,
            past: withHistory(state),
            zones: state.zones.filter((z) => z.id !== state.selectedZoneId),
            selectedZoneId: null,
          };

    case "SELECT_ZONE":
      return {
        ...state,
        selectedZoneId: action.id,
        selectedIds: action.id === null ? state.selectedIds : [],
      };

    case "UPDATE_TABLE": {
      const patch = { ...action.patch };
      if (patch.widthCm !== undefined) patch.widthCm = Math.max(patch.widthCm, MIN_TABLE_SIZE_CM);
      if (patch.depthCm !== undefined) patch.depthCm = Math.max(patch.depthCm, MIN_TABLE_SIZE_CM);
      return {
        ...state,
        objects: state.objects.map((obj) => {
          if (obj.id !== action.id || obj.kind !== "table") return obj;
          const updated = { ...obj, ...patch };
          // les nouvelles dimensions peuvent faire dépasser la table du
          // contour de la salle : on la ramène à l'intérieur, comme pour
          // n'importe quel autre déplacement
          const { x, y } = clampObjectPosition(updated, objectFloorArea(updated));
          return { ...updated, x, y };
        }),
      };
    }

    // déplacement (drag) et redimensionnement (poignées de zone, champs de
    // dimensions des menus contextuels) dispatchent en continu pendant le
    // geste — c'est à l'appelant de dispatcher PUSH_HISTORY une seule fois,
    // au tout début du geste, pour qu'un Ctrl+Z annule le geste entier
    case "PUSH_HISTORY":
      return { ...state, past: withHistory(state) };

    case "UNDO": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        ...state,
        objects: previous.objects,
        zones: previous.zones,
        past: state.past.slice(0, -1),
        selectedIds: [],
        selectedZoneId: null,
      };
    }

    case "COPY_SELECTION": {
      if (state.selectedZoneId) {
        const zone = state.zones.find((z) => z.id === state.selectedZoneId);
        return zone ? { ...state, clipboard: { objects: [], zones: [zone] } } : state;
      }
      if (state.selectedIds.length > 0) {
        const selected = new Set(state.selectedIds);
        const objects = state.objects.filter((o) => selected.has(o.id));
        return objects.length > 0 ? { ...state, clipboard: { objects, zones: [] } } : state;
      }
      return state;
    }

    case "PASTE": {
      const clip = state.clipboard;
      if (!clip || (clip.objects.length === 0 && clip.zones.length === 0)) return state;

      const newObjects: SceneObject[] = clip.objects.map((o) => {
        const candidate = { ...o, id: crypto.randomUUID(), x: o.x + PASTE_OFFSET_CM, y: o.y + PASTE_OFFSET_CM };
        const { x, y } = clampObjectPosition(candidate, objectFloorArea(candidate));
        return { ...candidate, x, y };
      });
      const newZones: ZoneObject[] = clip.zones.map((z) => ({
        ...z,
        id: crypto.randomUUID(),
        x: z.x + PASTE_OFFSET_CM,
        y: z.y + PASTE_OFFSET_CM,
      }));

      return {
        ...state,
        past: withHistory(state),
        objects: [...state.objects, ...newObjects],
        zones: [...state.zones, ...newZones],
        selectedIds: newObjects.map((o) => o.id),
        selectedZoneId: newZones[0]?.id ?? null,
      };
    }

    case "RESET":
      // repart d'un plan vide ; l'effet de sauvegarde
      // écrase alors la sauvegarde locale avec cet état vierge. On garde un
      // filet de rattrapage : un Ctrl+Z juste après restaure tout le plan.
      return {
        ...initialState(),
        hydrated: true,
        past: withHistory(state),
      };

    case "OPEN_PLAN":
      // ouverture d'un plan enregistré ou importé : remplace tout le plan
      // en cours, mais reste annulable par Ctrl+Z (contrairement à LOAD)
      return {
        ...state,
        past: withHistory(state),
        objects: clampAllObjects(action.plan.objects),
        zones: action.plan.zones,
        selectedIds: [],
        selectedZoneId: null,
      };

    default:
      return state;
  }
}

function initialState(): State {
  return {
    objects: [],
    zones: [],
    selectedIds: [],
    selectedZoneId: null,
    hydrated: false,
    past: [],
    clipboard: null,
  };
}

export function usePlannerStore() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  // charge le plan sauvegardé au montage (client uniquement) ; le flag
  // `hydrated` vit dans le reducer pour que l'effet de sauvegarde ci-dessous
  // ne voie jamais un état "hydraté" avec encore les valeurs par défaut
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        // même nettoyage qu'un fichier importé (dont la migration des plans
        // enregistrés avant l'ajout de la seconde salle)
        const saved = sanitizePlanData(JSON.parse(raw));
        if (saved) dispatch({ type: "LOAD", ...saved });
        else dispatch({ type: "MARK_HYDRATED" });
      } else {
        dispatch({ type: "MARK_HYDRATED" });
      }
    } catch {
      // localStorage indisponible ou données corrompues : on ignore
      dispatch({ type: "MARK_HYDRATED" });
    }
  }, []);

  // sauvegarde à chaque changement (une fois l'hydratation initiale faite)
  useEffect(() => {
    if (!state.hydrated) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ objects: state.objects, zones: state.zones }),
      );
    } catch {
      // quota dépassé ou stockage désactivé : on ignore
    }
  }, [state.hydrated, state.objects, state.zones]);

  const addTable = useCallback(
    (roomId: RoomId, widthCm: number, depthCm: number) =>
      dispatch({ type: "ADD_TABLE", roomId, widthCm, depthCm }),
    [],
  );
  const addChair = useCallback(
    (roomId: RoomId, diameterCm: number) => dispatch({ type: "ADD_CHAIR", roomId, diameterCm }),
    [],
  );
  const moveTableToRoom = useCallback(
    (id: string, roomId: RoomId) => dispatch({ type: "MOVE_TABLE_TO_ROOM", id, roomId }),
    [],
  );
  const removeSelected = useCallback(
    () => dispatch({ type: "REMOVE_SELECTED" }),
    [],
  );
  const moveSelected = useCallback(
    (dxCm: number, dyCm: number) =>
      dispatch({ type: "MOVE_SELECTED", dxCm, dyCm }),
    [],
  );
  const rotateSelectedTables = useCallback(
    () => dispatch({ type: "ROTATE_SELECTED_TABLES" }),
    [],
  );
  const select = useCallback(
    (ids: string[], additive: boolean) =>
      dispatch({ type: "SELECT", ids, additive }),
    [],
  );
  const selectRect = useCallback(
    (ids: string[], additive: boolean) =>
      dispatch({ type: "SELECT_RECT", ids, additive }),
    [],
  );
  const clearSelection = useCallback(
    () => dispatch({ type: "CLEAR_SELECTION" }),
    [],
  );
  const addZone = useCallback((center: Point) => dispatch({ type: "ADD_ZONE", center }), []);
  const updateZone = useCallback(
    (id: string, patch: ZonePatch) => dispatch({ type: "UPDATE_ZONE", id, patch }),
    [],
  );
  const removeZone = useCallback(
    (id: string) => dispatch({ type: "REMOVE_ZONE", id }),
    [],
  );
  const removeSelectedZone = useCallback(
    () => dispatch({ type: "REMOVE_SELECTED_ZONE" }),
    [],
  );
  const selectZone = useCallback(
    (id: string | null) => dispatch({ type: "SELECT_ZONE", id }),
    [],
  );
  const updateTable = useCallback(
    (id: string, patch: Partial<Pick<TableObject, "widthCm" | "depthCm" | "color" | "name">>) =>
      dispatch({ type: "UPDATE_TABLE", id, patch }),
    [],
  );
  const pushHistory = useCallback(() => dispatch({ type: "PUSH_HISTORY" }), []);
  const undo = useCallback(() => dispatch({ type: "UNDO" }), []);
  const copySelection = useCallback(() => dispatch({ type: "COPY_SELECTION" }), []);
  const paste = useCallback(() => dispatch({ type: "PASTE" }), []);
  const resetPlan = useCallback(() => dispatch({ type: "RESET" }), []);
  const openPlan = useCallback((plan: PlanData) => dispatch({ type: "OPEN_PLAN", plan }), []);

  return {
    objects: state.objects,
    zones: state.zones,
    selectedIds: state.selectedIds,
    selectedZoneId: state.selectedZoneId,
    canUndo: state.past.length > 0,
    canPaste: state.clipboard !== null,
    addTable,
    addChair,
    moveTableToRoom,
    removeSelected,
    moveSelected,
    rotateSelectedTables,
    select,
    selectRect,
    clearSelection,
    addZone,
    updateZone,
    removeZone,
    removeSelectedZone,
    selectZone,
    updateTable,
    pushHistory,
    undo,
    copySelection,
    paste,
    resetPlan,
    openPlan,
  };
}

export type PlannerStore = ReturnType<typeof usePlannerStore>;
