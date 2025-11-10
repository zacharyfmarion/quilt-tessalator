import { Polygon, TessellationResult, TessellationPiece } from './types';

/**
 * Convert a polygon to SVG path data
 */
export function polygonToPath(polygon: Polygon): string {
  if (polygon.length === 0) return '';

  const firstPoint = polygon[0];
  let path = `M ${firstPoint.x.toFixed(3)} ${firstPoint.y.toFixed(3)}`;

  for (let i = 1; i < polygon.length; i++) {
    const point = polygon[i];
    path += ` L ${point.x.toFixed(3)} ${point.y.toFixed(3)}`;
  }

  path += ' Z'; // close path
  return path;
}

/**
 * Generate an SVG string for a single piece
 */
export function pieceToSVG(
  piece: TessellationPiece,
  color: string,
  includeId: boolean = true
): string {
  const pathData = polygonToPath(piece.polygon);
  const idAttr = includeId ? `id="${piece.id}"` : '';

  return `<path ${idAttr} d="${pathData}" fill="${color}" stroke="black" stroke-width="0.5"/>`;
}

/**
 * Generate a complete SVG for all pieces
 */
export function generateFullSVG(
  result: TessellationResult,
  colorPalette: string[],
  options: {
    showSeamAllowance?: boolean;
    baseTessellation?: TessellationResult; // Original without seam allowance
    padding?: number;
    units?: string;
  } = {}
): string {
  const { showSeamAllowance = false, baseTessellation, padding = 10, units = 'mm' } = options;

  // When showing seam allowance, use OFFSET tessellation bounds (result) for the viewBox
  // This shows the full cutting area including seam allowance
  // Original shapes will appear smaller inside because they don't have seam allowance
  const { bounds } = result;

  const width = bounds.width + padding * 2;
  const height = bounds.height + padding * 2;

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}${units}" height="${height}${units}" viewBox="0 0 ${width} ${height}">
  <defs>
    <style>
      .original-outline { fill: none; stroke: #666; stroke-width: 0.8; stroke-dasharray: 3,3; }
      .seam-piece { stroke: black; stroke-width: 0.5; fill-opacity: 0.3; }
    </style>
  </defs>
  <g transform="translate(${padding}, ${padding})">
`;

  // If showing seam allowance and we have the base tessellation, draw both
  if (showSeamAllowance && baseTessellation) {
    // First draw the original polygons (sewing lines) as dashed
    for (const piece of baseTessellation.pieces) {
      const pathData = polygonToPath(piece.polygon);
      svg += `    <path id="${piece.id}-original" class="original-outline" d="${pathData}"/>\n`;
    }

    // Then draw the offset polygons (cutting lines) with fills
    for (const piece of result.pieces) {
      const color = colorPalette[piece.colorIndex] || '#cccccc';
      const pathData = polygonToPath(piece.polygon);
      svg += `    <path id="${piece.id}" class="seam-piece" fill="${color}" d="${pathData}"/>\n`;
    }
  } else {
    // Just draw normal pieces
    for (const piece of result.pieces) {
      const color = colorPalette[piece.colorIndex] || '#cccccc';
      svg += '    ' + pieceToSVG(piece, color, true) + '\n';
    }
  }

  svg += `  </g>
</svg>`;

  return svg;
}

/**
 * Generate an SVG for pieces of a single color (for laser cutting)
 */
export function generateColorSVG(
  pieces: TessellationPiece[],
  fabricName: string,
  options: {
    padding?: number;
    units?: string;
    strokeWidth?: number;
  } = {}
): string {
  const { padding = 10, units = 'mm', strokeWidth = 0.1 } = options;

  // Calculate bounds for these pieces
  const allPoints = pieces.flatMap(p => p.polygon);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const point of allPoints) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  const width = maxX - minX + padding * 2;
  const height = maxY - minY + padding * 2;

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}${units}" height="${height}${units}" viewBox="0 0 ${width} ${height}">
  <defs>
    <style>
      .cut-line { fill: none; stroke: black; stroke-width: ${strokeWidth}; }
    </style>
  </defs>
  <g id="${fabricName}" transform="translate(${padding - minX}, ${padding - minY})">
`;

  // Draw all pieces as cut lines (no fill, just stroke for laser cutter)
  for (const piece of pieces) {
    const pathData = polygonToPath(piece.polygon);
    svg += `    <path id="${piece.id}" class="cut-line" d="${pathData}"/>\n`;
  }

  // Add metadata
  svg += `    <text x="5" y="${height - 5}" font-family="Arial" font-size="10" fill="black">
      ${fabricName} - ${pieces.length} pieces
    </text>
`;

  svg += `  </g>
</svg>`;

  return svg;
}

/**
 * Download helper for browser
 */
export function downloadSVG(svg: string, filename: string): void {
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
