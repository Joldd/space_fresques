// components/planner/selection-rect.tsx
"use client";

import { Rect } from "react-konva";
import type { RectArea } from "@/lib/planner/types";

export function SelectionRect({ area }: { area: RectArea }) {
  return (
    <Rect
      x={area.x}
      y={area.y}
      width={area.width}
      height={area.height}
      fill="rgba(63, 90, 69, 0.12)"
      stroke="#3F5A45"
      strokeWidth={1}
      dash={[4, 4]}
      listening={false}
    />
  );
}
