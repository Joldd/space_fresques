// components/planner/planner-canvas.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Stage, Layer } from "react-konva";
import type Konva from "konva";
import { PlannerSideBar } from "./planner-sidebar";
import { Table } from "./table";
import { Chair } from "./chair";
import { Room } from "./room";
import { SelectionRect } from "./selection-rect";
import { usePlannerStore } from "@/lib/planner/use-planner-store";
import { computeScale, roomOrigin } from "@/lib/planner/scale";
import { HEADER_HEIGHT_PX, SIDEBAR_WIDTH_PX } from "@/lib/planner/constants";
import type { RectArea, SceneObject } from "@/lib/planner/types";

function isTypingInField(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    (el as HTMLElement).isContentEditable
  );
}

function normalizeRect(a: { x: number; y: number }, b: { x: number; y: number }): RectArea {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

function getObjectBoundsPx(
  obj: SceneObject,
  scale: number,
  origin: { x: number; y: number },
): RectArea {
  const cx = origin.x + obj.x * scale;
  const cy = origin.y + obj.y * scale;
  if (obj.kind === "chair") {
    const r = (obj.diameterCm / 2) * scale;
    return { x: cx - r, y: cy - r, width: r * 2, height: r * 2 };
  }
  const swapped = obj.rotation === 90 || obj.rotation === 270;
  const wCm = swapped ? obj.depthCm : obj.widthCm;
  const hCm = swapped ? obj.widthCm : obj.depthCm;
  const wPx = wCm * scale;
  const hPx = hCm * scale;
  return { x: cx - wPx / 2, y: cy - hPx / 2, width: wPx, height: hPx };
}

function rectsIntersect(a: RectArea, b: RectArea): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function PlannerCanvas() {
  const store = usePlannerStore();
  const {
    room,
    objects,
    selectedIds,
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
  } = store;

  const [stageSize, setStageSize] = useState(() => ({
    width: window.innerWidth - SIDEBAR_WIDTH_PX,
    height: window.innerHeight - HEADER_HEIGHT_PX,
  }));

  useEffect(() => {
    function handleResize() {
      setStageSize({
        width: window.innerWidth - SIDEBAR_WIDTH_PX,
        height: window.innerHeight - HEADER_HEIGHT_PX,
      });
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const scale = computeScale(room, stageSize);
  const origin = roomOrigin(room, stageSize, scale);

  // -- sélection par zone (rubber-band) --
  const dragSelectRef = useRef<{ start: { x: number; y: number }; additive: boolean } | null>(
    null,
  );
  const [selectionArea, setSelectionArea] = useState<RectArea | null>(null);

  const handleStageMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const stage = e.target.getStage();
      if (!stage) return;
      const isEmptyClick =
        e.target === stage ||
        (typeof e.target.name === "function" && e.target.name() === "room-background");
      if (!isEmptyClick) return;

      const pos = stage.getPointerPosition();
      if (!pos) return;
      const additive = e.evt.ctrlKey || e.evt.metaKey || e.evt.shiftKey;
      dragSelectRef.current = { start: pos, additive };
      setSelectionArea({ x: pos.x, y: pos.y, width: 0, height: 0 });
    },
    [],
  );

  const handleStageMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!dragSelectRef.current) return;
    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;
    setSelectionArea(normalizeRect(dragSelectRef.current.start, pos));
  }, []);

  const handleStageMouseUp = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const dragSelect = dragSelectRef.current;
      dragSelectRef.current = null;
      setSelectionArea(null);
      if (!dragSelect) return;

      // recalculé directement depuis le pointeur (l'état `selectionArea` peut
      // ne pas avoir été re-rendu à temps entre le dernier mousemove et ce mouseup)
      const stage = e.target.getStage();
      const pos = stage?.getPointerPosition();
      if (!pos) return;
      const area = normalizeRect(dragSelect.start, pos);

      const hasArea = area.width > 2 || area.height > 2;
      if (hasArea) {
        const ids = objects
          .filter((obj) => rectsIntersect(area, getObjectBoundsPx(obj, scale, origin)))
          .map((obj) => obj.id);
        selectRect(ids, dragSelect.additive);
      } else if (!dragSelect.additive) {
        clearSelection();
      }
    },
    [objects, scale, origin, selectRect, clearSelection],
  );

  // snapshot de "qui doit bouger avec qui" pendant un drag, résolu de façon
  // synchrone au mousedown (indépendant du re-render React qui suit le
  // dispatch de sélection, dont le timing n'est pas garanti avant le dragstart)
  const resolvedSelectionRef = useRef<string[]>(selectedIds);

  const handleObjectPointerDown = useCallback(
    (id: string, additive: boolean) => {
      const current = selectedIds;
      resolvedSelectionRef.current = additive
        ? current.includes(id)
          ? current.filter((x) => x !== id)
          : [...current, id]
        : current.includes(id)
          ? current
          : [id];

      if (additive) {
        select([id], true);
        return;
      }
      if (!current.includes(id)) {
        select([id], false);
      }
    },
    [select, selectedIds],
  );

  const getDragGroup = useCallback(
    (id: string): SceneObject[] => {
      const ids = resolvedSelectionRef.current.includes(id)
        ? resolvedSelectionRef.current
        : [id];
      const idSet = new Set(ids);
      return objects.filter((obj) => idSet.has(obj.id));
    },
    [objects],
  );

  const handleDragDelta = useCallback(
    (dxCm: number, dyCm: number) => moveSelected(dxCm, dyCm),
    [moveSelected],
  );

  // -- raccourcis clavier --
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isTypingInField()) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        removeSelected();
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        rotateSelectedTables();
      } else if (e.key === "Escape") {
        clearSelection();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [removeSelected, rotateSelectedTables, clearSelection]);

  const selectedCount = selectedIds.length;
  const hasSelectedTable = objects.some(
    (obj) => obj.kind === "table" && selectedIds.includes(obj.id),
  );

  return (
    <div className="flex h-[calc(100vh-56px)] bg-[#EFE7D6] dark:bg-[#1B1F1A]">
      <PlannerSideBar
        room={room}
        onSetRectangleRoom={setRectangleRoom}
        onSetPasserelleRoom={setPasserelleRoom}
        onAddTable={addTable}
        onAddChair={addChair}
        selectedCount={selectedCount}
        hasSelectedTable={hasSelectedTable}
        onRotate={rotateSelectedTables}
        onDelete={removeSelected}
      />
      <div className="relative flex-1">
        <Stage
          width={stageSize.width}
          height={stageSize.height}
          onMouseDown={handleStageMouseDown}
          onMouseMove={handleStageMouseMove}
          onMouseUp={handleStageMouseUp}
        >
          <Layer>
            <Room room={room} scale={scale} origin={origin} />
            {objects.map((obj) =>
              obj.kind === "table" ? (
                <Table
                  key={obj.id}
                  table={obj}
                  scale={scale}
                  origin={origin}
                  roomPolygon={room.polygon}
                  selected={selectedIds.includes(obj.id)}
                  getDragGroup={getDragGroup}
                  onPointerDown={handleObjectPointerDown}
                  onDragDelta={handleDragDelta}
                />
              ) : (
                <Chair
                  key={obj.id}
                  chair={obj}
                  scale={scale}
                  origin={origin}
                  roomPolygon={room.polygon}
                  selected={selectedIds.includes(obj.id)}
                  getDragGroup={getDragGroup}
                  onPointerDown={handleObjectPointerDown}
                  onDragDelta={handleDragDelta}
                />
              ),
            )}
            {selectionArea && <SelectionRect area={selectionArea} />}
          </Layer>
        </Stage>

        {selectedCount > 0 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full border border-black/10 bg-white/90 dark:bg-[#232823]/90 dark:border-white/10 px-3 py-2 shadow-lg backdrop-blur">
            <span className="px-2 text-sm text-[#3F5A45] dark:text-[#B9D3BC]">
              {selectedCount} élément{selectedCount > 1 ? "s" : ""} sélectionné
              {selectedCount > 1 ? "s" : ""}
            </span>
            {hasSelectedTable && (
              <button
                onClick={rotateSelectedTables}
                className="rounded-full bg-[#7A9E7E] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#6b8f6f] transition-colors"
                title="Pivoter de 90° (touche R)"
              >
                ↻ Pivoter
              </button>
            )}
            <button
              onClick={removeSelected}
              className="rounded-full bg-[#D9765F] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#c76650] transition-colors"
              title="Supprimer (touche Suppr)"
            >
              🗑 Supprimer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
