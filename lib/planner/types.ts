// lib/planner/types.ts

export type RoomDimensions = {
  /** largeur de la salle, en mètres */
  widthM: number;
  /** profondeur de la salle, en mètres */
  heightM: number;
};

export type Rotation = 0 | 90 | 180 | 270;

export type TableObject = {
  id: string;
  kind: "table";
  /** centre de la table, en cm, dans le repère de la salle */
  x: number;
  y: number;
  widthCm: number;
  depthCm: number;
  rotation: Rotation;
};

export type ChairObject = {
  id: string;
  kind: "chair";
  /** centre de la chaise, en cm, dans le repère de la salle */
  x: number;
  y: number;
  diameterCm: number;
};

export type SceneObject = TableObject | ChairObject;

export type Point = { x: number; y: number };

export type RectArea = { x: number; y: number; width: number; height: number };
