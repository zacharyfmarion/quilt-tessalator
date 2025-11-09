# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A TypeScript/React web application for generating brick-pattern tessellations with multiple fabric colors, designed for laser-cutting quilted denim garments. Users design patterns interactively and export SVG files optimized for laser cutting.

## Commands

### Development
```bash
pnpm install      # Install dependencies
pnpm dev          # Start dev server (opens on http://localhost:5173/)
pnpm build        # Compile TypeScript and build for production
pnpm preview      # Preview production build locally
```

## Core Architecture

### Tessellation Generation Pipeline

The tessellation generation follows a three-stage pipeline in `src/lib/tessellation.ts`:

1. **Grid Generation** (`generateRowWidths`, `generateRowHeights`):
   - Generates variable-width rectangles for each row
   - Maintains overall dimensions while introducing controlled randomness via `widthVariation` and `heightVariation`
   - Applies brick offset to alternate rows for staggered pattern

2. **Piece Creation**:
   - Creates base rectangles positioned with brick offset
   - Randomly splits rectangles into two pieces based on `splitProbability`
   - Split behavior controlled by `splitAngleVariation`:
     - `0` = diagonal triangles
     - `> 0` = angled quadrilaterals (creates variable-angle cuts)

3. **Color Assignment** (`assignColorsToPolygons`):
   - Processes pieces row-by-row, left-to-right
   - Uses edge adjacency detection via `sharesEdge()` (checks for 2+ shared vertices)
   - Assigns colors using weighted random selection from `colorProbabilities`
   - Respects `sameColorProbability` to control whether adjacent pieces can share colors

### Geometry Operations (`src/lib/geometry.ts`)

**Key Functions:**
- `createRectangle()` / `createSquare()`: Basic polygon construction
- `splitRectangle(rect, angleVariation)`: Splits rectangles into triangles or quadrilaterals based on variation parameter
- `offsetPolygon(polygon, offset)`: Seam allowance implementation using perpendicular normals and miter joints
  - Calculates intersection of adjacent offset edges for clean corners
  - Used for quilting seam allowances before laser cutting

### SVG Export (`src/lib/svg.ts`)

**Export Modes:**
1. **Full Pattern** (`generateFullSVG`): Complete tessellation with colors for reference
2. **By Fabric Color** (`generateColorSVG`): Individual files per color optimized for laser cutting
   - No fill, stroke-only paths for laser cutters
   - Includes piece IDs and metadata

### Packing System (`src/lib/packing.ts`)

Currently implements simple grid-based packing as a placeholder. The `any-nest` library is installed but not yet integrated.

**Current Approach:**
- Grid-based layout with configurable spacing
- Applies seam allowance before packing
- Calculates efficiency percentage
- Generates packed SVGs with sheet boundaries

**TODO**: Replace with `any-nest` for optimized nesting.

### Data Types (`src/lib/types.ts`)

**Core Structures:**
- `TessellationPiece`: Individual polygon piece with color, ID, and position metadata
- `TessellationConfig`: All generation parameters (grid size, colors, variations, probabilities)
- `TessellationResult`: Complete output including pieces, config, and bounds

**Key Config Parameters:**
- `splitAngleVariation`: Controls split style (0 = triangles, higher = quads)
- `sameColorProbability`: Allows/prevents adjacent same-colored pieces
- `colorProbabilities`: Weighted distribution for color assignment

### UI Component (`src/App.tsx`)

Single-page React app with three main sections:
1. **Grid Settings**: Rows, columns, size, brick offset, width/height variation
2. **Colors & Patterns**: Fabric count, split probability, angle variation, color probabilities
3. **Seam Allowance**: Configurable seam allowance with preview toggle

Pattern regeneration creates new color assignments without changing geometry.

## Measurement Units

All dimensions are in millimeters (mm) for laser cutting precision. Common seam allowances:
- 6.35mm = 1/4"
- 9.5mm = 3/8"

## Development Notes

### Geometry Edge Cases

- The `offsetPolygon` function handles miter joints but may produce sharp corners at high offset values relative to piece size
- Edge adjacency detection uses 0.01mm tolerance for floating-point comparison
- Split angles are clamped to 10-90% of width to avoid degenerate polygons

### Color Assignment Algorithm

The color assignment is a greedy algorithm that:
1. Processes pieces in order (left-to-right, top-to-bottom)
2. Checks all previously colored pieces for edge adjacency
3. Maintains a forbidden set of colors from adjacent pieces
4. Selects from available colors using weighted probabilities

This ensures no backtracking and deterministic results for a given random seed.

### External Libraries

- **clipper2-js**: Installed for robust polygon offsetting (not yet utilized)
- **any-nest**: Installed for advanced packing/nesting (not yet integrated)
