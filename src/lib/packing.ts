import { TessellationPiece, Polygon } from './types';
import { offsetPolygon } from './geometry';
import { polygonToPath } from './svg';

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

/**
 * Simple grid-based packing (placeholder for SVGNest integration)
 * TODO: Replace with any-nest when integrated
 */
export function packPolygons(
  pieces: TessellationPiece[],
  seamAllowance: number,
  spacing: number
): PackedResult {
  // Apply seam allowance to all pieces first
  const piecesWithSeams = pieces.map(piece => ({
    ...piece,
    polygon: offsetPolygon(piece.polygon, seamAllowance)
  }));

  // Simple grid packing as placeholder
  // Calculate bounding box for each piece
  const pieceBounds = piecesWithSeams.map(piece => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const point of piece.polygon) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  });

  // Grid packing
  const packed: PackedPiece[] = [];
  let currentX = spacing;
  let currentY = spacing;
  let rowHeight = 0;
  const sheetMaxWidth = 1000; // mm - adjust as needed

  piecesWithSeams.forEach((piece, i) => {
    const bounds = pieceBounds[i];

    // Check if we need a new row
    if (currentX + bounds.width > sheetMaxWidth && packed.length > 0) {
      currentX = spacing;
      currentY += rowHeight + spacing;
      rowHeight = 0;
    }

    // Place piece
    packed.push({
      piece: piece,
      x: currentX - bounds.minX,
      y: currentY - bounds.minY,
      rotation: 0
    });

    currentX += bounds.width + spacing;
    rowHeight = Math.max(rowHeight, bounds.height);
  });

  const sheetHeight = currentY + rowHeight + spacing;

  // Calculate efficiency
  const totalArea = piecesWithSeams.reduce((sum, piece) => {
    return sum + calculatePolygonArea(piece.polygon);
  }, 0);
  const sheetArea = sheetMaxWidth * sheetHeight;
  const efficiency = (totalArea / sheetArea) * 100;

  return {
    pieces: packed,
    sheetWidth: sheetMaxWidth,
    sheetHeight,
    efficiency
  };
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
