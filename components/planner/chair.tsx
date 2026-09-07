// components/planner/chair.tsx
"use client";

import { useRef } from "react";
import { Circle } from "react-konva";
import type Konva from "konva";
import type { ChairObject } from "@/lib/planner/types";
import { cmToPx, pxToCm } from "@/lib/planner/scale";

type ChairProps = {
  chair: ChairObject;
  scale: number;
  origin: { x: number; y: number };
  selected: boolean;
  onPointerDown: (id: string, additive: boolean) => void;
  onDragDelta: (dxCm: number, dyCm: number) => void;
};

export function Chair({
  chair,
  scale,
  origin,
  selected,
  onPointerDown,
  onDragDelta,
}: ChairProps) {
  const radiusPx = cmToPx(chair.diameterCm, scale) / 2;
  const x = origin.x + cmToPx(chair.x, scale);
  const y = origin.y + cmToPx(chair.y, scale);
  const lastPointPx = useRef({ x, y });

  function handleMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    const additive = e.evt.ctrlKey || e.evt.metaKey || e.evt.shiftKey;
    onPointerDown(chair.id, additive);
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
    <Circle
      x={x}
      y={y}
      radius={radiusPx}
      draggable
      fill="#7A9E7E"
      stroke={selected ? "#3F5A45" : "#5C8060"}
      strokeWidth={selected ? 3 : 1.5}
      shadowColor="rgba(0,0,0,0.25)"
      shadowBlur={selected ? 10 : 4}
      shadowOffsetY={2}
      onMouseDown={handleMouseDown}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
    />
  );
}
