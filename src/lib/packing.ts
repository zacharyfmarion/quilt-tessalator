import { TessellationPiece, Polygon } from './types';
import { offsetPolygon } from './geometry';
import { polygonToPath } from './svg';
import { AnyNest, FloatPolygon, Placement } from 'any-nest';

export interface PackedPiece {
  piece: TessellationPiece;
  x: number;
  y: number;
  rotation: number; // degrees
}

export interface PackedResult {
  pieces: PackedPiece[];
  sheetWidth: number;
  sheetHeight: number;
  efficiency: number; // 0-100 percentage
}

export interface PackingOptions {
  sheetWidth: number;
  sheetHeight: number;
  seamAllowance: number;
  spacing: number;
}

/**
 * Convert our Polygon format to any-nest FloatPolygon format
 */
function toFloatPolygon(polygon: Polygon, id: string): FloatPolygon {
  return FloatPolygon.fromPoints(
    polygon.map(p => ({ x: p.x, y: p.y })),
    id
  );
}

/**
 * Pack polygons using any-nest library
 */
export async function packPolygons(
  pieces: TessellationPiece[],
  options: PackingOptions
): Promise<PackedResult> {
  const { sheetWidth, sheetHeight, seamAllowance, spacing } = options;

  // Apply seam allowance to all pieces first
  const piecesWithSeams = pieces.map(piece => ({
    ...piece,
    polygon: offsetPolygon(piece.polygon, seamAllowance)
  }));

  // Create bin (sheet) as a rectangle
  const bin = FloatPolygon.fromPoints([
    { x: 0, y: 0 },
    { x: sheetWidth, y: 0 },
    { x: sheetWidth, y: sheetHeight },
    { x: 0, y: sheetHeight }
  ], 'bin');

  // Convert pieces to FloatPolygon format
  const parts = piecesWithSeams.map(piece =>
    toFloatPolygon(piece.polygon, piece.id)
  );

  // Create and configure nester
  const nester = new AnyNest();

  // IMPORTANT: Config must be set before bin and parts
  nester.config({
    spacing: spacing,
    rotations: 360, // Allow any rotation angle (1 degree increments)
    populationSize: 20, // Larger population for better results
    mutationRate: 10,
    useHoles: false,
    exploreConcave: false
  });

  nester.setBin(bin);
  nester.setParts(parts);

  // Run nesting algorithm
  return new Promise<PackedResult>((resolve, reject) => {
    let bestResult: PackedResult | null = null;
    let iterationCount = 0;
    const maxIterations = 10; // Let algorithm run for 10 generations

    nester.start(
      (progress: number) => {
        // Progress callback - could be used for UI updates
        console.log('Nesting progress:', (progress * 100).toFixed(1) + '%');
      },
      (placements: Placement[][], utilization: number) => {
        iterationCount++;
        console.log(`Iteration ${iterationCount}, Utilization: ${(utilization * 100).toFixed(1)}%`);

        if (!placements || placements.length === 0 || placements[0].length === 0) {
          console.warn('Any-nest could not find valid placement');
          return;
        }

        // Convert placements to our format
        const packed: PackedPiece[] = [];

        for (const placement of placements[0]) {
          const piece = piecesWithSeams.find(p => p.id === placement.id);
          if (piece) {
            packed.push({
              piece: piece,
              x: placement.translate.x,
              y: placement.translate.y,
              rotation: placement.rotate
            });
          }
        }

        // Calculate efficiency
        const totalArea = piecesWithSeams.reduce((sum, piece) => {
          return sum + calculatePolygonArea(piece.polygon);
        }, 0);
        const sheetArea = sheetWidth * sheetHeight;
        const efficiency = (totalArea / sheetArea) * 100;

        // Update best result
        bestResult = {
          pieces: packed,
          sheetWidth,
          sheetHeight,
          efficiency
        };

        // Stop after maxIterations generations to get a good result
        if (iterationCount >= maxIterations) {
          console.log(`Stopping after ${iterationCount} iterations with ${efficiency.toFixed(1)}% efficiency`);
          nester.stop();
          resolve(bestResult);
        }
      }
    );

    // Timeout after 30 seconds as safety measure
    setTimeout(() => {
      console.log('Packing timeout reached');
      nester.stop();
      if (bestResult) {
        resolve(bestResult);
      } else {
        reject(new Error('No valid packing found within timeout period'));
      }
    }, 30000);
  });
}

/**
 * Calculate area of a polygon using shoelace formula
 */
function calculatePolygonArea(polygon: Polygon): number {
  let area = 0;
  const n = polygon.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += polygon[i].x * polygon[j].y;
    area -= polygon[j].x * polygon[i].y;
  }

  return Math.abs(area / 2);
}

/**
 * Generate SVG for packed layout
 */
export function generatePackedSVG(
  packed: PackedResult,
  colorName: string,
  options: {
    padding?: number;
    units?: string;
    strokeWidth?: number;
  } = {}
): string {
  const { padding = 10, units = 'mm', strokeWidth = 0.1 } = options;

  const width = packed.sheetWidth + padding * 2;
  const height = packed.sheetHeight + padding * 2;

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}${units}" height="${height}${units}" viewBox="0 0 ${width} ${height}">
  <defs>
    <style>
      .cut-line { fill: none; stroke: black; stroke-width: ${strokeWidth}; }
      .sheet-boundary { fill: none; stroke: #ccc; stroke-width: 0.5; stroke-dasharray: 5,5; }
    </style>
  </defs>
  <g transform="translate(${padding}, ${padding})">
    <!-- Sheet boundary -->
    <rect class="sheet-boundary" x="0" y="0" width="${packed.sheetWidth}" height="${packed.sheetHeight}"/>
`;

  // Draw all packed pieces
  for (const packedPiece of packed.pieces) {
    const transform = `translate(${packedPiece.x.toFixed(3)}, ${packedPiece.y.toFixed(3)}) rotate(${packedPiece.rotation})`;
    const pathData = polygonToPath(packedPiece.piece.polygon);

    svg += `    <path id="${packedPiece.piece.id}" class="cut-line" transform="${transform}" d="${pathData}"/>\n`;
  }

  // Add metadata
  svg += `    <text x="5" y="${packed.sheetHeight + 20}" font-family="Arial" font-size="10" fill="black">
      ${colorName} - ${packed.pieces.length} pieces | Sheet: ${packed.sheetWidth.toFixed(0)}×${packed.sheetHeight.toFixed(0)}mm | Efficiency: ${packed.efficiency.toFixed(1)}%
    </text>
`;

  svg += `  </g>
</svg>`;

  return svg;
}
