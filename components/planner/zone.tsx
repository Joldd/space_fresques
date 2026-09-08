// components/planner/zone.tsx
"use client";

import { useEffect, useRef } from "react";
import { Rect, Transformer } from "react-konva";
import type Konva from "konva";
import type { ZoneObject } from "@/lib/planner/types";
import { cmToPx, pxToCm } from "@/lib/planner/scale";
import { MIN_ZONE_SIZE_CM } from "@/lib/planner/zones";
import { setCanvasCursor } from "@/lib/planner/cursor";
import { withAlpha } from "@/lib/planner/color";

type ZonePatch = Partial<Pick<ZoneObject, "x" | "y" | "widthCm" | "heightCm">>;

type ZoneProps = {
  zone: ZoneObject;
  scale: number;
  origin: { x: number; y: number };
  selected: boolean;
  onSelect: (id: string) => void;
  onChange: (id: string, patch: ZonePatch) => void;
};

/**
 * Zone rectangulaire étirable posée librement sur le plan (non contrainte
 * par le contour de la salle, contrairement aux tables/chaises) : couleur
 * pleine mais semi-transparente pour laisser voir ce qu'il y a derrière.
 */
export function Zone({ zone, scale, origin, selected, onSelect, onChange }: ZoneProps) {
  const rectRef = useRef<Konva.Rect>(null);
  const trRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    if (selected && trRef.current && rectRef.current) {
      trRef.current.nodes([rectRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [selected]);

  const x = origin.x + cmToPx(zone.x, scale);
  const y = origin.y + cmToPx(zone.y, scale);
  const width = cmToPx(zone.widthCm, scale);
  const height = cmToPx(zone.heightCm, scale);
  const minPx = cmToPx(MIN_ZONE_SIZE_CM, scale);

  return (
    <>
      <Rect
        ref={rectRef}
        x={x}
        y={y}
        width={width}
        height={height}
        fill={withAlpha(zone.color, 0.3)}
        stroke={zone.color}
        strokeWidth={selected ? 2.5 : 1.5}
        dash={[7, 5]}
        draggable
        onMouseDown={() => onSelect(zone.id)}
        onMouseEnter={(e) => setCanvasCursor(e, "pointer")}
        onMouseLeave={(e) => setCanvasCursor(e, "default")}
        onDragEnd={(e) => {
          onChange(zone.id, {
            x: pxToCm(e.target.x() - origin.x, scale),
            y: pxToCm(e.target.y() - origin.y, scale),
          });
        }}
        onTransformEnd={() => {
          const node = rectRef.current;
          if (!node) return;
          const newWidthPx = Math.max(node.width() * node.scaleX(), minPx);
          const newHeightPx = Math.max(node.height() * node.scaleY(), minPx);
          node.scaleX(1);
          node.scaleY(1);
          node.width(newWidthPx);
          node.height(newHeightPx);
          onChange(zone.id, {
            x: pxToCm(node.x() - origin.x, scale),
            y: pxToCm(node.y() - origin.y, scale),
            widthCm: pxToCm(newWidthPx, scale),
            heightCm: pxToCm(newHeightPx, scale),
          });
        }}
      />
      {selected && (
        <Transformer
          ref={trRef}
          rotateEnabled={false}
          keepRatio={false}
          boundBoxFunc={(oldBox, newBox) =>
            newBox.width < minPx || newBox.height < minPx ? oldBox : newBox
          }
          anchorStroke="#3F5A45"
          anchorFill="#ffffff"
          anchorCornerRadius={2}
          borderStroke="#3F5A45"
          borderDash={[4, 4]}
        />
      )}
    </>
  );
}
