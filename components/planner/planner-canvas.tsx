// components/planner/planner-canvas.tsx
"use client";

import { useState } from "react";
import { Stage, Layer } from "react-konva";
import { PlannerSideBar } from "./planner-sidebar";
import { Table } from "./table";
import { Chair } from "./chair";

type SceneObject = {
  id: string;
  type: "table" | "chair";
  x: number;
  y: number;
};

export function PlannerCanvas() {
  const [objects, setObjects] = useState<SceneObject[]>([]);

  function addObject(type: "table" | "chair") {
    setObjects((prev) => [
      ...prev,
      { id: crypto.randomUUID(), type, x: 150, y: 150 },
    ]);
  }

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <PlannerSideBar
        onAddTable={() => addObject("table")}
        onAddChair={() => addObject("chair")}
      />
      <Stage width={window.innerWidth - 200} height={window.innerHeight}>
        <Layer>
          {objects.map((obj) =>
            obj.type === "table" ? (
              <Table key={obj.id} x={obj.x} y={obj.y} />
            ) : (
              <Chair key={obj.id} x={obj.x} y={obj.y} />
            )
          )}
        </Layer>
      </Stage>
    </div>
  );
}