// lib/planner/color.ts

/** palette proposée dans les menus contextuels (zones, tables) — la couleur reste libre (color picker) */
export const COLOR_PALETTE = [
  "#D98E73",
  "#7A9E7E",
  "#6E93C0",
  "#C77AA8",
  "#D9B94D",
  "#8A6FB0",
];

export const DEFAULT_TABLE_COLOR = "#D98E73";

/** "#RRGGBB" (ou "#RGB") -> "rgba(r, g, b, alpha)" */
export function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return `rgba(122, 158, 126, ${alpha})`;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** blanc ou brun foncé selon la luminosité du fond, pour un texte lisible sur n'importe quelle couleur */
export function readableTextColor(hex: string): string {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return "#ffffff";
  const luminance = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return luminance > 0.7 ? "#3B3526" : "#ffffff";
}

/** assombrit une couleur hex d'un facteur (0-1) — utilisé pour un contour lisible sur fond clair */
export function darken(hex: string, amount = 0.22): string {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return hex;
  const r = Math.round(((n >> 16) & 255) * (1 - amount));
  const g = Math.round(((n >> 8) & 255) * (1 - amount));
  const b = Math.round((n & 255) * (1 - amount));
  return `rgb(${r}, ${g}, ${b})`;
}
