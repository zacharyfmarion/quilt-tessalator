export type Point = { x: number; y: number };

export type Polygon = Point[];

export interface TessellationPiece {
  id: string;
  polygon: Polygon;
  colorIndex: number;
  isTriangle: boolean;
  row: number;
  col: number;
  position: 'top' | 'bottom' | 'full'; // for triangles/quads or full rectangle
}

export interface TessellationConfig {
  rows: number;
  cols: number;
  squareSize: number; // in mm or inches - base size
  colors: number; // number of different fabrics
  splitProbability: number; // 0-1, chance a square becomes two pieces
  seamAllowance: number; // in same units as squareSize
  offsetAmount: number; // 0-1, how much each row is offset (0.5 = half brick)
  widthVariation: number; // 0-1, how much width can vary (0 = no variation, 1 = +/- 100%)
  splitAngleVariation: number; // 0-1, how much the split angle varies from 45° (creates quads instead of triangles)
}

export interface TessellationResult {
  pieces: TessellationPiece[];
  config: TessellationConfig;
  bounds: {
    width: number;
    height: number;
  };
}
