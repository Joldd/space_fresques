"use client";

import { Rect } from "react-konva";

type TableProps = {
  x: number;
  y: number;
};

export function Table({ x, y }: TableProps) {
  return (
    <Rect
      x={x}
      y={y}
      width={80}
      height={50}
      fill="#8A5FBF"
      cornerRadius={4}
      draggable
    />
  );
}