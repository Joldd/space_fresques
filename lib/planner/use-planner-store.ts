// lib/planner/use-planner-store.ts
"use client";

import { useCallback, useEffect, useReducer } from "react";
import type { ChairObject, Room, Rotation, SceneObject, TableObject, ZoneObject } from "./types";
import { PASSERELLE_ROOM, isValidRoom, makeRectangleRoom } from "./rooms";
import { clampGroupDelta, clampObjectPosition, polygonBounds } from "./geometry";
import {
  DEFAULT_ZONE_HEIGHT_CM,
  DEFAULT_ZONE_WIDTH_CM,
  MIN_ZONE_SIZE_CM,
  isValidZone,
} from "./zones";
import { COLOR_PALETTE, DEFAULT_TABLE_COLOR } from "./color";

const STORAGE_KEY = "space-fresques:planner";

export const DEFAULT_ROOM: Room = PASSERELLE_ROOM;
export const DEFAULT_TABLE = { widthCm: 200, depthCm: 300 };
export const DEFAULT_CHAIR = { diameterCm: 80 };
/** en dessous, une table devient trop petite pour être maniable */
const MIN_TABLE_SIZE_CM = 20;
/** nombre d'états conservés pour Ctrl+Z */
const MAX_HISTORY = 50;
/** décalage appliqué à un collage, pour qu'il ne tombe pas exactement sur l'original */
const PASTE_OFFSET_CM = 30;

type State = {
  room: Room;
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

type HistorySnapshot = { room: Room; objects: SceneObject[]; zones: ZoneObject[] };
type ClipboardData = { objects: SceneObject[]; zones: ZoneObject[] };

type ZonePatch = Partial<Omit<ZoneObject, "id" | "kind">>;

type Action =
  | { type: "LOAD"; room: Room; objects: SceneObject[]; zones: ZoneObject[] }
  | { type: "MARK_HYDRATED" }
  | { type: "SET_ROOM"; room: Room }
  | { type: "ADD_TABLE"; widthCm: number; depthCm: number }
  | { type: "ADD_CHAIR"; diameterCm: number }
  | { type: "REMOVE_SELECTED" }
  | { type: "MOVE_SELECTED"; dxCm: number; dyCm: number }
  | { type: "ROTATE_SELECTED_TABLES" }
  | { type: "SELECT"; ids: string[]; additive: boolean }
  | { type: "SELECT_RECT"; ids: string[]; additive: boolean }
  | { type: "CLEAR_SELECTION" }
  | { type: "ADD_ZONE" }
  | { type: "UPDATE_ZONE"; id: string; patch: ZonePatch }
  | { type: "REMOVE_ZONE"; id: string }
  | { type: "REMOVE_SELECTED_ZONE" }
  | { type: "SELECT_ZONE"; id: string | null }
  | { type: "UPDATE_TABLE"; id: string; patch: Partial<Pick<TableObject, "widthCm" | "depthCm" | "color">> }
  | { type: "PUSH_HISTORY" }
  | { type: "UNDO" }
  | { type: "COPY_SELECTION" }
  | { type: "PASTE" }
  | { type: "RESET" };

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

/** replace tous les objets à l'intérieur du polygone donné (best-effort, un par un) */
function clampAllObjects(objects: SceneObject[], room: Room): SceneObject[] {
  return objects.map((obj) => {
    const { x, y } = clampObjectPosition(obj, room.polygon);
    return x === obj.x && y === obj.y ? obj : { ...obj, x, y };
  });
}

/**
 * Empile l'état courant (avant la modification en cours) sur la pile
 * d'annulation, plafonnée à MAX_HISTORY entrées. À appeler avec l'état
 * *avant* changement — jamais avec le nouvel état en cours de construction.
 */
function withHistory(state: State): HistorySnapshot[] {
  const next = [...state.past, { room: state.room, objects: state.objects, zones: state.zones }];
  return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
}

type Footprint = Omit<TableObject, "id" | "x" | "y"> | Omit<ChairObject, "id" | "x" | "y">;

/** point de départ (centre de la boîte englobante) + décalage en cascade, ramené dans la salle */
function spawnPosition(state: State, footprint: Footprint): {
  x: number;
  y: number;
} {
  const step = 28; // cm
  const cascadeLength = 8;
  const offset = (state.objects.length % cascadeLength) * step;
  const bounds = polygonBounds(state.room.polygon);
  const candidate = {
    x: (bounds.minX + bounds.maxX) / 2 + offset,
    y: (bounds.minY + bounds.maxY) / 2 + offset,
  };
  const probe = { id: "spawn-probe", ...footprint, ...candidate } as SceneObject;
  return clampObjectPosition(probe, state.room.polygon);
}

/**
 * point de départ d'une nouvelle zone (centrée sur la salle + cascade) — pas
 * de clamp ici, une zone peut librement dépasser du contour de la salle.
 */
function spawnZonePosition(state: State): { x: number; y: number } {
  const step = 24; // cm
  const cascadeLength = 8;
  const offset = (state.zones.length % cascadeLength) * step;
  const bounds = polygonBounds(state.room.polygon);
  return {
    x: (bounds.minX + bounds.maxX) / 2 - DEFAULT_ZONE_WIDTH_CM / 2 + offset,
    y: (bounds.minY + bounds.maxY) / 2 - DEFAULT_ZONE_HEIGHT_CM / 2 + offset,
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "LOAD":
      return {
        ...state,
        room: action.room,
        objects: clampAllObjects(action.objects, action.room),
        zones: action.zones,
        selectedIds: [],
        selectedZoneId: null,
        hydrated: true,
        past: [],
        clipboard: null,
      };

    case "MARK_HYDRATED":
      return state.hydrated ? state : { ...state, hydrated: true };

    case "SET_ROOM":
      return {
        ...state,
        past: withHistory(state),
        room: action.room,
        objects: clampAllObjects(state.objects, action.room),
      };

    case "ADD_TABLE": {
      const { x, y } = spawnPosition(state, {
        kind: "table",
        widthCm: action.widthCm,
        depthCm: action.depthCm,
        rotation: 0,
      });
      const table: TableObject = {
        id: crypto.randomUUID(),
        kind: "table",
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
        diameterCm: action.diameterCm,
      });
      const chair: ChairObject = {
        id: crypto.randomUUID(),
        kind: "chair",
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
      const { dx, dy } = clampGroupDelta(selectedObjects, action.dxCm, action.dyCm, state.room.polygon);
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
      const { x, y } = spawnZonePosition(state);
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
          const { x, y } = clampObjectPosition(updated, state.room.polygon);
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
        room: previous.room,
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
        const { x, y } = clampObjectPosition(candidate, state.room.polygon);
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
      // repart de la salle et du plan par défaut ; l'effet de sauvegarde
      // écrase alors la sauvegarde locale avec cet état vierge. On garde un
      // filet de rattrapage : un Ctrl+Z juste après restaure tout le plan.
      return {
        ...initialState(),
        hydrated: true,
        past: withHistory(state),
      };

    default:
      return state;
  }
}

function initialState(): State {
  return {
    room: DEFAULT_ROOM,
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
        const saved = JSON.parse(raw) as {
          room: unknown;
          objects: SceneObject[];
          zones?: unknown[];
        };
        const room = isValidRoom(saved.room) ? saved.room : DEFAULT_ROOM;
        const zones = (saved.zones ?? []).filter(isValidZone);
        dispatch({ type: "LOAD", room, objects: saved.objects ?? [], zones });
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
        JSON.stringify({ room: state.room, objects: state.objects, zones: state.zones }),
      );
    } catch {
      // quota dépassé ou stockage désactivé : on ignore
    }
  }, [state.hydrated, state.room, state.objects, state.zones]);

  const setRoom = useCallback(
    (room: Room) => dispatch({ type: "SET_ROOM", room }),
    [],
  );
  const setRectangleRoom = useCallback(
    (widthM: number, heightM: number) => dispatch({ type: "SET_ROOM", room: makeRectangleRoom(widthM, heightM) }),
    [],
  );
  const setPasserelleRoom = useCallback(
    () => dispatch({ type: "SET_ROOM", room: PASSERELLE_ROOM }),
    [],
  );
  const addTable = useCallback(
    (widthCm: number, depthCm: number) =>
      dispatch({ type: "ADD_TABLE", widthCm, depthCm }),
    [],
  );
  const addChair = useCallback(
    (diameterCm: number) => dispatch({ type: "ADD_CHAIR", diameterCm }),
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
  const addZone = useCallback(() => dispatch({ type: "ADD_ZONE" }), []);
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
    (id: string, patch: Partial<Pick<TableObject, "widthCm" | "depthCm" | "color">>) =>
      dispatch({ type: "UPDATE_TABLE", id, patch }),
    [],
  );
  const pushHistory = useCallback(() => dispatch({ type: "PUSH_HISTORY" }), []);
  const undo = useCallback(() => dispatch({ type: "UNDO" }), []);
  const copySelection = useCallback(() => dispatch({ type: "COPY_SELECTION" }), []);
  const paste = useCallback(() => dispatch({ type: "PASTE" }), []);
  const resetPlan = useCallback(() => dispatch({ type: "RESET" }), []);

  return {
    room: state.room,
    objects: state.objects,
    zones: state.zones,
    selectedIds: state.selectedIds,
    selectedZoneId: state.selectedZoneId,
    canUndo: state.past.length > 0,
    canPaste: state.clipboard !== null,
    setRoom,
    setRectangleRoom,
    setPasserelleRoom,
    addTable,
    addChair,
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
  };
}

export type PlannerStore = ReturnType<typeof usePlannerStore>;
