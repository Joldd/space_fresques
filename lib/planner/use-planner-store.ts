// lib/planner/use-planner-store.ts
"use client";

import { useCallback, useEffect, useReducer } from "react";
import type { ChairObject, Room, Rotation, SceneObject, TableObject } from "./types";
import { PASSERELLE_ROOM, isValidRoom, makeRectangleRoom } from "./rooms";
import { clampGroupDelta, clampObjectPosition, polygonBounds } from "./geometry";

const STORAGE_KEY = "space-fresques:planner";

export const DEFAULT_ROOM: Room = PASSERELLE_ROOM;
export const DEFAULT_TABLE = { widthCm: 200, depthCm: 300 };
export const DEFAULT_CHAIR = { diameterCm: 80 };

type State = {
  room: Room;
  objects: SceneObject[];
  selectedIds: string[];
  /** true dès que la lecture du localStorage a été tentée (succès ou non) */
  hydrated: boolean;
};

type Action =
  | { type: "LOAD"; room: Room; objects: SceneObject[] }
  | { type: "MARK_HYDRATED" }
  | { type: "SET_ROOM"; room: Room }
  | { type: "ADD_TABLE"; widthCm: number; depthCm: number }
  | { type: "ADD_CHAIR"; diameterCm: number }
  | { type: "REMOVE_SELECTED" }
  | { type: "MOVE_SELECTED"; dxCm: number; dyCm: number }
  | { type: "ROTATE_SELECTED_TABLES" }
  | { type: "SELECT"; ids: string[]; additive: boolean }
  | { type: "SELECT_RECT"; ids: string[]; additive: boolean }
  | { type: "CLEAR_SELECTION" };

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

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "LOAD":
      return {
        ...state,
        room: action.room,
        objects: clampAllObjects(action.objects, action.room),
        selectedIds: [],
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
      };

    case "SELECT_RECT":
      return {
        ...state,
        selectedIds: action.additive
          ? mergeSelection(state.selectedIds, action.ids)
          : action.ids,
      };

    case "CLEAR_SELECTION":
      return state.selectedIds.length === 0
        ? state
        : { ...state, selectedIds: [] };

    default:
      return state;
  }
}

function initialState(): State {
  return { room: DEFAULT_ROOM, objects: [], selectedIds: [], hydrated: false };
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
        const saved = JSON.parse(raw) as { room: unknown; objects: SceneObject[] };
        const room = isValidRoom(saved.room) ? saved.room : DEFAULT_ROOM;
        dispatch({ type: "LOAD", room, objects: saved.objects ?? [] });
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
        JSON.stringify({ room: state.room, objects: state.objects }),
      );
    } catch {
      // quota dépassé ou stockage désactivé : on ignore
    }
  }, [state.hydrated, state.room, state.objects]);

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

  return {
    room: state.room,
    objects: state.objects,
    selectedIds: state.selectedIds,
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
  };
}

export type PlannerStore = ReturnType<typeof usePlannerStore>;
