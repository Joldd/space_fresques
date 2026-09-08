// lib/planner/types.ts

export type RoomShapeKind = "passerelle" | "rectangle";

export type Room = {
  kind: RoomShapeKind;
  /** contour de la salle, en cm, dans son propre repère (haut-gauche ≈ origine) */
  polygon: Point[];
  /** largeur de la boîte englobante, en mètres (affichage) */
  widthM: number;
  /** hauteur de la boîte englobante, en mètres (affichage) */
  heightM: number;
  /**
   * Indices (dans `polygon`) des sommets à dessiner comme un arrondi plutôt
   * qu'un angle vif : le sommet sert de point de contrôle d'une courbe
   * quadratique entre son voisin précédent et son voisin suivant. Le
   * polygone (collisions, contention des meubles) reste inchangé — seul le
   * tracé visuel est arrondi.
   */
  curvedVertices?: number[];
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
