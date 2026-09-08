// components/planner/room.tsx
"use client";

import { Group, Line, Shape, Text } from "react-konva";
import type Konva from "konva";
import type { Room } from "@/lib/planner/types";
import { cmToPx } from "@/lib/planner/scale";
import { polygonBounds, tracePolygonPath } from "@/lib/planner/geometry";
import { DimensionLabel } from "./dimension-label";

type RoomProps = {
  room: Room;
  scale: number;
  origin: { x: number; y: number };
};

const GRID_STEP_CM = 100; // une ligne de repère par mètre

/** 850 -> "8.5 m", 1200 -> "12 m" */
function formatMeters(cm: number): string {
  const meters = (cm / 100).toFixed(1).replace(/\.0$/, "");
  return `${meters} m`;
}

export function Room({ room, scale, origin }: RoomProps) {
  const bounds = polygonBounds(room.polygon);
  const widthPx = cmToPx(bounds.maxX - bounds.minX, scale);
  const heightPx = cmToPx(bounds.maxY - bounds.minY, scale);
  const pointsPx = room.polygon.map((p) => ({ x: cmToPx(p.x, scale), y: cmToPx(p.y, scale) }));
  const flatPointsPx = pointsPx.flatMap((p) => [p.x, p.y]);

  // découpe la grille à la forme exacte du contour de la salle (arrondis compris)
  function clipToRoom(ctx: Konva.Context) {
    tracePolygonPath(ctx, pointsPx, room.curvedVertices);
  }

  function drawRoomOutline(ctx: Konva.Context, shape: Konva.Shape) {
    tracePolygonPath(ctx, pointsPx, room.curvedVertices);
    ctx.fillStrokeShape(shape);
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
      {/*
        L'ombre portée est déposée par une forme Konva "native" (Line) séparée,
        posée sous le tracé visible, plutôt que par le Shape lui-même : un
        Shape à sceneFunc custom combiné à shadowBlur déclenche un bug de
        recomposition dans Chromium — après un resize du Stage ou la
        suppression d'un objet ailleurs sur le canvas, d'anciens pixels
        restent visibles jusqu'au prochain repaint sans rapport (survolé,
        redimensionné...), alors que le contenu réel du canvas est correct.
        Une Line native porte l'ombre sans ce problème ; le Shape au-dessus
        ne fait plus que dessiner le contour (arrondi compris), sans ombre.
      */}
      <Line
        points={flatPointsPx}
        closed
        fill="#F6F1E7"
        shadowColor="rgba(0,0,0,0.12)"
        shadowBlur={16}
        listening={false}
      />
      <Shape
        name="room-background"
        sceneFunc={drawRoomOutline}
        fill="#F6F1E7"
        stroke="#C9B99A"
        strokeWidth={2}
      />
      <Group clipFunc={clipToRoom}>
        {verticalLines}
        {horizontalLines}
      </Group>
      {room.dimensionLabels && room.dimensionLabels.length > 0 ? (
        // la salle est un polygone quelconque : une seule cote "largeur ×
        // hauteur" de la boîte englobante n'aurait pas de sens, on cote donc
        // individuellement les segments droits pertinents du contour
        room.dimensionLabels.map(({ fromIndex, toIndex, side }) => {
          const fromCm = room.polygon[fromIndex];
          const toCm = room.polygon[toIndex];
          if (!fromCm || !toCm) return null;
          const distanceCm = Math.hypot(toCm.x - fromCm.x, toCm.y - fromCm.y);
          return (
            <DimensionLabel
              key={`${fromIndex}-${toIndex}`}
              from={pointsPx[fromIndex]}
              to={pointsPx[toIndex]}
              side={side}
              label={formatMeters(distanceCm)}
            />
          );
        })
      ) : (
        <Text
          x={8}
          y={heightPx + 8}
          text={`${room.widthM} m × ${room.heightM} m`}
          fontSize={13}
          fill="#8A7A5C"
        />
      )}
    </Group>
  );
}
