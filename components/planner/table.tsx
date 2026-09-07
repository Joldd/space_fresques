// components/planner/table.tsx
"use client";

import { useRef } from "react";
import { Group, Rect } from "react-konva";
import type Konva from "konva";
import type { TableObject } from "@/lib/planner/types";
import { cmToPx, pxToCm } from "@/lib/planner/scale";

type TableProps = {
  table: TableObject;
  scale: number;
  origin: { x: number; y: number };
  selected: boolean;
  onPointerDown: (id: string, additive: boolean) => void;
  onDragDelta: (dxCm: number, dyCm: number) => void;
};

export function Table({
  table,
  scale,
  origin,
  selected,
  onPointerDown,
  onDragDelta,
}: TableProps) {
  const widthPx = cmToPx(table.widthCm, scale);
  const depthPx = cmToPx(table.depthCm, scale);
  const x = origin.x + cmToPx(table.x, scale);
  const y = origin.y + cmToPx(table.y, scale);
  const lastPointPx = useRef({ x, y });

  function handleMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    const additive = e.evt.ctrlKey || e.evt.metaKey || e.evt.shiftKey;
    onPointerDown(table.id, additive);
  }

  function handleDragStart(e: Konva.KonvaEventObject<DragEvent>) {
    lastPointPx.current = { x: e.target.x(), y: e.target.y() };
  }

  function handleDragMove(e: Konva.KonvaEventObject<DragEvent>) {
    const newX = e.target.x();
    const newY = e.target.y();
    const dxPx = newX - lastPointPx.current.x;
    const dyPx = newY - lastPointPx.current.y;
    lastPointPx.current = { x: newX, y: newY };
    if (dxPx !== 0 || dyPx !== 0) {
      onDragDelta(pxToCm(dxPx, scale), pxToCm(dyPx, scale));
    }
  }

  return (
    <Group
      x={x}
      y={y}
      rotation={table.rotation}
      draggable
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
