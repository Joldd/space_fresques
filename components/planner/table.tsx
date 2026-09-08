// components/planner/table.tsx
"use client";

import { Group, Rect } from "react-konva";
import type { Point, SceneObject, TableObject } from "@/lib/planner/types";
import { cmToPx } from "@/lib/planner/scale";
import { useConstrainedDrag } from "@/lib/planner/use-constrained-drag";
import { setCanvasCursor } from "@/lib/planner/cursor";
import { DEFAULT_TABLE_COLOR, darken } from "@/lib/planner/color";

type TableProps = {
  table: TableObject;
  scale: number;
  origin: { x: number; y: number };
  roomPolygon: Point[];
  selected: boolean;
  getDragGroup: (id: string) => SceneObject[];
  onPointerDown: (id: string, additive: boolean) => void;
  onDragDelta: (dxCm: number, dyCm: number) => void;
  /** appelé une seule fois au début d'un drag — empile l'état pour Ctrl+Z */
  onDragBegin: () => void;
};

export function Table({
  table,
  scale,
  origin,
  roomPolygon,
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

  const { handleMouseDown, handleDragStart, handleDragMove, dragBoundFunc } = useConstrainedDrag({
    id: table.id,
    scale,
    roomPolygon,
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
    </Group>
  );
}
