import { TessellationConfig, TessellationResult, TessellationPiece } from './types';
import { createRectangle, splitRectangle, offsetPolygon, calculateBounds } from './geometry';

/**
 * Generate a brick-pattern tessellation with random color assignment,
 * variable widths, and optional splitting
 */
export function generateTessellation(config: TessellationConfig): TessellationResult {
  const pieces: TessellationPiece[] = [];
  const { rows, cols, squareSize, colors, splitProbability, offsetAmount, widthVariation, splitAngleVariation } = config;

  // Create a color grid first (we'll assign colors to avoid neighbors)
  const colorGrid: number[][] = [];
  for (let row = 0; row < rows; row++) {
    colorGrid[row] = [];
    for (let col = 0; col < cols; col++) {
      colorGrid[row][col] = -1; // unassigned
    }
  }

  // Assign colors using a greedy algorithm that avoids same-color neighbors
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      colorGrid[row][col] = assignColor(colorGrid, row, col, colors);
    }
  }

  // Generate variable widths for each row
  const widths: number[][] = [];
  for (let row = 0; row < rows; row++) {
    widths[row] = generateRowWidths(cols, squareSize, widthVariation);
  }

  // Generate pieces
  for (let row = 0; row < rows; row++) {
    let cumulativeX = 0;

    for (let col = 0; col < cols; col++) {
      // Calculate position with brick offset
      const offsetX = (row % 2) * offsetAmount * squareSize;
      const x = cumulativeX + offsetX;
      const y = row * squareSize;
      const width = widths[row][col];

      const shouldSplit = Math.random() < splitProbability;
      const rect = createRectangle(x, y, width, squareSize);

      if (shouldSplit) {
        const [piece1, piece2] = splitRectangle(rect, splitAngleVariation);

        // Assign different colors to each split piece
        const color1 = colorGrid[row][col];
        // For the second piece, avoid the first piece's color AND grid neighbors
        const color2 = assignColorForSplitPiece(colorGrid, row, col, colors, color1);

        pieces.push({
          id: `r${row}-c${col}-left`,
          polygon: piece1,
          colorIndex: color1,
          isTriangle: splitAngleVariation === 0,
          row,
          col,
          position: 'top',
        });

        pieces.push({
          id: `r${row}-c${col}-right`,
          polygon: piece2,
          colorIndex: color2,
          isTriangle: splitAngleVariation === 0,
          row,
          col,
          position: 'bottom',
        });
      } else {
        pieces.push({
          id: `r${row}-c${col}-full`,
          polygon: rect,
          colorIndex: colorGrid[row][col],
          isTriangle: false,
          row,
          col,
          position: 'full',
        });
      }

      cumulativeX += width;
    }
  }

  // Calculate bounds
  const allPolygons = pieces.map(p => p.polygon);
  const bounds = calculateBounds(allPolygons);

  return {
    pieces,
    config,
    bounds: {
      width: bounds.maxX - bounds.minX,
      height: bounds.maxY - bounds.minY,
    },
  };
}

/**
 * Generate variable widths for a row
 * Returns an array of widths that maintains the overall row width
 */
function generateRowWidths(cols: number, baseSize: number, variation: number): number[] {
  if (variation === 0) {
    return new Array(cols).fill(baseSize);
  }

  const widths: number[] = [];
  const targetTotal = cols * baseSize;

  // Generate random variations
  for (let i = 0; i < cols; i++) {
    // Random factor between (1 - variation) and (1 + variation)
    const factor = 1 + (Math.random() * 2 - 1) * variation;
    widths.push(baseSize * factor);
  }

  // Normalize to maintain target total width
  const currentTotal = widths.reduce((sum, w) => sum + w, 0);
  const scale = targetTotal / currentTotal;

  return widths.map(w => w * scale);
}

/**
 * Assign a color to a cell that's different from its neighbors
 */
function assignColor(grid: number[][], row: number, col: number, numColors: number): number {
  const neighborColors = new Set<number>();

  // Check all adjacent cells (including diagonals for better dispersion)
  const neighbors = [
    [row - 1, col - 1], [row - 1, col], [row - 1, col + 1],
    [row, col - 1],                     [row, col + 1],
    [row + 1, col - 1], [row + 1, col], [row + 1, col + 1],
  ];

  for (const [r, c] of neighbors) {
    if (r >= 0 && r < grid.length && c >= 0 && c < grid[0].length) {
      const color = grid[r][c];
      if (color !== -1) {
        neighborColors.add(color);
      }
    }
  }

  // Find available colors
  const availableColors: number[] = [];
  for (let i = 0; i < numColors; i++) {
    if (!neighborColors.has(i)) {
      availableColors.push(i);
    }
  }

  // If all colors are used by neighbors (unlikely with 3+ colors), pick randomly
  if (availableColors.length === 0) {
    return Math.floor(Math.random() * numColors);
  }

  // Pick randomly from available colors
  return availableColors[Math.floor(Math.random() * availableColors.length)];
}

/**
 * Assign a color to a split piece that avoids both grid neighbors AND its sibling piece
 */
function assignColorForSplitPiece(
  grid: number[][],
  row: number,
  col: number,
  numColors: number,
  siblingColor: number
): number {
  const neighborColors = new Set<number>();

  // Add the sibling piece's color (they share an edge)
  neighborColors.add(siblingColor);

  // Check all adjacent cells (including diagonals for better dispersion)
  const neighbors = [
    [row - 1, col - 1], [row - 1, col], [row - 1, col + 1],
    [row, col - 1],                     [row, col + 1],
    [row + 1, col - 1], [row + 1, col], [row + 1, col + 1],
  ];

  for (const [r, c] of neighbors) {
    if (r >= 0 && r < grid.length && c >= 0 && c < grid[0].length) {
      const color = grid[r][c];
      if (color !== -1) {
        neighborColors.add(color);
      }
    }
  }

  // Find available colors
  const availableColors: number[] = [];
  for (let i = 0; i < numColors; i++) {
    if (!neighborColors.has(i)) {
      availableColors.push(i);
    }
  }

  // If all colors are used by neighbors, pick randomly but avoid sibling
  if (availableColors.length === 0) {
    const colors: number[] = [];
    for (let i = 0; i < numColors; i++) {
      if (i !== siblingColor) {
        colors.push(i);
      }
    }
    return colors.length > 0
      ? colors[Math.floor(Math.random() * colors.length)]
      : Math.floor(Math.random() * numColors);
  }

  // Pick randomly from available colors
  return availableColors[Math.floor(Math.random() * availableColors.length)];
}

/**
 * Apply seam allowance to all pieces
 */
export function applySeamAllowance(result: TessellationResult): TessellationResult {
  const { seamAllowance } = result.config;

  if (seamAllowance === 0) return result;

  const piecesWithSeams = result.pieces.map(piece => ({
    ...piece,
    polygon: offsetPolygon(piece.polygon, seamAllowance),
  }));

  const allPolygons = piecesWithSeams.map(p => p.polygon);
  const bounds = calculateBounds(allPolygons);

  return {
    ...result,
    pieces: piecesWithSeams,
    bounds: {
      width: bounds.maxX - bounds.minX,
      height: bounds.maxY - bounds.minY,
    },
  };
}

/**
 * Group pieces by color for separate export/nesting
 */
export function groupByColor(result: TessellationResult): Map<number, TessellationPiece[]> {
  const groups = new Map<number, TessellationPiece[]>();

  for (const piece of result.pieces) {
    const existing = groups.get(piece.colorIndex) || [];
    existing.push(piece);
    groups.set(piece.colorIndex, existing);
  }

  return groups;
}
