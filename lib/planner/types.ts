// lib/planner/types.ts

/** identifiant stable d'une salle du plan (sauvegardé avec chaque table/chaise) */
export type RoomId = "passerelle" | "vicat";

export type Room = {
  id: RoomId;
  /** nom affiché en titre sous la salle */
  name: string;
  /** contour de la salle, en cm, dans son propre repère (haut-gauche ≈ origine) */
  polygon: Point[];
  /** dimensions du plan client (longueur × largeur), en mètres, affichées après le nom */
  lengthM: number;
  widthM: number;
  /**
   * Indices (dans `polygon`) des sommets à dessiner comme un arrondi plutôt
   * qu'un angle vif : le sommet sert de point de contrôle d'une courbe
   * quadratique entre son voisin précédent et son voisin suivant. Le
   * polygone (collisions, contention des meubles) reste inchangé — seul le
   * tracé visuel est arrondi.
   */
  curvedVertices?: number[];
  /** éléments fixes de la salle (ex. escalier) sur lesquels on ne peut rien poser */
  obstacles?: RoomObstacle[];
  /** cloisons (ex. cloison mobile) dessinées sur le plan, sans bloquer les meubles */
  partitions?: RoomPartition[];
};

/** cloison dessinée en pointillés, en cm, dans le repère de la salle */
export type RoomPartition = {
  label: string;
  from: Point;
  to: Point;
};

/** rectangle fixe infranchissable, dessiné sur le plan avec son libellé */
export type RoomObstacle = {
  label: string;
  /** coin haut-gauche, en cm, dans le repère de la salle */
  x: number;
  y: number;
  widthCm: number;
  heightCm: number;
};

export type Rotation = 0 | 90 | 180 | 270;

export type TableObject = {
  id: string;
  kind: "table";
  /** salle où est posée la table */
  roomId: RoomId;
  /** centre de la table, en cm, dans le repère de la salle */
  x: number;
  y: number;
  widthCm: number;
  depthCm: number;
  rotation: Rotation;
  /** couleur pleine (hex) ; `undefined` sur d'anciens plans sauvegardés -> DEFAULT_TABLE_COLOR */
  color?: string;
  /** nom libre affiché sur la table ; optionnel (absent ou vide = pas de nom) */
  name?: string;
};

export type ChairObject = {
  id: string;
  kind: "chair";
  /** salle où est posée la chaise */
  roomId: RoomId;
  /** centre de la chaise, en cm, dans le repère de la salle */
  x: number;
  y: number;
  diameterCm: number;
};

export type SceneObject = TableObject | ChairObject;

/**
 * Zone rectangulaire libre posée sur le plan (ex. "bar", "scène", "zone
 * photo"). Contrairement aux tables/chaises, elle n'est pas contrainte par
 * le contour d'une salle : elle peut dépasser, se chevaucher, etc. — elle
 * n'appartient donc à aucune salle et vit dans le repère du plan entier.
 */
export type ZoneObject = {
  id: string;
  kind: "zone";
  /** coin haut-gauche de la zone, en cm, dans le repère du plan (voir PLAN_ROOMS) */
  x: number;
  y: number;
  widthCm: number;
  heightCm: number;
  /** couleur pleine (hex) ; affichée avec une transparence à l'écran */
  color: string;
  name: string;
};

export type ShapeKind =
  | "arrow"
  | "double-arrow"
  | "warning"
  | "star"
  | "circle"
  | "square"
  | "triangle"
  | "diamond"
  | "heart"
  | "cross"
  | "pin"
  | "bubble";

/**
 * Forme / picto libre (flèche, panneau attention, étoile...) posé sur le
 * plan : comme une zone, elle n'appartient à aucune salle et peut être
 * posée n'importe où, y compris hors des salles (voir lib/planner/shapes.ts).
 */
export type ShapeObject = {
  id: string;
  kind: "shape";
  shape: ShapeKind;
  /** centre de la forme, en cm, dans le repère du plan */
  x: number;
  y: number;
  widthCm: number;
  heightCm: number;
  /** en degrés, sens horaire, dans [0, 360) */
  rotation: number;
  /** couleur pleine (hex) */
  color: string;
  /** texte libre affiché sur la forme ; optionnel (absent ou vide = pas de texte) */
  text?: string;
};

export type Point = { x: number; y: number };

export type RectArea = { x: number; y: number; width: number; height: number };

export type Animator = {
  [key: string]: string;
};

export type GoogleSheetsResponse = {
  range: string;
  majorDimension: string;
  values?: string[][];
};
