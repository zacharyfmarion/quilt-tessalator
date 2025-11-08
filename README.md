# Quilted Denim Tessellation Generator

A TypeScript/React web app for generating brick-pattern tessellations with multiple fabric colors, designed for laser-cutting quilted denim garments (jackets, pants, etc.).

## Features

- **Brick Pattern Layout**: Generates offset rows (like brickwork) for visual interest
- **Variable Width Rectangles**: Each row has randomly varied widths while maintaining overall dimensions
- **N-Color Assignment**: Supports 2-5 different fabric colors with intelligent neighbor-avoiding algorithm
- **Flexible Splitting**: Split rectangles into triangles (diagonal) or quadrilaterals (angled cuts)
- **Configurable Split Angles**: Control how much the split deviates from 45° for varied shapes
- **Configurable Seam Allowance**: Add any seam allowance (default: 1/4" / 6.35mm)
- **Interactive Preview**: Real-time visualization with adjustable parameters
- **SVG Export**: Export full pattern or separate files per fabric color for laser cutting
- **Unit Scaling**: All measurements in millimeters with clear scaling for cutting

## Getting Started

### Installation

```bash
pnpm install
```

### Development

```bash
pnpm dev
```

Open [http://localhost:5173/](http://localhost:5173/) in your browser.

### Build

```bash
pnpm build
```

## Usage

### Controls

**Grid Settings**
- **Rows**: Number of horizontal rows (2-20)
- **Columns**: Number of vertical columns (2-20)
- **Square Size**: Base size of each rectangle in mm (20-100mm)
- **Brick Offset**: How much each row offsets (0-100%, default 50% for classic brick)
- **Width Variation**: How much rectangle widths vary within each row (0-100%)

**Colors & Patterns**
- **Number of Fabrics**: How many different fabric colors (2-5)
- **Split Probability**: Chance each rectangle gets split in two (0-100%)
- **Split Angle Variation**: Controls split style (0% = diagonal triangles, higher = angled quadrilaterals)
- **Regenerate**: Click to generate a new random color arrangement

**Seam Allowance**
- **Seam Allowance**: Add margin for sewing (0-15mm, 6.35mm = 1/4", 9.5mm = 3/8")
- **Show in Preview**: Toggle to visualize seam allowance expansion

### Export

1. **Download Full Pattern**: Complete tessellation as one SVG file
2. **By Fabric Color**: Individual SVG files for each color, optimized for laser cutting

Each color-specific SVG includes:
- All pieces for that fabric
- Piece IDs for tracking
- Cut lines (no fill, just stroke for laser)
- Metadata (piece count)

## Workflow for Laser Cutting

1. Design your pattern in the app
2. Export SVGs by color
3. (Optional) Use nesting software like [SVGNest](https://svgnest.com) to pack pieces efficiently on your fabric
4. Import to your laser cutter software
5. Cut each fabric color separately
6. Sew pieces together following the full pattern reference

## Technical Details

### File Structure

```
src/
├── lib/
│   ├── types.ts          # TypeScript interfaces
│   ├── geometry.ts       # Polygon operations & seam allowance
│   ├── tessellation.ts   # Core generation logic
│   └── svg.ts            # SVG export utilities
├── App.tsx               # Main UI component
├── App.css               # Styling
└── main.tsx              # Entry point
```

### Key Algorithms

**Color Assignment**
- Greedy algorithm that checks all 8 neighbors (including diagonals)
- Assigns random color from available non-neighboring colors
- Ensures no two adjacent cells share the same color

**Triangle Splitting**
- Each square has configurable probability of splitting into HST
- Diagonal direction randomized (top-left to bottom-right, or top-right to bottom-left)
- Both triangles maintain the same color for cohesive look

**Seam Allowance**
- Basic polygon offsetting using perpendicular normals
- Miter joints at corners
- For production, consider integrating clipper2-js for robust offsetting

## Future Enhancements

- [ ] Advanced nesting algorithm integration (auto-pack pieces by color)
- [ ] DXF export for broader laser cutter compatibility
- [ ] More tessellation patterns (hexagons, pentagons, Islamic patterns)
- [ ] Grainline arrows on SVG export
- [ ] Fabric yardage calculator
- [ ] Save/load project configurations

## Design Inspiration

This tool was created for quilted denim garments inspired by patchwork styles, like quilted jackets with mixed light denim, dark denim, and corduroy panels.

## License

MIT
