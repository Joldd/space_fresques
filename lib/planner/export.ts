// lib/planner/export.ts
import type Konva from "konva";
import { jsPDF } from "jspdf";
import type { Room, ZoneObject } from "./types";
import { polygonBounds } from "./geometry";
import { cmToPx } from "./scale";

/** netteté de l'export : le plan est rendu à 2x sa résolution écran */
const EXPORT_PIXEL_RATIO = 2;
const CROP_MARGIN_PX = 32;

const LEGEND_PADDING_PX = 24;
const LEGEND_TITLE_HEIGHT_PX = 30;
const LEGEND_ROW_HEIGHT_PX = 30;
const LEGEND_SWATCH_PX = 16;
const LEGEND_BG = "#F6F1E7";
const LEGEND_TEXT = "#3F5A45";
const LEGEND_TEXT_MUTED = "#8A8368";

// le titre et la date sont empilés (plutôt que côte à côte) : la largeur de
// l'export dépend du plan et peut être trop étroite pour les deux sur une
// même ligne (nom de salle long + crop serré sur une pièce étroite)
const HEADER_TITLE_LINE_PX = 26;
const HEADER_DATE_LINE_PX = 20;
const HEADER_HEIGHT_PX = LEGEND_PADDING_PX + HEADER_TITLE_LINE_PX + HEADER_DATE_LINE_PX + LEGEND_PADDING_PX / 2;

/**
 * Zone de recadrage (en px écran, repère du Stage) qui englobe la salle ET
 * toutes les zones — ces dernières pouvant dépasser du contour de la salle,
 * un export cadré uniquement sur la salle les couperait sinon.
 */
function computeExportCropPx(
  room: Room,
  zones: ZoneObject[],
  scale: number,
  origin: { x: number; y: number },
) {
  const bounds = polygonBounds(room.polygon);
  let minX = bounds.minX;
  let maxX = bounds.maxX;
  let minY = bounds.minY;
  let maxY = bounds.maxY;

  for (const zone of zones) {
    minX = Math.min(minX, zone.x);
    maxX = Math.max(maxX, zone.x + zone.widthCm);
    minY = Math.min(minY, zone.y);
    maxY = Math.max(maxY, zone.y + zone.heightCm);
  }

  return {
    x: origin.x + cmToPx(minX, scale) - CROP_MARGIN_PX,
    y: origin.y + cmToPx(minY, scale) - CROP_MARGIN_PX,
    width: cmToPx(maxX - minX, scale) + CROP_MARGIN_PX * 2,
    height: cmToPx(maxY - minY, scale) + CROP_MARGIN_PX * 2,
  };
}

/** dessine la légende des zones (couleur + nom) sous forme de canvas autonome */
function buildLegendCanvas(zones: ZoneObject[], widthPx: number): HTMLCanvasElement | null {
  if (zones.length === 0) return null;

  const heightPx = LEGEND_PADDING_PX * 2 + LEGEND_TITLE_HEIGHT_PX + zones.length * LEGEND_ROW_HEIGHT_PX;
  const canvas = document.createElement("canvas");
  canvas.width = widthPx * EXPORT_PIXEL_RATIO;
  canvas.height = heightPx * EXPORT_PIXEL_RATIO;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(EXPORT_PIXEL_RATIO, EXPORT_PIXEL_RATIO);

  ctx.fillStyle = LEGEND_BG;
  ctx.fillRect(0, 0, widthPx, heightPx);

  ctx.fillStyle = LEGEND_TEXT;
  ctx.font = "600 15px system-ui, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText("Légende des zones", LEGEND_PADDING_PX, LEGEND_PADDING_PX + LEGEND_TITLE_HEIGHT_PX / 2);

  ctx.font = "13px system-ui, sans-serif";
  zones.forEach((zone, i) => {
    const rowY = LEGEND_PADDING_PX + LEGEND_TITLE_HEIGHT_PX + i * LEGEND_ROW_HEIGHT_PX;
    const swatchY = rowY + (LEGEND_ROW_HEIGHT_PX - LEGEND_SWATCH_PX) / 2;

    ctx.fillStyle = zone.color;
    ctx.fillRect(LEGEND_PADDING_PX, swatchY, LEGEND_SWATCH_PX, LEGEND_SWATCH_PX);
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.strokeRect(LEGEND_PADDING_PX, swatchY, LEGEND_SWATCH_PX, LEGEND_SWATCH_PX);

    ctx.fillStyle = LEGEND_TEXT;
    ctx.fillText(
      zone.name || "Zone sans nom",
      LEGEND_PADDING_PX + LEGEND_SWATCH_PX + 10,
      rowY + LEGEND_ROW_HEIGHT_PX / 2,
    );
  });

  return canvas;
}

/**
 * Compose l'export final : le plan (salle, tables, zones — cadré pour
 * inclure les zones qui dépasseraient du contour) au-dessus de la légende
 * des zones.
 */
export function buildExportCanvas(
  stage: Konva.Stage,
  room: Room,
  zones: ZoneObject[],
  scale: number,
  origin: { x: number; y: number },
  title: string,
): HTMLCanvasElement {
  const crop = computeExportCropPx(room, zones, scale, origin);
  const planCanvas = stage.toCanvas({ ...crop, pixelRatio: EXPORT_PIXEL_RATIO });

  const legendCanvas = buildLegendCanvas(zones, planCanvas.width / EXPORT_PIXEL_RATIO);

  const width = planCanvas.width;
  const height = HEADER_HEIGHT_PX * EXPORT_PIXEL_RATIO + planCanvas.height + (legendCanvas?.height ?? 0);

  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d");
  if (!ctx) return out;

  ctx.fillStyle = LEGEND_BG;
  ctx.fillRect(0, 0, width, height);

  ctx.scale(EXPORT_PIXEL_RATIO, EXPORT_PIXEL_RATIO);
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = LEGEND_TEXT;
  ctx.font = "600 18px system-ui, sans-serif";
  ctx.fillText(title, LEGEND_PADDING_PX, LEGEND_PADDING_PX + HEADER_TITLE_LINE_PX * 0.7);
  ctx.fillStyle = LEGEND_TEXT_MUTED;
  ctx.font = "13px system-ui, sans-serif";
  ctx.fillText(
    new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }),
    LEGEND_PADDING_PX,
    LEGEND_PADDING_PX + HEADER_TITLE_LINE_PX + HEADER_DATE_LINE_PX * 0.7,
  );
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  ctx.drawImage(planCanvas, 0, HEADER_HEIGHT_PX * EXPORT_PIXEL_RATIO);
  if (legendCanvas) ctx.drawImage(legendCanvas, 0, HEADER_HEIGHT_PX * EXPORT_PIXEL_RATIO + planCanvas.height);

  return out;
}

function triggerDownload(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function downloadCanvasAsJpeg(canvas: HTMLCanvasElement, filename: string) {
  triggerDownload(canvas.toDataURL("image/jpeg", 0.92), filename);
}

export function downloadCanvasAsPdf(canvas: HTMLCanvasElement, filename: string) {
  const imgData = canvas.toDataURL("image/jpeg", 0.92);
  const pageWidth = canvas.width / EXPORT_PIXEL_RATIO;
  const pageHeight = canvas.height / EXPORT_PIXEL_RATIO;
  const doc = new jsPDF({
    orientation: pageWidth >= pageHeight ? "landscape" : "portrait",
    unit: "px",
    format: [pageWidth, pageHeight],
  });
  doc.addImage(imgData, "JPEG", 0, 0, pageWidth, pageHeight);
  doc.save(filename);
}
