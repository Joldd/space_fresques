// components/planner/planner-canvas.tsx
"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { PADDING_PX, cmToPx, computeScale, pxToCm, roomOrigin } from "@/lib/planner/scale";
import { polygonBounds } from "@/lib/planner/geometry";
import { HEADER_HEIGHT_PX, SIDEBAR_BREAKPOINT_PX, SIDEBAR_WIDTH_PX } from "@/lib/planner/constants";
import { PASSERELLE_DISPLAY_NAME } from "@/lib/planner/rooms";
import { buildExportCanvas, downloadCanvasAsJpeg, downloadCanvasAsPdf } from "@/lib/planner/export";
import type { RectArea, SceneObject, TableObject } from "@/lib/planner/types";

/** zoom manuel (Ctrl + molette) : 1 = vue ajustée à l'écran (comportement d'origine), jamais moins */
const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
const ZOOM_WHEEL_SENSITIVITY = 0.0015;
/** facteur appliqué à chaque clic sur les boutons +/- */
const ZOOM_BUTTON_FACTOR = 1.25;

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

/** ancre un menu contextuel à droite de l'élément visé, ou à gauche si ça déborderait du contenu */
function computePanelPosition(
  leftPx: number,
  rightPx: number,
  topPx: number,
  contentWidthPx: number,
): { x: number; y: number } {
  const overflowsRight = rightPx + PANEL_MARGIN_PX + PANEL_WIDTH_PX > contentWidthPx;
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

  // -- zoom (Ctrl + molette) et défilement --
  // stageSize reste la taille "ajustée à l'écran" (zoom 1x) ; le contenu
  // (Stage + panneaux) grandit avec le zoom dans un conteneur `overflow:
  // auto`, qui fournit gratuitement les barres de scroll et le défilement
  // molette (vertical) / Maj+molette (horizontal, comportement natif du
  // navigateur sur un conteneur scrollable).
  const [zoomLevel, setZoomLevel] = useState(1);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pendingZoomAnchorRef = useRef<{
    clientX: number;
    clientY: number;
    roomCm: { x: number; y: number };
  } | null>(null);

  const fitScale = computeScale(room, stageSize);
  const scale = fitScale * zoomLevel;
  const roomBoundsCm = polygonBounds(room.polygon);
  const roomWidthPx = (roomBoundsCm.maxX - roomBoundsCm.minX) * scale;
  const roomHeightPx = (roomBoundsCm.maxY - roomBoundsCm.minY) * scale;
  const contentWidth = Math.max(stageSize.width, roomWidthPx + PADDING_PX * 2);
  const contentHeight = Math.max(stageSize.height, roomHeightPx + PADDING_PX * 2);
  const origin = roomOrigin(room, { width: contentWidth, height: contentHeight }, scale);

  // applique un facteur de zoom en gardant le point (clientX, clientY) fixe à
  // l'écran — utilisé aussi bien par Ctrl+molette (point sous le curseur)
  // que par les boutons +/- (centre du viewport visible)
  const zoomAt = useCallback(
    (clientX: number, clientY: number, factor: number) => {
      const container = scrollContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const contentX = clientX - rect.left + container.scrollLeft;
      const contentY = clientY - rect.top + container.scrollTop;
      const roomCm = {
        x: pxToCm(contentX - origin.x, scale),
        y: pxToCm(contentY - origin.y, scale),
      };
      setZoomLevel((z) => {
        const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z * factor));
        if (next !== z) pendingZoomAnchorRef.current = { clientX, clientY, roomCm };
        return next;
      });
    },
    [origin, scale],
  );

  // boutons +/- : zoome centré sur le milieu de la partie visible du plan
  const zoomByButton = useCallback(
    (factor: number) => {
      const container = scrollContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      zoomAt(rect.left + container.clientWidth / 2, rect.top + container.clientHeight / 2, factor);
    },
    [zoomAt],
  );
  const handleZoomIn = useCallback(() => zoomByButton(ZOOM_BUTTON_FACTOR), [zoomByButton]);
  const handleZoomOut = useCallback(() => zoomByButton(1 / ZOOM_BUTTON_FACTOR), [zoomByButton]);

  // Ctrl + molette (ou pincement trackpad, reporté par le navigateur comme un
  // wheel avec ctrlKey) zoome sur le plan, ancré sous le curseur, plutôt que
  // de zoomer la page — écouteur natif (pas onWheel) pour garantir que
  // preventDefault() bloque bien le zoom navigateur.
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    function handleWheel(e: WheelEvent) {
      if (!e.ctrlKey) return; // molette normale / Maj+molette : défilement natif du conteneur
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * ZOOM_WHEEL_SENSITIVITY));
    }

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [zoomAt]);

  // une fois le zoom (et donc scale/origin) recalculé, replace le point visé
  // sous le curseur — avant peinture, pour ne pas laisser voir le saut
  useLayoutEffect(() => {
    const anchor = pendingZoomAnchorRef.current;
    const container = scrollContainerRef.current;
    if (!anchor || !container) return;
    pendingZoomAnchorRef.current = null;

    const rect = container.getBoundingClientRect();
    const newContentX = origin.x + cmToPx(anchor.roomCm.x, scale);
    const newContentY = origin.y + cmToPx(anchor.roomCm.y, scale);
    container.scrollLeft = newContentX - (anchor.clientX - rect.left);
    container.scrollTop = newContentY - (anchor.clientY - rect.top);
  }, [scale, origin]);

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
    zonePanelPos = computePanelPosition(zoneLeftPx, zoneRightPx, zoneTopPx, contentWidth);
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
    tablePanelPos = computePanelPosition(box.x, box.x + box.width, box.y, contentWidth);
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
        <div className="absolute top-4 left-4 z-20 flex items-center gap-1 rounded-full border border-black/10 bg-white/90 dark:bg-[#232823]/90 dark:border-white/10 p-1 shadow-lg backdrop-blur">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={zoomLevel <= ZOOM_MIN}
            aria-label="Dézoomer"
            title="Dézoomer"
            className="flex h-8 w-8 items-center justify-center rounded-full text-lg font-medium text-[#3F5A45] dark:text-[#B9D3BC] hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            −
          </button>
          <span className="w-10 text-center text-xs font-medium text-[#4A4636] dark:text-[#D8D2BE] tabular-nums">
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={zoomLevel >= ZOOM_MAX}
            aria-label="Zoomer"
            title="Zoomer"
            className="flex h-8 w-8 items-center justify-center rounded-full text-lg font-medium text-[#3F5A45] dark:text-[#B9D3BC] hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            +
          </button>
        </div>
        <div ref={scrollContainerRef} className="absolute inset-0 overflow-auto">
          <Stage
            ref={stageRef}
            width={contentWidth}
            height={contentHeight}
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
        </div>

        <ZoneLegend zones={zones} />

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
