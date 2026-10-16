// components/planner/shape-icon.tsx
import type { ShapeKind } from "@/lib/planner/types";
import { SHAPE_BOX, getShapeDefinition } from "@/lib/planner/shapes";

/** aperçu SVG d'une forme du catalogue (mêmes tracés que sur le canvas) */
export function ShapeIcon({ kind, className }: { kind: ShapeKind; className?: string }) {
  const { paths } = getShapeDefinition(kind);
  return (
    <svg viewBox={`-4 -4 ${SHAPE_BOX + 8} ${SHAPE_BOX + 8}`} className={className} aria-hidden>
      {paths.map((path, i) => (
        <path
          key={i}
          d={path.d}
          fill={path.detail ? "#ffffff" : "currentColor"}
          stroke={path.detail ? "none" : "currentColor"}
          strokeWidth={4}
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
