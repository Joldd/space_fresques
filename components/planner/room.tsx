// components/planner/room.tsx
"use client";

import { Group, Line, Text } from "react-konva";
import type Konva from "konva";
import type { Room } from "@/lib/planner/types";
import { cmToPx } from "@/lib/planner/scale";
import { polygonBounds } from "@/lib/planner/geometry";

type RoomProps = {
  room: Room;
  scale: number;
  origin: { x: number; y: number };
};

const GRID_STEP_CM = 100; // une ligne de repère par mètre

export function Room({ room, scale, origin }: RoomProps) {
  const bounds = polygonBounds(room.polygon);
  const points = room.polygon.flatMap((p) => [cmToPx(p.x, scale), cmToPx(p.y, scale)]);
  const widthPx = cmToPx(bounds.maxX - bounds.minX, scale);
  const heightPx = cmToPx(bounds.maxY - bounds.minY, scale);

  // découpe la grille à la forme exacte du contour de la salle
  function clipToRoom(ctx: Konva.Context) {
    ctx.beginPath();
    room.polygon.forEach((p, i) => {
      const x = cmToPx(p.x, scale);
      const y = cmToPx(p.y, scale);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
  }

  const verticalLines = [];
  for (let cm = Math.ceil(bounds.minX / GRID_STEP_CM) * GRID_STEP_CM; cm < bounds.maxX; cm += GRID_STEP_CM) {
    const px = cmToPx(cm, scale);
    verticalLines.push(
      <Line key={`v-${cm}`} points={[px, 0, px, heightPx]} stroke="#E4D9C4" strokeWidth={1} />,
    );
  }

  const horizontalLines = [];
  for (let cm = Math.ceil(bounds.minY / GRID_STEP_CM) * GRID_STEP_CM; cm < bounds.maxY; cm += GRID_STEP_CM) {
    const px = cmToPx(cm, scale);
    horizontalLines.push(
      <Line key={`h-${cm}`} points={[0, px, widthPx, px]} stroke="#E4D9C4" strokeWidth={1} />,
    );
  }

  return (
    <Group x={origin.x} y={origin.y}>
      <Line
        name="room-background"
        points={points}
        closed
        fill="#F6F1E7"
        stroke="#C9B99A"
        strokeWidth={2}
        shadowColor="rgba(0,0,0,0.12)"
        shadowBlur={16}
      />
      <Group clipFunc={clipToRoom}>
        {verticalLines}
        {horizontalLines}
      </Group>
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
