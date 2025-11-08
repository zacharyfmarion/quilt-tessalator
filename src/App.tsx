import { useState, useMemo } from 'react';
import { TessellationConfig } from './lib/types';
import { generateTessellation, applySeamAllowance, groupByColor } from './lib/tessellation';
import { generateFullSVG, generateColorSVG, downloadSVG } from './lib/svg';
import './App.css';

const DEFAULT_CONFIG: TessellationConfig = {
  rows: 8,
  cols: 10,
  squareSize: 50, // mm
  colors: 3,
  splitProbability: 0.4,
  seamAllowance: 6.35, // 1/4 inch in mm
  offsetAmount: 0.5, // brick pattern offset
  widthVariation: 0.3, // 30% width variation
  heightVariation: 0.2, // 20% height variation
  splitAngleVariation: 0.5, // moderate angle variation
  sameColorProbability: 0.1, // 10% chance of same color adjacency
};

const DEFAULT_PALETTE = [
  '#4A90E2', // light denim blue
  '#2C3E50', // dark denim
  '#1A1F3A', // even darker blue
  '#E74C3C', // additional color
  '#27AE60', // additional color
];

const FABRIC_NAMES = [
  'Light Denim',
  'Dark Denim',
  'Darker Denim',
  'Fabric 4',
  'Fabric 5',
];

function App() {
  const [config, setConfig] = useState<TessellationConfig>(DEFAULT_CONFIG);
  const [showSeamAllowance, setShowSeamAllowance] = useState(false);

  // Generate tessellation
  const tessellation = useMemo(() => {
    const base = generateTessellation(config);
    return showSeamAllowance ? applySeamAllowance(base) : base;
  }, [config, showSeamAllowance]);

  const svg = useMemo(() => {
    return generateFullSVG(tessellation, DEFAULT_PALETTE, {
      showSeamAllowance,
      units: 'mm',
    });
  }, [tessellation, showSeamAllowance]);

  const colorGroups = useMemo(() => {
    return groupByColor(tessellation);
  }, [tessellation]);

  const updateConfig = (partial: Partial<TessellationConfig>) => {
    setConfig(prev => ({ ...prev, ...partial }));
  };

  const handleDownloadAll = () => {
    downloadSVG(svg, 'tessellation-full.svg');
  };

  const handleDownloadByColor = (colorIndex: number) => {
    const pieces = colorGroups.get(colorIndex);
    if (!pieces) return;

    const fabricName = FABRIC_NAMES[colorIndex];
    const colorSvg = generateColorSVG(pieces, fabricName, { units: 'mm' });
    downloadSVG(colorSvg, `tessellation-${fabricName.toLowerCase().replace(' ', '-')}.svg`);
  };

  const handleRegenerateTessellation = () => {
    // Force regeneration by creating new config object
    setConfig({ ...config });
  };

  return (
    <div className="app">
      <header>
        <h1>Quilted Denim Tessellation Generator</h1>
        <p>Create brick-pattern tessellations for laser-cut quilted garments</p>
      </header>

      <div className="container">
        <aside className="controls">
          <section>
            <h2>Grid Settings</h2>
            <label>
              Rows: {config.rows}
              <input
                type="range"
                min="2"
                max="20"
                value={config.rows}
                onChange={(e) => updateConfig({ rows: parseInt(e.target.value) })}
              />
            </label>

            <label>
              Columns: {config.cols}
              <input
                type="range"
                min="2"
                max="20"
                value={config.cols}
                onChange={(e) => updateConfig({ cols: parseInt(e.target.value) })}
              />
            </label>

            <label>
              Square Size: {config.squareSize} mm
              <input
                type="range"
                min="20"
                max="100"
                value={config.squareSize}
                onChange={(e) => updateConfig({ squareSize: parseInt(e.target.value) })}
              />
            </label>

            <label>
              Brick Offset: {(config.offsetAmount * 100).toFixed(0)}%
              <input
                type="range"
                min="0"
                max="100"
                value={config.offsetAmount * 100}
                onChange={(e) => updateConfig({ offsetAmount: parseInt(e.target.value) / 100 })}
              />
            </label>

            <label>
              Width Variation: {(config.widthVariation * 100).toFixed(0)}%
              <input
                type="range"
                min="0"
                max="100"
                value={config.widthVariation * 100}
                onChange={(e) => updateConfig({ widthVariation: parseInt(e.target.value) / 100 })}
              />
              <small>How much rectangle widths vary within each row</small>
            </label>

            <label>
              Height Variation: {(config.heightVariation * 100).toFixed(0)}%
              <input
                type="range"
                min="0"
                max="100"
                value={config.heightVariation * 100}
                onChange={(e) => updateConfig({ heightVariation: parseInt(e.target.value) / 100 })}
              />
              <small>How much row heights vary</small>
            </label>
          </section>

          <section>
            <h2>Colors & Patterns</h2>
            <label>
              Number of Fabrics: {config.colors}
              <input
                type="range"
                min="2"
                max="5"
                value={config.colors}
                onChange={(e) => updateConfig({ colors: parseInt(e.target.value) })}
              />
            </label>

            <label>
              Split Probability: {(config.splitProbability * 100).toFixed(0)}%
              <input
                type="range"
                min="0"
                max="100"
                value={config.splitProbability * 100}
                onChange={(e) => updateConfig({ splitProbability: parseInt(e.target.value) / 100 })}
              />
              <small>Chance each rectangle gets split in two</small>
            </label>

            <label>
              Split Angle Variation: {(config.splitAngleVariation * 100).toFixed(0)}%
              <input
                type="range"
                min="0"
                max="100"
                value={config.splitAngleVariation * 100}
                onChange={(e) => updateConfig({ splitAngleVariation: parseInt(e.target.value) / 100 })}
              />
              <small>0% = diagonal triangles, higher = angled quadrilaterals</small>
            </label>

            <label>
              Same Color Adjacency: {(config.sameColorProbability * 100).toFixed(0)}%
              <input
                type="range"
                min="0"
                max="100"
                value={config.sameColorProbability * 100}
                onChange={(e) => updateConfig({ sameColorProbability: parseInt(e.target.value) / 100 })}
              />
              <small>Chance that same colors can touch (0% = never, 100% = always)</small>
            </label>

            <button onClick={handleRegenerateTessellation} className="regenerate-btn">
              🎲 Regenerate Pattern
            </button>
          </section>

          <section>
            <h2>Seam Allowance</h2>
            <label>
              Seam Allowance: {config.seamAllowance.toFixed(2)} mm
              <input
                type="range"
                min="0"
                max="15"
                step="0.1"
                value={config.seamAllowance}
                onChange={(e) => updateConfig({ seamAllowance: parseFloat(e.target.value) })}
              />
              <small>6.35mm = ¼", 9.5mm = ⅜"</small>
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={showSeamAllowance}
                onChange={(e) => setShowSeamAllowance(e.target.checked)}
              />
              Show Seam Allowance in Preview
            </label>
          </section>

          <section>
            <h2>Export</h2>
            <button onClick={handleDownloadAll} className="export-btn">
              📥 Download Full Pattern
            </button>

            <h3>By Fabric Color:</h3>
            {Array.from(colorGroups.entries()).map(([colorIndex, pieces]) => (
              <button
                key={colorIndex}
                onClick={() => handleDownloadByColor(colorIndex)}
                className="color-export-btn"
                style={{ backgroundColor: DEFAULT_PALETTE[colorIndex] }}
              >
                {FABRIC_NAMES[colorIndex]} ({pieces.length} pieces)
              </button>
            ))}
          </section>

          <section className="stats">
            <h3>Statistics</h3>
            <p><strong>Total Pieces:</strong> {tessellation.pieces.length}</p>
            <p><strong>Dimensions:</strong> {tessellation.bounds.width.toFixed(1)} × {tessellation.bounds.height.toFixed(1)} mm</p>
            <p><strong>Triangles:</strong> {tessellation.pieces.filter(p => p.isTriangle).length}</p>
            <p><strong>Squares:</strong> {tessellation.pieces.filter(p => !p.isTriangle).length}</p>
          </section>
        </aside>

        <main className="preview">
          <div
            className="svg-container"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </main>
      </div>
    </div>
  );
}

export default App;
