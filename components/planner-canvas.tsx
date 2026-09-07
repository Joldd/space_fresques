import { Stage, Layer, Rect } from "react-konva";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";

export default function PlannerCanvas() {
  const [position, setPosition] = useState({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  });

  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const isDark = resolvedTheme === "dark";

  return (
    <Stage width={window.innerWidth} height={window.innerHeight}>
      <Layer>
        <Rect
          x={position.x}
          y={position.y}
          width={50}
          height={70}
          cornerRadius={10}
          fill="red"
          stroke={isDark ? "white" : "dark"}
          strokeWidth={4}
          draggable
          onMouseEnter={(e) => {
            document.body.style.cursor = "pointer";
          }}
          onMouseLeave={(e) => {
            document.body.style.cursor = "default";
          }}
          onDragEnd={(e) => {
            setPosition({
              x: e.target.x(),
              y: e.target.y(),
            });
          }}
        />
      </Layer>
    </Stage>
  );
}
