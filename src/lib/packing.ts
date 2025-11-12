import { TessellationPiece, Polygon } from './types';
import { offsetPolygon } from './geometry';
import { polygonToPath } from './svg';
import { AnyNest, FloatPolygon, Placement } from 'any-nest';

export interface PackedPiece {
  piece: TessellationPiece; // Piece with seam allowance (for packing/cutting)
  originalPiece: TessellationPiece; // Piece without seam allowance (for sewing guide)
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

export interface PackingProgress {
  iteration: number;
  utilization: number;
  isRunning: boolean;
}

export interface PackingOptions {
  sheetWidth: number;
  sheetHeight: number;
  seamAllowance: number;
  spacing: number;
  maxIterations?: number; // Number of iterations to run (default 10)
  onProgress?: (progress: PackingProgress) => void;
  onNesterCreated?: (nester: AnyNest) => void;
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
  console.log('[packPolygons] Starting with pieces:', pieces.length);
  const { sheetWidth, sheetHeight, seamAllowance, spacing, onProgress, onNesterCreated } = options;
  console.log('[packPolygons] Options:', { sheetWidth, sheetHeight, seamAllowance, spacing });

  // Apply seam allowance to all pieces first
  console.log('[packPolygons] Applying seam allowance...');
  const piecesWithSeams = pieces.map(piece => ({
    ...piece,
    polygon: offsetPolygon(piece.polygon, seamAllowance)
  }));
  console.log('[packPolygons] Seam allowance applied');

  // Create bin (sheet) as a rectangle
  console.log('[packPolygons] Creating bin...');
  const bin = FloatPolygon.fromPoints([
    { x: 0, y: 0 },
    { x: sheetWidth, y: 0 },
    { x: sheetWidth, y: sheetHeight },
    { x: 0, y: sheetHeight }
  ], 'bin');
  console.log('[packPolygons] Bin created');

  // Convert pieces to FloatPolygon format
  console.log('[packPolygons] Converting pieces to FloatPolygon...');
  const parts = piecesWithSeams.map(piece =>
    toFloatPolygon(piece.polygon, piece.id)
  );
  console.log('[packPolygons] Converted', parts.length, 'parts');

  // Create and configure nester
  console.log('[packPolygons] Creating AnyNest instance...');
  const nester = new AnyNest();

  // IMPORTANT: Config must be set before bin and parts
  console.log('[packPolygons] Configuring nester...');
  nester.config({
    spacing: spacing,
    rotations: 360, // Allow any rotation angle (1 degree increments)
    populationSize: 20, // Larger population for better results
    mutationRate: 10,
    useHoles: false,
    exploreConcave: false
  });
  console.log('[packPolygons] Nester configured');

  console.log('[packPolygons] Setting bin and parts...');
  nester.setBin(bin);
  nester.setParts(parts);
  console.log('[packPolygons] Bin and parts set');

  // Expose nester instance for stopping
  if (onNesterCreated) {
    console.log('[packPolygons] Calling onNesterCreated...');
    onNesterCreated(nester);
  }

  // Run nesting algorithm
  console.log('[packPolygons] Starting nesting algorithm...');
  return new Promise<PackedResult>((resolve, reject) => {
    let bestResult: PackedResult | null = null;
    let iterationCount = 0;
    const maxIterations = options.maxIterations || 10; // Let algorithm run for N generations

    // Use setTimeout to prevent blocking the UI thread
    console.log('[packPolygons] Scheduling nester.start()...');
    setTimeout(() => {
      console.log('[packPolygons] Calling nester.start()...');
      nester.start(
      (progress: number) => {
        // Progress callback - could be used for UI updates
        console.log('[packPolygons] Nesting progress callback:', (progress * 100).toFixed(1) + '%');
      },
      (placements: Placement[][], utilization: number) => {
        iterationCount++;
        console.log(`[packPolygons] Iteration callback ${iterationCount}, Utilization: ${(utilization * 100).toFixed(1)}%`);

        // Report progress to UI
        if (onProgress) {
          console.log('[packPolygons] Calling onProgress callback...');
          onProgress({
            iteration: iterationCount,
            utilization: utilization * 100,
            isRunning: true
          });
        }

        if (!placements || placements.length === 0 || placements[0].length === 0) {
          console.warn('Any-nest could not find valid placement');
          return;
        }

        // Convert placements to our format
        const packed: PackedPiece[] = [];

        for (const placement of placements[0]) {
          const pieceWithSeam = piecesWithSeams.find(p => p.id === placement.id);
          const originalPiece = pieces.find(p => p.id === placement.id);
          if (pieceWithSeam && originalPiece) {
            packed.push({
              piece: pieceWithSeam,
              originalPiece: originalPiece,
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

          // Report final state
          if (onProgress) {
            onProgress({
              iteration: iterationCount,
              utilization: utilization * 100,
              isRunning: false
            });
          }

          resolve(bestResult);
        }
      }
    );
    }, 0); // End of setTimeout wrapper

    // Timeout after 30 seconds as safety measure
    setTimeout(() => {
      console.log('Packing timeout reached');
      nester.stop();

      // Report stopped state
      if (onProgress) {
        onProgress({
          iteration: iterationCount,
          utilization: bestResult ? bestResult.efficiency : 0,
          isRunning: false
        });
      }

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
 * Calculate centroid of a polygon
 */
function calculatePolygonCentroid(polygon: Polygon): { x: number; y: number } {
  let cx = 0;
  let cy = 0;
  let area = 0;
  const n = polygon.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const cross = polygon[i].x * polygon[j].y - polygon[j].x * polygon[i].y;
    cx += (polygon[i].x + polygon[j].x) * cross;
    cy += (polygon[i].y + polygon[j].y) * cross;
    area += cross;
  }

  area *= 0.5;
  const factor = 1 / (6 * area);

  return {
    x: cx * factor,
    y: cy * factor
  };
}

/**
 * Generate grid coordinate label for a piece
 * Format: "(row, col)" or "(row, col) L/R" for split pieces
 */
function generateGridLabel(piece: TessellationPiece): string {
  const baseLabel = `(${piece.row}, ${piece.gridCol})`;

  if (piece.position === 'top') {
    return `${baseLabel} L`;
  } else if (piece.position === 'bottom') {
    return `${baseLabel} R`;
  }

  return baseLabel;
}

/**
 * Generate SVG for packed layout
 * Shows both original pieces (sewing lines) and offset pieces (cutting lines)
 */
export function generatePackedSVG(
  packed: PackedResult,
  colorName: string,
  options: {
    padding?: number;
    units?: string;
    strokeWidth?: number;
    showLabels?: boolean;
    showSewingLines?: boolean;
  } = {}
): string {
  const { padding = 10, units = 'mm', strokeWidth = 0.1, showLabels = true, showSewingLines = true } = options;

  const width = packed.sheetWidth + padding * 2;
  const height = packed.sheetHeight + padding * 2;

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}${units}" height="${height}${units}" viewBox="0 0 ${width} ${height}">
  <defs>
    <style>
      .cut-line { fill: none; stroke: black; stroke-width: ${strokeWidth * 3}; }
      .sewing-line { fill: none; stroke: #666; stroke-width: ${strokeWidth * 2}; stroke-dasharray: 3,3; }
      .sheet-boundary { fill: none; stroke: #ccc; stroke-width: 0.5; stroke-dasharray: 5,5; }
    </style>
  </defs>
  <g transform="translate(${padding}, ${padding})">
    <!-- Sheet boundary -->
    <rect class="sheet-boundary" x="0" y="0" width="${packed.sheetWidth}" height="${packed.sheetHeight}"/>
`;

  // Draw all packed pieces - first original (sewing lines), then offset (cutting lines)
  for (const packedPiece of packed.pieces) {
    const transform = `translate(${packedPiece.x.toFixed(3)}, ${packedPiece.y.toFixed(3)}) rotate(${packedPiece.rotation})`;

    // Draw original piece as dashed line (sewing guide) if enabled
    if (showSewingLines) {
      const originalPathData = polygonToPath(packedPiece.originalPiece.polygon);
      svg += `    <path id="${packedPiece.originalPiece.id}-sewing" class="sewing-line" transform="${transform}" d="${originalPathData}"/>\n`;
    }

    // Draw offset piece as solid line (cutting line)
    const cutPathData = polygonToPath(packedPiece.piece.polygon);
    svg += `    <path id="${packedPiece.piece.id}" class="cut-line" transform="${transform}" d="${cutPathData}"/>\n`;
  }

  // Add labels if enabled
  if (showLabels) {
    for (const packedPiece of packed.pieces) {
      const centroid = calculatePolygonCentroid(packedPiece.piece.polygon);
      const label = generateGridLabel(packedPiece.originalPiece);

      // Calculate transformed centroid position
      const rad = (packedPiece.rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const labelX = packedPiece.x + centroid.x * cos - centroid.y * sin;
      const labelY = packedPiece.y + centroid.x * sin + centroid.y * cos;

      svg += `    <text x="${labelX.toFixed(3)}" y="${labelY.toFixed(3)}" font-family="Arial, sans-serif" font-size="8" fill="black" text-anchor="middle" dominant-baseline="middle">${label}</text>\n`;
    }
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
