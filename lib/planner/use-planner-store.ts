// lib/planner/use-planner-store.ts
"use client";

import { useCallback, useEffect, useReducer } from "react";
import type {
  ChairObject,
  RoomDimensions,
  Rotation,
  SceneObject,
  TableObject,
} from "./types";

const STORAGE_KEY = "space-fresques:planner";

export const DEFAULT_ROOM: RoomDimensions = { widthM: 8, heightM: 5 };
export const DEFAULT_TABLE = { widthCm: 140, depthCm: 70 };
export const DEFAULT_CHAIR = { diameterCm: 45 };

type State = {
  room: RoomDimensions;
  objects: SceneObject[];
  selectedIds: string[];
  /** true dès que la lecture du localStorage a été tentée (succès ou non) */
  hydrated: boolean;
};

type Action =
  | { type: "LOAD"; room: RoomDimensions; objects: SceneObject[] }
  | { type: "MARK_HYDRATED" }
  | { type: "SET_ROOM"; room: RoomDimensions }
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

/** décale chaque nouvel objet en cascade pour éviter qu'ils ne s'empilent tous au même endroit */
function spawnPosition(state: State): { x: number; y: number } {
  const step = 28; // cm
  const cascadeLength = 8;
  const offset = (state.objects.length % cascadeLength) * step;
  const roomWidthCm = state.room.widthM * 100;
  const roomHeightCm = state.room.heightM * 100;
  return {
    x: Math.min(roomWidthCm / 2 + offset, roomWidthCm - 20),
    y: Math.min(roomHeightCm / 2 + offset, roomHeightCm - 20),
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "LOAD":
      return {
        ...state,
        room: action.room,
        objects: action.objects,
        selectedIds: [],
        hydrated: true,
      };

    case "MARK_HYDRATED":
      return state.hydrated ? state : { ...state, hydrated: true };

    case "SET_ROOM":
      return { ...state, room: action.room };

    case "ADD_TABLE": {
      const { x, y } = spawnPosition(state);
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
      const { x, y } = spawnPosition(state);
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
      return {
        ...state,
        objects: state.objects.map((obj) =>
          selected.has(obj.id)
            ? { ...obj, x: obj.x + action.dxCm, y: obj.y + action.dyCm }
            : obj,
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
        const saved = JSON.parse(raw) as {
          room: RoomDimensions;
          objects: SceneObject[];
        };
        dispatch({ type: "LOAD", room: saved.room, objects: saved.objects });
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
    (room: RoomDimensions) => dispatch({ type: "SET_ROOM", room }),
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
