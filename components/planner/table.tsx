// components/planner/table.tsx
"use client";

import { Group, Rect } from "react-konva";
import type { Point, SceneObject, TableObject } from "@/lib/planner/types";
import { cmToPx } from "@/lib/planner/scale";
import { useConstrainedDrag } from "@/lib/planner/use-constrained-drag";

type TableProps = {
  table: TableObject;
  scale: number;
  origin: { x: number; y: number };
  roomPolygon: Point[];
  selected: boolean;
  getDragGroup: (id: string) => SceneObject[];
  onPointerDown: (id: string, additive: boolean) => void;
  onDragDelta: (dxCm: number, dyCm: number) => void;
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
}: TableProps) {
  const widthPx = cmToPx(table.widthCm, scale);
  const depthPx = cmToPx(table.depthCm, scale);
  const x = origin.x + cmToPx(table.x, scale);
  const y = origin.y + cmToPx(table.y, scale);

  const { handleMouseDown, handleDragStart, handleDragMove, dragBoundFunc } = useConstrainedDrag({
    id: table.id,
    scale,
    roomPolygon,
    getDragGroup,
    onPointerDown,
    onDragDelta,
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
    >
      <Rect
        x={-widthPx / 2}
        y={-depthPx / 2}
        width={widthPx}
        height={depthPx}
        fill="#D98E73"
        stroke={selected ? "#3F5A45" : "#B5714F"}
        strokeWidth={selected ? 3 : 1.5}
        cornerRadius={6}
        shadowColor="rgba(0,0,0,0.25)"
        shadowBlur={selected ? 10 : 4}
        shadowOffsetY={2}
      />
    </Group>
  );
}
