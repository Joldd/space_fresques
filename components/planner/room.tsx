// components/planner/room.tsx
"use client";

import { Group, Line, Rect, Shape, Text } from "react-konva";
import type Konva from "konva";
import type { Room } from "@/lib/planner/types";
import { cmToPx } from "@/lib/planner/scale";
import { polygonBounds, tracePolygonPath } from "@/lib/planner/geometry";
import { roomFloorArea } from "@/lib/planner/rooms";
import { fitFontSize } from "@/lib/planner/fit-text";
import { DimensionLabel } from "./dimension-label";

type RoomProps = {
  room: Room;
  scale: number;
  origin: { x: number; y: number };
};

const GRID_STEP_CM = 100; // une ligne de repère par mètre

const OBSTACLE_FONT = { fontFamily: "Arial", fontStyle: "600", lineHeight: 1.1, minFontSize: 6, maxFontSize: 14 };
const OBSTACLE_PADDING_PX = 4;

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
  // contour arrondis compris (et non le polygone brut, qui passe par les
  // points de contrôle des arrondis) : c'est lui qui porte l'ombre ci-dessous
  const shadowPointsPx = roomFloorArea(room).outline.flatMap((p) => [cmToPx(p.x, scale), cmToPx(p.y, scale)]);

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
        points={shadowPointsPx}
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
      {/*
        obstacles fixes (escalier...) : purement décoratifs côté événements
        (listening={false}) — un clic dessus agit comme un clic sur le fond
        de salle ; c'est roomFloorArea qui empêche d'y poser des meubles
      */}
      {(room.obstacles ?? []).map((obstacle) => {
        const x = cmToPx(obstacle.x, scale);
        const y = cmToPx(obstacle.y, scale);
        const width = cmToPx(obstacle.widthCm, scale);
        const height = cmToPx(obstacle.heightCm, scale);
        const labelWidth = Math.max(width - OBSTACLE_PADDING_PX * 2, 0);
        const labelHeight = Math.max(height - OBSTACLE_PADDING_PX * 2, 0);
        const fontSize = fitFontSize(obstacle.label, labelWidth, labelHeight, OBSTACLE_FONT);
        return (
          <Group key={`${obstacle.label}-${obstacle.x}-${obstacle.y}`} listening={false}>
            <Rect x={x} y={y} width={width} height={height} fill="#E6DAC2" stroke="#A8956E" strokeWidth={1.5} />
            <Text
              x={x + OBSTACLE_PADDING_PX}
              y={y + OBSTACLE_PADDING_PX}
              width={labelWidth}
              height={labelHeight}
              text={obstacle.label}
              align="center"
              verticalAlign="middle"
              wrap="word"
              ellipsis
              fontSize={fontSize}
              fontFamily={OBSTACLE_FONT.fontFamily}
              fontStyle={OBSTACLE_FONT.fontStyle}
              lineHeight={OBSTACLE_FONT.lineHeight}
              fill="#7A6A4C"
            />
          </Group>
        );
      })}
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
