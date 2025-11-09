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
 * Simple polygon offset for quilting seam allowances
 * Moves each edge outward perpendicular to itself by the offset amount
 * Then finds the intersection points of adjacent offset edges
 */
export function offsetPolygon(polygon: Polygon, offset: number): Polygon {
  if (offset === 0) return polygon;

  const n = polygon.length;
  const result: Point[] = [];

  // For each vertex, calculate where the two adjacent offset edges intersect
  for (let i = 0; i < n; i++) {
    const curr = polygon[i];
    const next = polygon[(i + 1) % n];
    const prev = polygon[(i - 1 + n) % n];

    // Get the two edges adjacent to this vertex
    const edge1 = { x: curr.x - prev.x, y: curr.y - prev.y };
    const edge2 = { x: next.x - curr.x, y: next.y - curr.y };

    // Normalize the edges
    const len1 = Math.sqrt(edge1.x * edge1.x + edge1.y * edge1.y);
    const len2 = Math.sqrt(edge2.x * edge2.x + edge2.y * edge2.y);
    edge1.x /= len1;
    edge1.y /= len1;
    edge2.x /= len2;
    edge2.y /= len2;

    // Get perpendiculars pointing outward (rotate 90° counterclockwise for outward normal)
    const perp1 = { x: -edge1.y, y: edge1.x };
    const perp2 = { x: -edge2.y, y: edge2.x };

    // Move the edges outward by offset amount
    // Edge 1 goes from (prev + perp1*offset) to (curr + perp1*offset)
    // Edge 2 goes from (curr + perp2*offset) to (next + perp2*offset)

    // Points on the offset edges
    const p1 = { x: prev.x + perp1.x * offset, y: prev.y + perp1.y * offset };
    const p2 = { x: curr.x + perp1.x * offset, y: curr.y + perp1.y * offset };
    const p3 = { x: curr.x + perp2.x * offset, y: curr.y + perp2.y * offset };
    const p4 = { x: next.x + perp2.x * offset, y: next.y + perp2.y * offset };

    // Find intersection of the two offset edges
    // Line 1: p1 + t * (p2 - p1)
    // Line 2: p3 + s * (p4 - p3)
    const d1 = { x: p2.x - p1.x, y: p2.y - p1.y };
    const d2 = { x: p4.x - p3.x, y: p4.y - p3.y };

    // Solve for intersection
    const denom = d1.x * d2.y - d1.y * d2.x;

    if (Math.abs(denom) > 0.0001) {
      // Lines intersect
      const t = ((p3.x - p1.x) * d2.y - (p3.y - p1.y) * d2.x) / denom;
      result.push({
        x: p1.x + t * d1.x,
        y: p1.y + t * d1.y
      });
    } else {
      // Lines are parallel (shouldn't happen often), use average
      result.push({
        x: (p2.x + p3.x) / 2,
        y: (p2.y + p3.y) / 2
      });
    }
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
