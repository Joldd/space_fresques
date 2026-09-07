// components/planner/room.tsx
"use client";

import { Group, Line, Rect, Text } from "react-konva";
import type { RoomDimensions } from "@/lib/planner/types";
import { cmToPx } from "@/lib/planner/scale";

type RoomProps = {
  room: RoomDimensions;
  scale: number;
  origin: { x: number; y: number };
};

const GRID_STEP_CM = 100; // une ligne de repère par mètre

export function Room({ room, scale, origin }: RoomProps) {
  const widthPx = cmToPx(room.widthM * 100, scale);
  const heightPx = cmToPx(room.heightM * 100, scale);

  const verticalLines = [];
  for (let cm = GRID_STEP_CM; cm < room.widthM * 100; cm += GRID_STEP_CM) {
    const px = cmToPx(cm, scale);
    verticalLines.push(
      <Line
        key={`v-${cm}`}
        points={[px, 0, px, heightPx]}
        stroke="#E4D9C4"
        strokeWidth={1}
      />,
    );
  }

  const horizontalLines = [];
  for (let cm = GRID_STEP_CM; cm < room.heightM * 100; cm += GRID_STEP_CM) {
    const px = cmToPx(cm, scale);
    horizontalLines.push(
      <Line
        key={`h-${cm}`}
        points={[0, px, widthPx, px]}
        stroke="#E4D9C4"
        strokeWidth={1}
      />,
    );
  }

  return (
    <Group x={origin.x} y={origin.y}>
      <Rect
        name="room-background"
        x={0}
        y={0}
        width={widthPx}
        height={heightPx}
        fill="#F6F1E7"
        stroke="#C9B99A"
        strokeWidth={2}
        cornerRadius={10}
        shadowColor="rgba(0,0,0,0.12)"
        shadowBlur={16}
      />
      {verticalLines}
      {horizontalLines}
      <Text
        x={8}
        y={heightPx + 8}
        text={`${room.widthM} m × ${room.heightM} m`}
        fontSize={13}
        fill="#8A7A5C"
      />
    </Group>
  );
}
