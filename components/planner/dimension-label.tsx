// components/planner/dimension-label.tsx
"use client";

import { Group, Line, Text } from "react-konva";
import type { DimensionLabelSide, Point } from "@/lib/planner/types";

type DimensionLabelProps = {
  /** sommets mesurés, en px, dans le repère de la salle */
  from: Point;
  to: Point;
  side: DimensionLabelSide;
  label: string;
};

const LINE_OFFSET_PX = 14;
const TEXT_OFFSET_PX = 30;
const TICK_PX = 5;
const TEXT_BOX_WIDTH_PX = 90;
const FONT_SIZE_PX = 13;
const COLOR = "#8A7A5C";

/**
 * Cote technique (ligne + amorces + texte) mesurant le segment [from, to] du
 * contour de la salle, décalée hors du polygone du côté indiqué. Ne suppose
 * un segment horizontal ou vertical que pour le décalage — cohérent avec les
 * seuls segments actuellement cotés (murs droits de la salle Passerelle).
 */
export function DimensionLabel({ from, to, side, label }: DimensionLabelProps) {
  const isVertical = side === "left" || side === "right";
  const sign = side === "top" || side === "left" ? -1 : 1;

  const offsetPoint = (p: Point, offsetPx: number): Point =>
    isVertical ? { x: p.x + sign * offsetPx, y: p.y } : { x: p.x, y: p.y + sign * offsetPx };

  const lineFrom = offsetPoint(from, LINE_OFFSET_PX);
  const lineTo = offsetPoint(to, LINE_OFFSET_PX);
  const textCenter = offsetPoint(
    { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 },
    TEXT_OFFSET_PX,
  );

  function tick(p: Point) {
    const points = isVertical
      ? [p.x - TICK_PX, p.y, p.x + TICK_PX, p.y]
      : [p.x, p.y - TICK_PX, p.x, p.y + TICK_PX];
    return <Line points={points} stroke={COLOR} strokeWidth={1} />;
  }

  return (
    <Group listening={false}>
      <Line points={[lineFrom.x, lineFrom.y, lineTo.x, lineTo.y]} stroke={COLOR} strokeWidth={1} />
      {tick(lineFrom)}
      {tick(lineTo)}
      <Text
        text={label}
        fontSize={FONT_SIZE_PX}
        fill={COLOR}
        align="center"
        verticalAlign="middle"
        width={TEXT_BOX_WIDTH_PX}
        height={FONT_SIZE_PX + 4}
        offsetX={TEXT_BOX_WIDTH_PX / 2}
        offsetY={(FONT_SIZE_PX + 4) / 2}
        x={textCenter.x}
        y={textCenter.y}
        rotation={isVertical ? -90 : 0}
      />
    </Group>
  );
}
