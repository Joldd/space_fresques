// components/planner/chair.tsx
"use client";

import { Circle } from "react-konva";
import type { ChairObject, Point, SceneObject } from "@/lib/planner/types";
import { cmToPx } from "@/lib/planner/scale";
import { useConstrainedDrag } from "@/lib/planner/use-constrained-drag";

type ChairProps = {
  chair: ChairObject;
  scale: number;
  origin: { x: number; y: number };
  roomPolygon: Point[];
  selected: boolean;
  getDragGroup: (id: string) => SceneObject[];
  onPointerDown: (id: string, additive: boolean) => void;
  onDragDelta: (dxCm: number, dyCm: number) => void;
};

export function Chair({
  chair,
  scale,
  origin,
  roomPolygon,
  selected,
  getDragGroup,
  onPointerDown,
  onDragDelta,
}: ChairProps) {
  const radiusPx = cmToPx(chair.diameterCm, scale) / 2;
  const x = origin.x + cmToPx(chair.x, scale);
  const y = origin.y + cmToPx(chair.y, scale);

  const { handleMouseDown, handleDragStart, handleDragMove, dragBoundFunc } = useConstrainedDrag({
    id: chair.id,
    scale,
    roomPolygon,
    getDragGroup,
    onPointerDown,
    onDragDelta,
  });

  return (
    <Circle
      x={x}
      y={y}
      radius={radiusPx}
      draggable
      dragBoundFunc={dragBoundFunc}
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
