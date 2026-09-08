// components/planner/planner-canvas.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Stage, Layer } from "react-konva";
import type Konva from "konva";
import { PlannerSideBar } from "./planner-sidebar";
import { Table } from "./table";
import { Chair } from "./chair";
import { Room } from "./room";
import { Zone } from "./zone";
import { ZonePanel } from "./zone-panel";
import { TablePanel } from "./table-panel";
import { ZoneLegend } from "./zone-legend";
import { SelectionRect } from "./selection-rect";
import { usePlannerStore } from "@/lib/planner/use-planner-store";
import { computeScale, roomOrigin } from "@/lib/planner/scale";
import { HEADER_HEIGHT_PX, SIDEBAR_BREAKPOINT_PX, SIDEBAR_WIDTH_PX } from "@/lib/planner/constants";
import { PASSERELLE_DISPLAY_NAME } from "@/lib/planner/rooms";
import { buildExportCanvas, downloadCanvasAsJpeg, downloadCanvasAsPdf } from "@/lib/planner/export";
import type { RectArea, SceneObject, TableObject } from "@/lib/planner/types";

/** "Rue intérieure Saint-Paul" -> "rue-interieure-saint-paul", pour les noms de fichier exportés */
function slugify(text: string): string {
  return (
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "plan"
  );
}

/** largeur estimée d'un menu contextuel (zone ou table), pour éviter qu'il ne déborde du canvas */
const PANEL_WIDTH_PX = 240;
const PANEL_MARGIN_PX = 10;

/** ancre un menu contextuel à droite de l'élément visé, ou à gauche si ça déborderait du canvas */
function computePanelPosition(
  leftPx: number,
  rightPx: number,
  topPx: number,
  stageWidthPx: number,
): { x: number; y: number } {
  const overflowsRight = rightPx + PANEL_MARGIN_PX + PANEL_WIDTH_PX > stageWidthPx;
  return {
    x: overflowsRight
      ? Math.max(leftPx - PANEL_MARGIN_PX - PANEL_WIDTH_PX, PANEL_MARGIN_PX)
      : rightPx + PANEL_MARGIN_PX,
    y: Math.max(topPx, PANEL_MARGIN_PX),
  };
}

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

function computeStageSize() {
  const sidebarDocked = window.innerWidth >= SIDEBAR_BREAKPOINT_PX;
  return {
    width: window.innerWidth - (sidebarDocked ? SIDEBAR_WIDTH_PX : 0),
    height: window.innerHeight - HEADER_HEIGHT_PX,
  };
}

export function PlannerCanvas() {
  const store = usePlannerStore();
  const {
    room,
    objects,
    zones,
    selectedIds,
    selectedZoneId,
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
  } = store;

  // en dessous de "md" la sidebar devient un tiroir superposé (voir
  // planner-sidebar.tsx) : elle ne prend alors plus de place dans la mise en
  // page, le canvas doit occuper toute la largeur plutôt que d'en soustraire
  // SIDEBAR_WIDTH_PX
  const [stageSize, setStageSize] = useState(() => computeStageSize());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const stageRef = useRef<Konva.Stage>(null);

  useEffect(() => {
    function handleResize() {
      setStageSize(computeStageSize());
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
      const ctrlOrCmd = e.ctrlKey || e.metaKey;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (selectedZoneId) removeSelectedZone();
        else removeSelected();
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        rotateSelectedTables();
      } else if (e.key === "Escape") {
        clearSelection();
      } else if (ctrlOrCmd && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        undo();
      } else if (ctrlOrCmd && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        copySelection();
      } else if (ctrlOrCmd && (e.key === "v" || e.key === "V")) {
        e.preventDefault();
        paste();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    removeSelected,
    rotateSelectedTables,
    clearSelection,
    removeSelectedZone,
    selectedZoneId,
    undo,
    copySelection,
    paste,
  ]);

  const selectedCount = selectedIds.length;
  const hasSelectedTable = objects.some(
    (obj) => obj.kind === "table" && selectedIds.includes(obj.id),
  );
  const selectedZone = zones.find((z) => z.id === selectedZoneId) ?? null;

  let zonePanelPos: { x: number; y: number } | null = null;
  if (selectedZone) {
    const zoneRightPx = origin.x + (selectedZone.x + selectedZone.widthCm) * scale;
    const zoneLeftPx = origin.x + selectedZone.x * scale;
    const zoneTopPx = origin.y + selectedZone.y * scale;
    zonePanelPos = computePanelPosition(zoneLeftPx, zoneRightPx, zoneTopPx, stageSize.width);
  }

  // menu contextuel d'une table seule sélectionnée (jamais pour un
  // multi-sélection, ni pour une chaise) — remplace alors la barre flottante
  // générique "N éléments sélectionnés"
  const singleSelectedTable: TableObject | undefined =
    selectedCount === 1
      ? (objects.find((o) => o.id === selectedIds[0] && o.kind === "table") as TableObject | undefined)
      : undefined;

  let tablePanelPos: { x: number; y: number } | null = null;
  if (singleSelectedTable) {
    const box = getObjectBoundsPx(singleSelectedTable, scale, origin);
    tablePanelPos = computePanelPosition(box.x, box.x + box.width, box.y, stageSize.width);
  }

  const roomLabel = room.kind === "passerelle" ? PASSERELLE_DISPLAY_NAME : "Plan de salle";
  const exportFilenameBase = `plan-${slugify(roomLabel)}`;

  const handleExportJpeg = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const canvas = buildExportCanvas(stage, room, zones, scale, origin, roomLabel);
    downloadCanvasAsJpeg(canvas, `${exportFilenameBase}.jpg`);
  }, [room, zones, scale, origin, roomLabel, exportFilenameBase]);

  const handleExportPdf = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const canvas = buildExportCanvas(stage, room, zones, scale, origin, roomLabel);
    downloadCanvasAsPdf(canvas, `${exportFilenameBase}.pdf`);
  }, [room, zones, scale, origin, roomLabel, exportFilenameBase]);

  return (
    <div className="flex h-[calc(100vh-56px)] bg-[#EFE7D6] dark:bg-[#1B1F1A]">
      <PlannerSideBar
        room={room}
        onSetRectangleRoom={setRectangleRoom}
        onSetPasserelleRoom={setPasserelleRoom}
        onAddTable={addTable}
        onAddChair={addChair}
        onAddZone={addZone}
        selectedCount={selectedCount}
        hasSelectedTable={hasSelectedTable}
        hasContextPanel={!!singleSelectedTable}
        onRotate={rotateSelectedTables}
        onDelete={removeSelected}
        onExportJpeg={handleExportJpeg}
        onExportPdf={handleExportPdf}
        open={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <div className="relative flex-1">
        {!isSidebarOpen && (
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Ouvrir les réglages"
            className="md:hidden fixed bottom-4 right-4 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-[#3F5A45] text-white text-xl shadow-lg"
          >
            ☰
          </button>
        )}
        <Stage
          ref={stageRef}
          width={stageSize.width}
          height={stageSize.height}
          onMouseDown={handleStageMouseDown}
          onMouseMove={handleStageMouseMove}
          onMouseUp={handleStageMouseUp}
        >
          <Layer>
            <Room room={room} scale={scale} origin={origin} />
            {zones.map((zone) => (
              <Zone
                key={zone.id}
                zone={zone}
                scale={scale}
                origin={origin}
                selected={zone.id === selectedZoneId}
                onSelect={selectZone}
                onChange={updateZone}
                onBeginChange={pushHistory}
              />
            ))}
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
                  onDragBegin={pushHistory}
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
                  onDragBegin={pushHistory}
                />
              ),
            )}
            {selectionArea && <SelectionRect area={selectionArea} />}
          </Layer>
        </Stage>

        <ZoneLegend zones={zones} />

        {selectedZone && zonePanelPos && (
          <ZonePanel
            key={selectedZone.id}
            zone={selectedZone}
            x={zonePanelPos.x}
            y={zonePanelPos.y}
            onRename={(name) => updateZone(selectedZone.id, { name })}
            onResize={(widthCm, heightCm) => updateZone(selectedZone.id, { widthCm, heightCm })}
            onRecolor={(color) => updateZone(selectedZone.id, { color })}
            onDelete={() => removeZone(selectedZone.id)}
            onClose={() => selectZone(null)}
            onBeginChange={pushHistory}
          />
        )}

        {singleSelectedTable && tablePanelPos && (
          <TablePanel
            key={singleSelectedTable.id}
            table={singleSelectedTable}
            x={tablePanelPos.x}
            y={tablePanelPos.y}
            onResize={(widthCm, depthCm) => updateTable(singleSelectedTable.id, { widthCm, depthCm })}
            onRecolor={(color) => updateTable(singleSelectedTable.id, { color })}
            onRotate={rotateSelectedTables}
            onDelete={removeSelected}
            onClose={clearSelection}
            onBeginChange={pushHistory}
          />
        )}

        {selectedCount > 0 && !singleSelectedTable && (
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
