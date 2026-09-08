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
  /**
   * Cotes à afficher sur le plan : la salle étant un polygone quelconque et
   * non un rectangle, une seule dimension "largeur × hauteur" ne suffit pas
   * à la décrire — on annote plutôt certains segments du contour un par un.
   */
  dimensionLabels?: DimensionLabel[];
};

export type DimensionLabelSide = "top" | "bottom" | "left" | "right";

export type DimensionLabel = {
  /** indices (dans `polygon`) des deux sommets dont la distance est cotée */
  fromIndex: number;
  toIndex: number;
  /** côté du segment vers lequel décaler la cote, hors du polygone */
  side: DimensionLabelSide;
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

/**
 * Zone rectangulaire libre posée sur le plan (ex. "bar", "scène", "zone
 * photo"). Contrairement aux tables/chaises, elle n'est pas contrainte par
 * le contour de la salle : elle peut dépasser, se chevaucher, etc.
 */
export type ZoneObject = {
  id: string;
  kind: "zone";
  /** coin haut-gauche de la zone, en cm, dans le repère de la salle */
  x: number;
  y: number;
  widthCm: number;
  heightCm: number;
  /** couleur pleine (hex) ; affichée avec une transparence à l'écran */
  color: string;
  name: string;
};

export type Point = { x: number; y: number };

export type RectArea = { x: number; y: number; width: number; height: number };
