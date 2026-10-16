// components/planner/plan-shape.tsx
"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import { Group, Path, Text, Transformer } from "react-konva";
import type Konva from "konva";
import type { ShapeObject } from "@/lib/planner/types";
import type { ShapePatch } from "@/lib/planner/use-planner-store";
import { cmToPx, pxToCm } from "@/lib/planner/scale";
import { MIN_SHAPE_SIZE_CM, SHAPE_BOX, SHAPE_ROTATION_STEP, getShapeDefinition } from "@/lib/planner/shapes";
import { setCanvasCursor } from "@/lib/planner/cursor";
import { darken, readableTextColor } from "@/lib/planner/color";
import { fitFontSize } from "@/lib/planner/fit-text";

const LABEL_FONT = { fontFamily: "Arial", fontStyle: "600", lineHeight: 1.1, minFontSize: 6, maxFontSize: 120 };

/** angles sur lesquels la poignée de rotation s'aimante */
const ROTATION_SNAPS = Array.from({ length: 360 / SHAPE_ROTATION_STEP }, (_, i) => i * SHAPE_ROTATION_STEP);

type PlanShapeProps = {
  shape: ShapeObject;
  scale: number;
  /** origine du repère du plan dans le Stage, en px */
  origin: { x: number; y: number };
  selected: boolean;
  onSelect: (id: string) => void;
  onChange: (id: string, patch: ShapePatch) => void;
  /** appelé une seule fois au début d'un déplacement/redimensionnement/rotation — empile l'état pour Ctrl+Z */
  onBeginChange: () => void;
};

/**
 * Forme / picto libre (flèche, étoile...) : déplaçable, redimensionnable et
 * pivotable à la souris (poignées), sans aucune contrainte de position —
 * comme une zone, elle peut sortir des salles. Le texte reste horizontal
 * quelle que soit la rotation, comme le nom d'une table.
 */
export const PlanShape = memo(function PlanShape({ shape, scale, origin, selected, onSelect, onChange, onBeginChange }: PlanShapeProps) {
  const groupRef = useRef<Konva.Group>(null);
  const trRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    if (selected && trRef.current && groupRef.current) {
      trRef.current.nodes([groupRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [selected]);

  const definition = getShapeDefinition(shape.shape);
  const widthPx = cmToPx(shape.widthCm, scale);
  const heightPx = cmToPx(shape.heightCm, scale);
  const minPx = cmToPx(MIN_SHAPE_SIZE_CM, scale);
  const textColor = readableTextColor(shape.color);
  const hasText = !!shape.text;

  // boîte du texte, dans le repère (non pivoté) de la forme, centre en (0, 0)
  const { textBox } = definition;
  const textCenterX = ((textBox.x + textBox.width / 2) / SHAPE_BOX - 0.5) * widthPx;
  const textCenterY = ((textBox.y + textBox.height / 2) / SHAPE_BOX - 0.5) * heightPx;
  const textBoxWidthPx = (textBox.width / SHAPE_BOX) * widthPx;
  const textBoxHeightPx = (textBox.height / SHAPE_BOX) * heightPx;
  // le texte est contre-pivoté : sur un quart de tour, la place disponible à
  // l'écran a ses dimensions inversées
  const quarterTurned = shape.rotation % 180 === 90;
  const labelWidthPx = quarterTurned ? textBoxHeightPx : textBoxWidthPx;
  const labelHeightPx = quarterTurned ? textBoxWidthPx : textBoxHeightPx;
  const labelFontSize = useMemo(
    () => (shape.text ? fitFontSize(shape.text, labelWidthPx, labelHeightPx, LABEL_FONT) : LABEL_FONT.minFontSize),
    [shape.text, labelWidthPx, labelHeightPx],
  );

  return (
    <>
      <Group
        ref={groupRef}
        x={origin.x + cmToPx(shape.x, scale)}
        y={origin.y + cmToPx(shape.y, scale)}
        rotation={shape.rotation}
        draggable
        onMouseDown={() => onSelect(shape.id)}
        onMouseEnter={(e) => setCanvasCursor(e, "pointer")}
        onMouseLeave={(e) => setCanvasCursor(e, "default")}
        onDragStart={onBeginChange}
        onDragEnd={(e) => {
          onChange(shape.id, {
            x: pxToCm(e.target.x() - origin.x, scale),
            y: pxToCm(e.target.y() - origin.y, scale),
          });
        }}
        onTransformStart={onBeginChange}
        onTransformEnd={() => {
          const node = groupRef.current;
          if (!node) return;
          const newWidthPx = Math.max(widthPx * node.scaleX(), minPx);
          const newHeightPx = Math.max(heightPx * node.scaleY(), minPx);
          node.scaleX(1);
          node.scaleY(1);
          onChange(shape.id, {
            x: pxToCm(node.x() - origin.x, scale),
            y: pxToCm(node.y() - origin.y, scale),
            widthCm: pxToCm(newWidthPx, scale),
            heightCm: pxToCm(newHeightPx, scale),
            rotation: Math.round(node.rotation()),
          });
        }}
      >
        {definition.paths.map((path, i) =>
          path.detail && hasText ? null : (
            <Path
              key={i}
              data={path.d}
              x={-widthPx / 2}
              y={-heightPx / 2}
              scaleX={widthPx / SHAPE_BOX}
              scaleY={heightPx / SHAPE_BOX}
              fill={path.detail ? textColor : shape.color}
              stroke={path.detail ? undefined : darken(shape.color)}
              strokeWidth={1.5}
              strokeScaleEnabled={false}
              lineJoin="round"
            />
          ),
        )}
        {hasText && (
          <Text
            text={shape.text}
            x={textCenterX}
            y={textCenterY}
            rotation={-shape.rotation}
            width={labelWidthPx}
            height={labelHeightPx}
            offsetX={labelWidthPx / 2}
            offsetY={labelHeightPx / 2}
            align="center"
            verticalAlign="middle"
            wrap="word"
            ellipsis
            fontSize={labelFontSize}
            fontFamily={LABEL_FONT.fontFamily}
            fontStyle={LABEL_FONT.fontStyle}
            lineHeight={LABEL_FONT.lineHeight}
            fill={textColor}
            listening={false}
          />
        )}
      </Group>
      {selected && (
        <Transformer
          ref={trRef}
          rotationSnaps={ROTATION_SNAPS}
          rotationSnapTolerance={8}
          boundBoxFunc={(oldBox, newBox) =>
            Math.abs(newBox.width) < minPx || Math.abs(newBox.height) < minPx ? oldBox : newBox
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
});
