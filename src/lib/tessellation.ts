import { TessellationConfig, TessellationResult, TessellationPiece } from './types';
import { createRectangle, splitRectangle, offsetPolygon, calculateBounds } from './geometry';

/**
 * Generate a brick-pattern tessellation with random color assignment,
 * variable widths, and optional splitting
 */
export function generateTessellation(config: TessellationConfig): TessellationResult {
  const { rows, cols, squareSize, colors, splitProbability, offsetAmount, widthVariation, heightVariation, splitAngleVariation, sameColorProbability, colorProbabilities } = config;

  // STEP 1: Generate variable widths for each row
  const widths: number[][] = [];
  for (let row = 0; row < rows; row++) {
    widths[row] = generateRowWidths(cols, squareSize, widthVariation);
  }

  // STEP 1b: Generate variable heights for each row
  const heights = generateRowHeights(rows, squareSize, heightVariation);

  // STEP 2: Create all polygons (without colors yet)
  const pieces: TessellationPiece[] = [];

  // Track cumulative Y position for variable heights
  let cumulativeY = 0;

  for (let row = 0; row < rows; row++) {
    let cumulativeX = 0;
    const height = heights[row];
    let pieceCol = 0; // Track piece column index (increments for each piece, not grid cell)

    for (let col = 0; col < cols; col++) {
      // Calculate position with brick offset
      const offsetX = (row % 2) * offsetAmount * squareSize;
      const x = cumulativeX + offsetX;
      const y = cumulativeY;
      const width = widths[row][col];

      const shouldSplit = Math.random() < splitProbability;
      const rect = createRectangle(x, y, width, height);

      if (shouldSplit) {
        const [piece1, piece2] = splitRectangle(rect, splitAngleVariation);

        pieces.push({
          id: `r${row}-c${col}-left`,
          polygon: piece1,
          colorIndex: -1, // Assign later
          isTriangle: splitAngleVariation === 0,
          row,
          col: pieceCol++, // Assign sequential col for first piece
          position: 'top',
        });

        pieces.push({
          id: `r${row}-c${col}-right`,
          polygon: piece2,
          colorIndex: -1, // Assign later
          isTriangle: splitAngleVariation === 0,
          row,
          col: pieceCol++, // Assign sequential col for second piece
          position: 'bottom',
        });
      } else {
        pieces.push({
          id: `r${row}-c${col}-full`,
          polygon: rect,
          colorIndex: -1, // Assign later
          isTriangle: false,
          row,
          col: pieceCol++, // Assign sequential col
          position: 'full',
        });
      }

      cumulativeX += width;
    }

    cumulativeY += height;
  }

  // STEP 3: Assign colors based on actual polygon adjacency
  assignColorsToPolygons(pieces, colors, sameColorProbability, colorProbabilities);

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
 * Assign colors to all polygons based on actual adjacency
 * Two polygons are adjacent if they share an edge
 * @param sameColorProbability - probability (0-1) that same colors can be adjacent
 * @param colorProbabilities - array of desired percentages (0-100) for each color
 */
function assignColorsToPolygons(
  pieces: TessellationPiece[],
  numColors: number,
  sameColorProbability: number,
  colorProbabilities: number[]
): void {
  // Process pieces row by row, left to right
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    const forbiddenColors = new Set<number>();

    // Check all previously colored pieces to see if they're adjacent
    for (let j = 0; j < i; j++) {
      const otherPiece = pieces[j];

      // Skip if other piece doesn't have a color yet
      if (otherPiece.colorIndex === -1) continue;

      // Check if pieces share an edge
      if (sharesEdge(piece.polygon, otherPiece.polygon)) {
        // With sameColorProbability chance, allow this color anyway
        if (Math.random() > sameColorProbability) {
          forbiddenColors.add(otherPiece.colorIndex);
        }
      }
    }

    // Find available colors (those not forbidden)
    const availableColors: number[] = [];
    for (let c = 0; c < numColors; c++) {
      if (!forbiddenColors.has(c)) {
        availableColors.push(c);
      }
    }

    // Assign a weighted random color from available colors
    if (availableColors.length > 0) {
      piece.colorIndex = weightedRandomColor(availableColors, colorProbabilities);
    } else {
      // Fallback: if all colors are forbidden (shouldn't happen with 3+ colors), pick randomly
      piece.colorIndex = Math.floor(Math.random() * numColors);
    }
  }
}

/**
 * Select a random color from available colors using weighted probabilities
 */
function weightedRandomColor(availableColors: number[], colorProbabilities: number[]): number {
  // Get weights for available colors only
  const weights = availableColors.map(c => colorProbabilities[c] || 0);

  // Calculate total weight
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  // If all weights are 0, use uniform distribution
  if (totalWeight === 0) {
    return availableColors[Math.floor(Math.random() * availableColors.length)];
  }

  // Pick a random number between 0 and totalWeight
  let random = Math.random() * totalWeight;

  // Find which color this falls into
  for (let i = 0; i < availableColors.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return availableColors[i];
    }
  }

  // Fallback (shouldn't reach here due to floating point)
  return availableColors[availableColors.length - 1];
}

/**
 * Check if two polygons share an edge (are adjacent)
 * Two polygons share an edge if they have at least 2 consecutive points in common
 */
function sharesEdge(poly1: TessellationPiece['polygon'], poly2: TessellationPiece['polygon']): boolean {
  const tolerance = 0.01; // Small tolerance for floating point comparison

  // Helper to check if two points are the same
  const samePoint = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
    return Math.abs(p1.x - p2.x) < tolerance && Math.abs(p1.y - p2.y) < tolerance;
  };

  // Count how many points from poly1 are in poly2
  let sharedPoints = 0;
  for (const p1 of poly1) {
    for (const p2 of poly2) {
      if (samePoint(p1, p2)) {
        sharedPoints++;
        break;
      }
    }
  }

  // Two polygons share an edge if they have at least 2 points in common
  return sharedPoints >= 2;
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
 * Generate variable heights for each row
 * Returns an array of heights that maintains the overall total height
 */
function generateRowHeights(rows: number, baseSize: number, variation: number): number[] {
  if (variation === 0) {
    return new Array(rows).fill(baseSize);
  }

  const heights: number[] = [];
  const targetTotal = rows * baseSize;

  // Generate random variations
  for (let i = 0; i < rows; i++) {
    // Random factor between (1 - variation) and (1 + variation)
    const factor = 1 + (Math.random() * 2 - 1) * variation;
    heights.push(baseSize * factor);
  }

  // Normalize to maintain target total height
  const currentTotal = heights.reduce((sum, h) => sum + h, 0);
  const scale = targetTotal / currentTotal;

  return heights.map(h => h * scale);
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
