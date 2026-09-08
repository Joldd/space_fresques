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
