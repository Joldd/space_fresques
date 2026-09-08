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
  ZONE_COLOR_PALETTE,
  isValidZone,
} from "./zones";

const STORAGE_KEY = "space-fresques:planner";

export const DEFAULT_ROOM: Room = PASSERELLE_ROOM;
export const DEFAULT_TABLE = { widthCm: 200, depthCm: 300 };
export const DEFAULT_CHAIR = { diameterCm: 80 };

type State = {
  room: Room;
  objects: SceneObject[];
  zones: ZoneObject[];
  selectedIds: string[];
  /** id de la zone sélectionnée (une seule à la fois, exclusif avec `selectedIds`) */
  selectedZoneId: string | null;
  /** true dès que la lecture du localStorage a été tentée (succès ou non) */
  hydrated: boolean;
};

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
  | { type: "SELECT_ZONE"; id: string | null };

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
      };

    case "MARK_HYDRATED":
      return state.hydrated ? state : { ...state, hydrated: true };

    case "SET_ROOM":
      return {
        ...state,
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
      };
      return {
        ...state,
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
        color: ZONE_COLOR_PALETTE[state.zones.length % ZONE_COLOR_PALETTE.length],
        name: `Zone ${state.zones.length + 1}`,
      };
      return {
        ...state,
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
        zones: state.zones.filter((z) => z.id !== action.id),
        selectedZoneId: state.selectedZoneId === action.id ? null : state.selectedZoneId,
      };

    case "REMOVE_SELECTED_ZONE":
      return state.selectedZoneId === null
        ? state
        : {
            ...state,
            zones: state.zones.filter((z) => z.id !== state.selectedZoneId),
            selectedZoneId: null,
          };

    case "SELECT_ZONE":
      return {
        ...state,
        selectedZoneId: action.id,
        selectedIds: action.id === null ? state.selectedIds : [],
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

  return {
    room: state.room,
    objects: state.objects,
    zones: state.zones,
    selectedIds: state.selectedIds,
    selectedZoneId: state.selectedZoneId,
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
  };
}

export type PlannerStore = ReturnType<typeof usePlannerStore>;
