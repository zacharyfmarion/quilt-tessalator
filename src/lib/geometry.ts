import { Point, Polygon } from './types';

/**
 * Create a rectangle polygon
 */
export function createRectangle(x: number, y: number, width: number, height: number): Polygon {
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
}

/**
 * Create a square polygon (convenience function)
 */
export function createSquare(x: number, y: number, size: number): Polygon {
  return createRectangle(x, y, size, size);
}

/**
 * Split a rectangle into two polygons with a variable-angle cut
 * @param angleVariation 0-1, how much the split deviates from 45° (0 = diagonal, 1 = max deviation)
 * Creates two quadrilaterals when angleVariation > 0
 */
export function splitRectangle(
  rect: Polygon,
  angleVariation: number = 0
): [Polygon, Polygon] {
  const [tl, tr, br, bl] = rect;

  // Calculate rectangle dimensions
  const width = tr.x - tl.x;
  const height = bl.y - tl.y;

  // If no variation, do a simple diagonal split
  if (angleVariation === 0) {
    const diagonal = Math.random() < 0.5 ? 'tl-br' : 'tr-bl';
    if (diagonal === 'tl-br') {
      return [
        [tl, tr, br], // top triangle
        [tl, br, bl], // bottom triangle
      ];
    } else {
      return [
        [tl, tr, bl], // top triangle
        [tr, br, bl], // bottom triangle
      ];
    }
  }

  // With variation, create two quadrilaterals
  // Pick a random point on top edge and bottom edge
  const maxDeviation = angleVariation * 0.8; // Scale to reasonable range

  // Top edge: pick a point between 20% and 80% of width (with variation)
  const topT = 0.5 + (Math.random() - 0.5) * maxDeviation;
  const topPoint = {
    x: tl.x + width * Math.max(0.1, Math.min(0.9, topT)),
    y: tl.y
  };

  // Bottom edge: pick a point with some correlation to top (for more interesting cuts)
  const bottomT = 0.5 + (Math.random() - 0.5) * maxDeviation;
  const bottomPoint = {
    x: bl.x + width * Math.max(0.1, Math.min(0.9, bottomT)),
    y: bl.y
  };

  // Create two quadrilaterals (left and right pieces)
  const leftPoly = [tl, topPoint, bottomPoint, bl];
  const rightPoly = [topPoint, tr, br, bottomPoint];

  return [leftPoly, rightPoly];
}

/**
 * Legacy function name for backwards compatibility
 */
export function splitSquareIntoTriangles(
  square: Polygon,
  diagonal: 'tl-br' | 'tr-bl' = 'tl-br'
): [Polygon, Polygon] {
  return splitRectangle(square, 0);
}

/**
 * Simple polygon offset (expand/contract)
 * This is a basic implementation - for production, use clipper2-js
 */
export function offsetPolygon(polygon: Polygon, offset: number): Polygon {
  if (offset === 0) return polygon;

  // For convex polygons (our squares and triangles), we can use a simple approach
  // Move each point outward perpendicular to its edges
  const result: Point[] = [];
  const n = polygon.length;

  for (let i = 0; i < n; i++) {
    const prev = polygon[(i - 1 + n) % n];
    const curr = polygon[i];
    const next = polygon[(i + 1) % n];

    // Get edge vectors
    const v1 = { x: curr.x - prev.x, y: curr.y - prev.y };
    const v2 = { x: next.x - curr.x, y: next.y - curr.y };

    // Normalize
    const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    v1.x /= len1; v1.y /= len1;
    v2.x /= len2; v2.y /= len2;

    // Get perpendiculars (outward normals)
    const n1 = { x: -v1.y, y: v1.x };
    const n2 = { x: -v2.y, y: v2.x };

    // Average normal at corner
    const avgNormal = {
      x: (n1.x + n2.x) / 2,
      y: (n1.y + n2.y) / 2,
    };

    // Normalize
    const avgLen = Math.sqrt(avgNormal.x * avgNormal.x + avgNormal.y * avgNormal.y);
    avgNormal.x /= avgLen;
    avgNormal.y /= avgLen;

    // Calculate miter length (to maintain offset distance)
    const sinHalfAngle = Math.sqrt((1 - (n1.x * n2.x + n1.y * n2.y)) / 2);
    const miterLength = sinHalfAngle > 0.01 ? offset / sinHalfAngle : offset;

    result.push({
      x: curr.x + avgNormal.x * miterLength,
      y: curr.y + avgNormal.y * miterLength,
    });
  }

  return result;
}

/**
 * Calculate the bounds of a set of polygons
 */
export function calculateBounds(polygons: Polygon[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const poly of polygons) {
    for (const point of poly) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }

  return { minX, minY, maxX, maxY };
}
