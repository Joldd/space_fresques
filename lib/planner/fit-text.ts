// lib/planner/fit-text.ts

type FitTextOptions = {
  /** même valeurs que celles passées au <Text> Konva, pour mesurer à l'identique */
  fontFamily: string;
  fontStyle: string;
  lineHeight: number;
  minFontSize: number;
  maxFontSize: number;
};

let measureCtx: CanvasRenderingContext2D | null = null;

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (!measureCtx && typeof document !== "undefined") {
    measureCtx = document.createElement("canvas").getContext("2d");
  }
  return measureCtx;
}

/**
 * Découpe `words` en lignes de largeur <= maxWidth (retour à la ligne aux
 * espaces, comme `wrap="word"` de Konva). Renvoie null si un mot seul est
 * plus large que maxWidth : Konva le couperait alors en plein milieu.
 */
function wrapLineCount(ctx: CanvasRenderingContext2D, words: string[], maxWidth: number): number | null {
  let lines = 1;
  let current = "";
  for (const word of words) {
    if (ctx.measureText(word).width > maxWidth) return null;
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines++;
      current = word;
    }
  }
  return lines;
}

/**
 * Plus grande taille de police (entière, entre min et max) pour laquelle
 * `text`, renvoyé à la ligne mot à mot, tient dans une boîte de
 * boxWidth × boxHeight px. Renvoie minFontSize si rien ne tient (le <Text>
 * tronque alors avec une ellipse).
 */
export function fitFontSize(text: string, boxWidth: number, boxHeight: number, options: FitTextOptions): number {
  const { fontFamily, fontStyle, lineHeight, minFontSize, maxFontSize } = options;
  const ctx = getMeasureContext();
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!ctx || words.length === 0 || boxWidth <= 0 || boxHeight <= 0) return minFontSize;

  // petite marge : les arrondis de mesure de Konva peuvent différer d'un
  // poil des nôtres, et un débordement d'1px suffit à créer une ligne de trop
  const maxWidth = boxWidth - 1;

  const fits = (size: number) => {
    ctx.font = `${fontStyle} ${size}px ${fontFamily}`;
    const lines = wrapLineCount(ctx, words, maxWidth);
    return lines !== null && lines * size * lineHeight <= boxHeight;
  };

  // recherche dichotomique : plus la police est grande, moins ça tient
  let lo = minFontSize;
  let hi = Math.max(minFontSize, Math.floor(Math.min(maxFontSize, boxHeight / lineHeight)));
  if (!fits(lo)) return minFontSize;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (fits(mid)) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
