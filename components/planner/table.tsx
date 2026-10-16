// components/planner/table.tsx
"use client";

import { memo, useMemo } from "react";
import { Group, Rect, Text } from "react-konva";
import type { SceneObject, TableObject } from "@/lib/planner/types";
import { cmToPx } from "@/lib/planner/scale";
import { useConstrainedDrag } from "@/lib/planner/use-constrained-drag";
import { setCanvasCursor } from "@/lib/planner/cursor";
import { DEFAULT_TABLE_COLOR, darken } from "@/lib/planner/color";
import { fitFontSize } from "@/lib/planner/fit-text";

const LABEL_FONT_FAMILY = "Arial";
const LABEL_FONT_STYLE = "600";
const LABEL_LINE_HEIGHT = 1.1;
const LABEL_MIN_FONT_SIZE = 6;
const LABEL_MAX_FONT_SIZE = 160;

type TableProps = {
  table: TableObject;
  scale: number;
  origin: { x: number; y: number };
  selected: boolean;
  getDragGroup: (id: string) => SceneObject[];
  onPointerDown: (id: string, additive: boolean) => void;
  onDragDelta: (dxCm: number, dyCm: number) => void;
  /** appelé une seule fois au début d'un drag — empile l'état pour Ctrl+Z */
  onDragBegin: () => void;
};

export const Table = memo(function Table({
  table,
  scale,
  origin,
  selected,
  getDragGroup,
  onPointerDown,
  onDragDelta,
  onDragBegin,
}: TableProps) {
  const widthPx = cmToPx(table.widthCm, scale);
  const depthPx = cmToPx(table.depthCm, scale);
  const x = origin.x + cmToPx(table.x, scale);
  const y = origin.y + cmToPx(table.y, scale);
  const color = table.color ?? DEFAULT_TABLE_COLOR;
  // le nom reste horizontal quelle que soit la rotation : on contre-pivote
  // le texte, et sa boîte disponible est alors celle de la table à l'écran
  // (largeur et profondeur inversées sur un quart de tour)
  const quarterTurned = table.rotation === 90 || table.rotation === 270;
  const boxWidthPx = quarterTurned ? depthPx : widthPx;
  const boxHeightPx = quarterTurned ? widthPx : depthPx;
  const labelPaddingPx = Math.min(8, Math.min(boxWidthPx, boxHeightPx) * 0.08);
  const labelWidthPx = Math.max(boxWidthPx - labelPaddingPx * 2, 0);
  const labelHeightPx = Math.max(boxHeightPx - labelPaddingPx * 2, 0);
  const labelFontSize = useMemo(
    () =>
      table.name
        ? fitFontSize(table.name, labelWidthPx, labelHeightPx, {
            fontFamily: LABEL_FONT_FAMILY,
            fontStyle: LABEL_FONT_STYLE,
            lineHeight: LABEL_LINE_HEIGHT,
            minFontSize: LABEL_MIN_FONT_SIZE,
            maxFontSize: LABEL_MAX_FONT_SIZE,
          })
        : LABEL_MIN_FONT_SIZE,
    [table.name, labelWidthPx, labelHeightPx],
  );

  const { handleMouseDown, handleDragStart, handleDragMove, dragBoundFunc } = useConstrainedDrag({
    id: table.id,
    scale,
    getDragGroup,
    onPointerDown,
    onDragDelta,
    onDragBegin,
  });

  return (
    <Group
      x={x}
      y={y}
      rotation={table.rotation}
      draggable
      dragBoundFunc={dragBoundFunc}
      onMouseDown={handleMouseDown}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onMouseEnter={(e) => setCanvasCursor(e, "pointer")}
      onMouseLeave={(e) => setCanvasCursor(e, "default")}
    >
      <Rect
        x={-widthPx / 2}
        y={-depthPx / 2}
        width={widthPx}
        height={depthPx}
        fill={color}
        stroke={selected ? "#3F5A45" : darken(color)}
        strokeWidth={selected ? 3 : 1.5}
        cornerRadius={6}
        shadowColor="rgba(0,0,0,0.25)"
        shadowBlur={selected ? 10 : 4}
        shadowOffsetY={2}
      />
      {table.name && (
        <Text
          text={table.name}
          rotation={-table.rotation}
          x={0}
          y={0}
          width={labelWidthPx}
          height={labelHeightPx}
          offsetX={labelWidthPx / 2}
          offsetY={labelHeightPx / 2}
          align="center"
          verticalAlign="middle"
          wrap="word"
          ellipsis
          fontSize={labelFontSize}
          fontFamily={LABEL_FONT_FAMILY}
          fontStyle={LABEL_FONT_STYLE}
          lineHeight={LABEL_LINE_HEIGHT}
          fill="#ffffff"
          listening={false}
        />
      )}
    </Group>
  );
});
