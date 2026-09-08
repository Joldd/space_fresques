// lib/planner/cursor.ts
import type Konva from "konva";

/**
 * Le curseur CSS n'a pas de prise sur le contenu peint dans un <canvas> : il
 * faut le poser à la main sur le conteneur du Stage au survol des éléments
 * interactifs (tables, chaises, zones...).
 */
export function setCanvasCursor(e: Konva.KonvaEventObject<MouseEvent>, cursor: string) {
  const container = e.target.getStage()?.container();
  if (container) container.style.cursor = cursor;
}
