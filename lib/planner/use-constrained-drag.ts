// lib/planner/use-constrained-drag.ts
"use client";

import { useRef } from "react";
import type Konva from "konva";
import type { Point, SceneObject } from "./types";
import { cmToPx, pxToCm } from "./scale";
import { clampGroupDelta } from "./geometry";

/**
 * Fabrique les handlers de drag Konva pour un objet (table ou chaise) qui ne
 * doit jamais sortir du contour de la salle, y compris quand il est déplacé
 * avec le reste de la sélection.
 *
 * Le blocage visuel en temps réel passe par `dragBoundFunc` (exécuté de façon
 * synchrone dans la boucle de drag de Konva) plutôt que par un aller-retour
 * via le state React, qui arrive trop tard pour contraindre un drag en cours.
 */
export function useConstrainedDrag({
  id,
  scale,
  roomPolygon,
  getDragGroup,
  onPointerDown,
  onDragDelta,
}: {
  id: string;
  scale: number;
  roomPolygon: Point[];
  /** objets (avec leur position au début du drag) à déplacer ensemble avec ce nœud */
  getDragGroup: (id: string) => SceneObject[];
  onPointerDown: (id: string, additive: boolean) => void;
  onDragDelta: (dxCm: number, dyCm: number) => void;
}) {
  const dragGroupRef = useRef<SceneObject[]>([]);
  const dragStartPxRef = useRef<Point>({ x: 0, y: 0 });
  const lastPointPxRef = useRef<Point>({ x: 0, y: 0 });

  function handleMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    const additive = e.evt.ctrlKey || e.evt.metaKey || e.evt.shiftKey;
    onPointerDown(id, additive);
  }

  function handleDragStart(e: Konva.KonvaEventObject<DragEvent>) {
    const pos = { x: e.target.x(), y: e.target.y() };
    dragStartPxRef.current = pos;
    lastPointPxRef.current = pos;
    dragGroupRef.current = getDragGroup(id);
  }

  function dragBoundFunc(pos: Point): Point {
    const group = dragGroupRef.current;
    const start = dragStartPxRef.current;
    if (group.length === 0) return pos;

    const dxCmRaw = pxToCm(pos.x - start.x, scale);
    const dyCmRaw = pxToCm(pos.y - start.y, scale);
    const { dx, dy } = clampGroupDelta(group, dxCmRaw, dyCmRaw, roomPolygon);
    return { x: start.x + cmToPx(dx, scale), y: start.y + cmToPx(dy, scale) };
  }

  function handleDragMove(e: Konva.KonvaEventObject<DragEvent>) {
    const newX = e.target.x();
    const newY = e.target.y();
    const dxPx = newX - lastPointPxRef.current.x;
    const dyPx = newY - lastPointPxRef.current.y;
    lastPointPxRef.current = { x: newX, y: newY };
    if (dxPx !== 0 || dyPx !== 0) {
      onDragDelta(pxToCm(dxPx, scale), pxToCm(dyPx, scale));
    }
  }

  return { handleMouseDown, handleDragStart, handleDragMove, dragBoundFunc };
}
