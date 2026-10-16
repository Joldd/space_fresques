// components/planner/room.tsx
"use client";

import { memo } from "react";
import { Group, Line, Rect, Shape, Text } from "react-konva";
import type Konva from "konva";
import type { Room as RoomData } from "@/lib/planner/types";
import { cmToPx } from "@/lib/planner/scale";
import { polygonBounds, tracePolygonPath } from "@/lib/planner/geometry";
import { ROOM_GAP_CM, roomFloorArea } from "@/lib/planner/rooms";
import { fitFontSize } from "@/lib/planner/fit-text";

type RoomProps = {
  room: RoomData;
  scale: number;
  /** origine du repère de la salle dans le Stage, en px */
  origin: { x: number; y: number };
  /** haut du titre, en px, relatif à `origin` (commun à toutes les salles, pour les aligner) */
  titleY: number;
};

const GRID_STEP_CM = 100; // une ligne de repère par mètre

const OBSTACLE_FONT = { fontFamily: "Arial", fontStyle: "600", lineHeight: 1.1, minFontSize: 6, maxFontSize: 14 };
const OBSTACLE_PADDING_PX = 4;

const PARTITION_COLOR = "#D4A93C";
const PARTITION_LABEL_GAP_PX = 6;
const PARTITION_LABEL_BOX_WIDTH_PX = 160;

const TITLE_FONT_SIZE_PX = 20;
/** part de l'écart entre deux salles que le titre peut occuper de chaque côté de la sienne */
const TITLE_GAP_SHARE = 0.45;

/** espace insécable : Konva ne revient à la ligne que sur les espaces normales */
const NBSP = " ";

/** 65.5 -> "65,5 m", 14 -> "14 m", 14.25 -> "14,25 m" */
function formatMeters(m: number): string {
  return `${m.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}${NBSP}m`;
}

/**
 * Salle (contour, quadrillage, obstacles, cloisons, titre) : purement
 * décorative, sur une couche Konva à part qui n'écoute pas les événements.
 * Mémoïsée — avec des props stables (voir planner-canvas.tsx), elle n'est
 * pas re-rendue pendant un drag, et sa couche n'est donc pas redessinée.
 */
export const Room = memo(function Room({ room, scale, origin, titleY }: RoomProps) {
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

  // le titre déborde de la largeur de sa salle jusqu'à près de la moitié de
  // l'écart avec la voisine (sans jamais chevaucher son titre), puis passe
  // sur deux lignes : les titres sont sur une même ligne, côte à côte
  const titleBoxWidthPx = widthPx + 2 * TITLE_GAP_SHARE * cmToPx(ROOM_GAP_CM, scale);

  // quadrillage tracé d'un seul bloc (une forme plutôt qu'une centaine de
  // lignes Konva distinctes), découpé ensuite au contour par clipToRoom
  function drawGrid(ctx: Konva.Context, shape: Konva.Shape) {
    ctx.beginPath();
    for (let cm = Math.ceil(bounds.minX / GRID_STEP_CM) * GRID_STEP_CM; cm < bounds.maxX; cm += GRID_STEP_CM) {
      const px = cmToPx(cm, scale);
      ctx.moveTo(px, 0);
      ctx.lineTo(px, heightPx);
    }
    for (let cm = Math.ceil(bounds.minY / GRID_STEP_CM) * GRID_STEP_CM; cm < bounds.maxY; cm += GRID_STEP_CM) {
      const px = cmToPx(cm, scale);
      ctx.moveTo(0, px);
      ctx.lineTo(widthPx, px);
    }
    ctx.strokeShape(shape);
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
      <Shape sceneFunc={drawRoomOutline} fill="#F6F1E7" stroke="#C9B99A" strokeWidth={2} />
      <Group clipFunc={clipToRoom}>
        <Shape sceneFunc={drawGrid} stroke="#E4D9C4" strokeWidth={1} />
      </Group>
      {/*
        cloisons (cloison mobile...) : simple repère visuel en pointillés,
        sans effet sur la pose des meubles — une cloison mobile peut être
        ouverte le jour de l'événement
      */}
      {(room.partitions ?? []).map(({ label, from, to }) => {
        const fromPx = { x: cmToPx(from.x, scale), y: cmToPx(from.y, scale) };
        const toPx = { x: cmToPx(to.x, scale), y: cmToPx(to.y, scale) };
        const centerX = (fromPx.x + toPx.x) / 2;
        const centerY = (fromPx.y + toPx.y) / 2;
        return (
          <Group key={`${label}-${from.x}-${from.y}`} listening={false}>
            <Line
              points={[fromPx.x, fromPx.y, toPx.x, toPx.y]}
              stroke={PARTITION_COLOR}
              strokeWidth={3}
              dash={[6, 5]}
            />
            <Text
              x={centerX}
              y={centerY + PARTITION_LABEL_GAP_PX}
              width={PARTITION_LABEL_BOX_WIDTH_PX}
              offsetX={PARTITION_LABEL_BOX_WIDTH_PX / 2}
              text={label}
              align="center"
              fontSize={12}
              fontFamily="Arial"
              fontStyle="600"
              fill="#7A6A4C"
            />
          </Group>
        );
      })}
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
      {/*
        nom de la salle et ses dimensions, en titre sous le plan — les
        dimensions sont insécables : si le titre ne tient pas sur une ligne,
        il se coupe entre le nom et la parenthèse, jamais au milieu de celle-ci
      */}
      <Text
        x={cmToPx(bounds.minX, scale) + widthPx / 2}
        y={titleY}
        width={titleBoxWidthPx}
        offsetX={titleBoxWidthPx / 2}
        text={`${room.name} (${formatMeters(room.lengthM)}${NBSP}×${NBSP}${formatMeters(room.widthM)})`}
        align="center"
        wrap="word"
        lineHeight={1.2}
        fontSize={TITLE_FONT_SIZE_PX}
        fontFamily="Arial"
        fontStyle="bold"
        // ton moyen : le canvas ne suit pas le thème, il doit rester lisible
        // sur le fond clair comme sur le fond sombre (et sur l'export)
        fill="#5E7F63"
        listening={false}
      />
    </Group>
  );
});
