import { Polygon, Point } from './types';

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
  _diagonal: 'tl-br' | 'tr-bl' = 'tl-br'
): [Polygon, Polygon] {
  return splitRectangle(square, 0);
}

/**
 * Simple polygon offset for seam allowances
 * Moves each edge perpendicular outward by offset distance
 * Finds intersection points of adjacent offset edges
 */
export function offsetPolygon(polygon: Polygon, offset: number): Polygon {
  if (offset === 0) return polygon;

  const n = polygon.length;
  const result: Point[] = [];

  console.log('offsetPolygon input:', JSON.stringify(polygon));

  // Determine if polygon is clockwise or counterclockwise
  // This affects which direction is "outward"
  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += polygon[i].x * polygon[j].y;
    area -= polygon[j].x * polygon[i].y;
  }
  const isClockwise = area < 0;

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

    if (len1 < 0.0001 || len2 < 0.0001) {
      // Degenerate edge, skip
      continue;
    }

    edge1.x /= len1;
    edge1.y /= len1;
    edge2.x /= len2;
    edge2.y /= len2;

    // Get perpendiculars pointing OUTWARD (away from polygon interior)
    // For clockwise polygons: outward is counterclockwise perpendicular (-y, x)
    // For counterclockwise polygons: outward is clockwise perpendicular (y, -x)
    let perp1, perp2;
    if (isClockwise) {
      perp1 = { x: -edge1.y, y: edge1.x };
      perp2 = { x: -edge2.y, y: edge2.x };
    } else {
      perp1 = { x: edge1.y, y: -edge1.x };
      perp2 = { x: edge2.y, y: -edge2.x };
    }

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

      // Limit how far the intersection can be from the original vertex
      // This prevents extreme spikes at acute angles
      const maxDistance = offset * 10; // Allow miter up to 10x offset
      const intersection = {
        x: p1.x + t * d1.x,
        y: p1.y + t * d1.y
      };

      const distFromCurr = Math.sqrt(
        (intersection.x - curr.x) ** 2 +
        (intersection.y - curr.y) ** 2
      );

      if (distFromCurr <= maxDistance) {
        result.push(intersection);
      } else {
        // Clip the miter - use a bevel instead
        result.push(p2);
        result.push(p3);
      }
    } else {
      // Lines are parallel (shouldn't happen often), use average
      result.push({
        x: (p2.x + p3.x) / 2,
        y: (p2.y + p3.y) / 2
      });
    }
  }

  console.log('offsetPolygon output:', JSON.stringify(result));
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
