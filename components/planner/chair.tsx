"use client";

import { Circle } from "react-konva";

type ChairProps = {
  x: number;
  y: number;
};

export function Chair({ x, y }: ChairProps) {
  return (
    <Circle
      x={x}
      y={y}
      radius={16}
      fill="#3E7A52"
      draggable
    />
  );
}