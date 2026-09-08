// lib/planner/constants.ts

/** largeur de la sidebar du planner, doit rester cohérente avec ses classes Tailwind */
export const SIDEBAR_WIDTH_PX = 340;

/** hauteur du header global (voir app/layout.tsx, classe h-14) */
export const HEADER_HEIGHT_PX = 56;

/**
 * en dessous de cette largeur (le "md:" de Tailwind), la sidebar bascule en
 * tiroir superposé au canvas plutôt qu'en colonne fixe qui lui prend de la
 * place — le canvas ne doit alors plus soustraire SIDEBAR_WIDTH_PX.
 */
export const SIDEBAR_BREAKPOINT_PX = 768;
