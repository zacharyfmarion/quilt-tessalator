# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A TypeScript/React web application for generating brick-pattern tessellations with multiple fabric colors, designed for laser-cutting quilted garments. Users design patterns interactively, pack pieces efficiently onto fabric sheets, and export SVG files optimized for laser cutting.

**Live demo:** https://zacharyfmarion.github.io/quilt-tessalator/

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

Implements automated nesting using the `any-nest` library for efficient fabric usage.

**Features:**
- Integrates with `any-nest` for polygon nesting optimization
- Configurable spacing, sheet dimensions, and iteration count
- Progress callbacks for real-time UI updates
- Calculates and displays packing efficiency
- Generates packed SVGs with sheet boundaries and piece placement

### Data Types (`src/lib/types.ts`)

**Core Structures:**
- `TessellationPiece`: Individual polygon piece with color, ID, and position metadata
- `TessellationConfig`: All generation parameters (grid size, colors, variations, probabilities)
- `TessellationResult`: Complete output including pieces, config, and bounds

**Key Config Parameters:**
- `splitAngleVariation`: Controls split style (0 = triangles, higher = quads)
- `sameColorProbability`: Allows/prevents adjacent same-colored pieces
- `colorProbabilities`: Weighted distribution for color assignment

### UI Components

**Main App (`src/App.tsx`):**
- Single-page React app with tabbed interface
- **Full Pattern Tab**: Shows complete tessellation with all colors
- **Color Packing Tabs**: Per-color views with packing optimization
- Dark mode support with localStorage persistence
- Save/load pattern configurations via JSON files

**QuiltSidebar (`src/components/QuiltSidebar.tsx`):**
Used in the Full Pattern tab with collapsible sections:
1. **Grid Settings**: Rows, columns, size, brick offset, width/height variation
2. **Colors & Patterns**: Color count, probabilities, split settings, same-color adjacency
3. **Seam Allowance**: Configurable allowance with preview toggle

**PackingSidebar (`src/components/PackingSidebar.tsx`):**
Used in Color Packing tabs:
1. **Packing Settings**: Sheet dimensions, spacing, max iterations
2. **Actions**: Pack color button, stop packing, progress indicator
3. **Metrics**: Efficiency display, piece count

### Pattern I/O (`src/lib/pattern-io.ts`)

- **Save patterns**: Export tessellation results and config as JSON
- **Load patterns**: Import previously saved patterns
- Browser-based file download/upload using JSON format

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

- **any-nest**: 2D polygon nesting library for automated packing optimization
- **clipper2-js**: Available for robust polygon offsetting (not currently utilized; basic offsetting in geometry.ts works for typical use cases)
- **react-hot-toast**: Toast notifications for user feedback
- **lucide-react**: Icon components for UI
