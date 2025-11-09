import { useState, useMemo } from 'react';
import { TessellationConfig } from './lib/types';
import { generateTessellation, applySeamAllowance, groupByColor } from './lib/tessellation';
import { generateFullSVG, generateColorSVG, downloadSVG } from './lib/svg';
import { packPolygons, generatePackedSVG, PackedResult } from './lib/packing';
import './App.css';

/**
 * Generate a random, visually distinct color
 */
const generateRandomColor = (): string => {
  const hue = Math.floor(Math.random() * 360);
  const saturation = 40 + Math.floor(Math.random() * 40); // 40-80%
  const lightness = 40 + Math.floor(Math.random() * 20); // 40-60%
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

/**
 * Generate initial color palette based on count
 * Uses nice default denim colors for first 3, then generates random colors
 */
const generateInitialPalette = (count: number): string[] => {
  const defaults = ['#4A90E2', '#2C3E50', '#1A1F3A'];
  const palette = defaults.slice(0, Math.min(count, defaults.length));

  while (palette.length < count) {
    palette.push(generateRandomColor());
  }
  return palette;
};

/**
 * Generate equal probability distribution for N colors
 */
const generateEqualProbabilities = (count: number): number[] => {
  const base = Math.floor(10000 / count) / 100;
  const probs = Array(count).fill(base);
  probs[count - 1] = 100 - (base * (count - 1));
  return probs;
};

const DEFAULT_COLORS = 3;

const DEFAULT_CONFIG: TessellationConfig = {
  rows: 8,
  cols: 10,
  squareSize: 50, // mm
  colors: DEFAULT_COLORS,
  splitProbability: 0.4,
  seamAllowance: 6.35, // 1/4 inch in mm
  offsetAmount: 0.5, // brick pattern offset
  widthVariation: 0.3, // 30% width variation
  heightVariation: 0.2, // 20% height variation
  splitAngleVariation: 0.5, // moderate angle variation
  sameColorProbability: 0.1, // 10% chance of same color adjacency
  colorProbabilities: generateEqualProbabilities(DEFAULT_COLORS),
};

const getColorName = (index: number) => `Color ${index + 1}`;

interface CollapsibleSectionProps {
  title: string;
  isCollapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function CollapsibleSection({ title, isCollapsed, onToggle, children }: CollapsibleSectionProps) {
  return (
    <section className={isCollapsed ? 'collapsed' : ''}>
      <h2 onClick={onToggle}>
        {title}
        <span className="collapse-icon">{isCollapsed ? '▶' : '▼'}</span>
      </h2>
      {!isCollapsed && <div className="section-content">{children}</div>}
    </section>
  );
}

type ViewTab = 'full' | `color-${number}`;

function App() {
  const [config, setConfig] = useState<TessellationConfig>(DEFAULT_CONFIG);
  const [showSeamAllowance, setShowSeamAllowance] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [palette, setPalette] = useState<string[]>(() => generateInitialPalette(DEFAULT_COLORS));
  const [packingSpacing, setPackingSpacing] = useState(3); // mm
  const [activeTab, setActiveTab] = useState<ViewTab>('full');

  // Generate base tessellation (without seam allowance)
  const baseTessellation = useMemo(() => {
    return generateTessellation(config);
  }, [config]);

  // Apply seam allowance if needed (doesn't regenerate the pattern)
  const tessellation = useMemo(() => {
    return showSeamAllowance ? applySeamAllowance(baseTessellation) : baseTessellation;
  }, [baseTessellation, showSeamAllowance]);

  const svg = useMemo(() => {
    return generateFullSVG(tessellation, palette, {
      showSeamAllowance,
      units: 'mm',
    });
  }, [tessellation, palette, showSeamAllowance]);

  const colorGroups = useMemo(() => {
    return groupByColor(tessellation);
  }, [tessellation]);

  // Generate packed layouts for each color
  const packedLayouts = useMemo(() => {
    const layouts = new Map<number, PackedResult>();

    colorGroups.forEach((pieces, colorIndex) => {
      const packed = packPolygons(pieces, config.seamAllowance, packingSpacing);
      layouts.set(colorIndex, packed);
    });

    return layouts;
  }, [colorGroups, config.seamAllowance, packingSpacing]);

  const updateConfig = (partial: Partial<TessellationConfig>) => {
    setConfig(prev => {
      const newConfig = { ...prev, ...partial };

      // If colors changed, dynamically adjust palette and probabilities
      if (partial.colors !== undefined && partial.colors !== prev.colors) {
        let newPalette = [...palette];
        let newProbs = [...newConfig.colorProbabilities];

        if (partial.colors > prev.colors) {
          // Adding colors: generate new random colors and probabilities
          const toAdd = partial.colors - prev.colors;
          for (let i = 0; i < toAdd; i++) {
            newPalette.push(generateRandomColor());
            newProbs.push(100 / partial.colors); // equal share initially
          }
        } else {
          // Removing colors: slice arrays to new size
          newPalette = newPalette.slice(0, partial.colors);
          newProbs = newProbs.slice(0, partial.colors);
        }

        // Renormalize all probabilities to sum to 100%
        const total = newProbs.reduce((sum, p) => sum + p, 0);
        if (total > 0) {
          newProbs = newProbs.map(p => (p / total) * 100);
        }

        setPalette(newPalette);
        newConfig.colorProbabilities = newProbs;
      }

      return newConfig;
    });
  };

  const updateColorProbability = (colorIndex: number, value: number) => {
    const newProbabilities = [...config.colorProbabilities];
    newProbabilities[colorIndex] = value;

    // Normalize only the active colors to sum to 100
    const activeProbs = newProbabilities.slice(0, config.colors);
    const total = activeProbs.reduce((sum, p) => sum + p, 0);

    if (total > 0) {
      for (let i = 0; i < config.colors; i++) {
        newProbabilities[i] = (newProbabilities[i] / total) * 100;
      }
      updateConfig({ colorProbabilities: newProbabilities });
    }
  };

  const handleDownloadCurrent = () => {
    if (activeTab === 'full') {
      downloadSVG(svg, 'tessellation-full.svg');
    } else {
      const colorIndex = parseInt(activeTab.split('-')[1]);
      const packed = packedLayouts.get(colorIndex);
      if (!packed) return;

      const packedSvg = generatePackedSVG(packed, getColorName(colorIndex), {
        units: 'mm'
      });
      downloadSVG(packedSvg, `tessellation-${getColorName(colorIndex).toLowerCase().replace(' ', '-')}-packed.svg`);
    }
  };

  const handleDownloadByColor = (colorIndex: number) => {
    const pieces = colorGroups.get(colorIndex);
    if (!pieces) return;

    const colorName = getColorName(colorIndex);
    const colorSvg = generateColorSVG(pieces, colorName, { units: 'mm' });
    downloadSVG(colorSvg, `tessellation-${colorName.toLowerCase().replace(' ', '-')}.svg`);
  };

  const updatePaletteColor = (colorIndex: number, newColor: string) => {
    const newPalette = [...palette];
    newPalette[colorIndex] = newColor;
    setPalette(newPalette);
  };

  const handleRegenerateTessellation = () => {
    // Force regeneration by creating new config object
    setConfig({ ...config });
  };

  const toggleSection = (sectionName: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName]
    }));
  };

  return (
    <div className="app">
      <header>
        <h1>Quilted Tessellation Generator</h1>
      </header>

      <div className="container">
        <aside className="controls">
          <div className="controls-scrollable">
            <CollapsibleSection
              title="Grid Settings"
              isCollapsed={!!collapsedSections['grid']}
              onToggle={() => toggleSection('grid')}
            >
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
            </CollapsibleSection>

            <CollapsibleSection
              title="Colors & Patterns"
              isCollapsed={!!collapsedSections['colors']}
              onToggle={() => toggleSection('colors')}
            >
              <label>
                Number of Colors: {config.colors}
                <input
                  type="range"
                  min="2"
                  max="5"
                  value={config.colors}
                  onChange={(e) => updateConfig({ colors: parseInt(e.target.value) })}
                />
              </label>

              <h3>Color Probabilities:</h3>
              {Array.from({ length: config.colors }, (_, i) => (
                <div key={i} style={{ marginBottom: '1rem' }}>
                  <label>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <input
                        type="color"
                        value={palette[i]}
                        onChange={(e) => updatePaletteColor(i, e.target.value)}
                        style={{
                          width: '24px',
                          height: '24px',
                          border: '1px solid #ccc',
                          borderRadius: '3px',
                          cursor: 'pointer'
                        }}
                      />
                      {getColorName(i)}: {config.colorProbabilities[i].toFixed(1)}%
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={config.colorProbabilities[i]}
                      onChange={(e) => updateColorProbability(i, parseFloat(e.target.value))}
                    />
                  </label>
                </div>
              ))}
              <small style={{ display: 'block', marginTop: '0.5rem', fontStyle: 'italic' }}>
                Total: {config.colorProbabilities.slice(0, config.colors).reduce((sum, p) => sum + p, 0).toFixed(1)}%
                (auto-normalized to 100%)
              </small>

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
            </CollapsibleSection>

            <CollapsibleSection
              title="Seam Allowance"
              isCollapsed={!!collapsedSections['seam']}
              onToggle={() => toggleSection('seam')}
            >
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

              <label>
                Packing Spacing: {packingSpacing.toFixed(1)} mm
                <input
                  type="range"
                  min="1"
                  max="20"
                  step="0.5"
                  value={packingSpacing}
                  onChange={(e) => setPackingSpacing(parseFloat(e.target.value))}
                />
                <small>Space between pieces when packing for laser cutting</small>
              </label>
            </CollapsibleSection>

            <CollapsibleSection
              title="Statistics"
              isCollapsed={!!collapsedSections['stats']}
              onToggle={() => toggleSection('stats')}
            >
              <p><strong>Total Pieces:</strong> {tessellation.pieces.length}</p>
              <p><strong>Dimensions:</strong> {tessellation.bounds.width.toFixed(1)} × {tessellation.bounds.height.toFixed(1)} mm</p>
              <p><strong>Triangles:</strong> {tessellation.pieces.filter(p => p.isTriangle).length}</p>
              <p><strong>Squares:</strong> {tessellation.pieces.filter(p => !p.isTriangle).length}</p>
            </CollapsibleSection>
          </div>

          <div className="controls-footer">
            <button onClick={handleRegenerateTessellation} className="regenerate-btn">
              🎲 Regenerate Pattern
            </button>

            <button onClick={handleDownloadCurrent} className="export-btn">
              📥 Download {activeTab === 'full' ? 'Full Pattern' : 'Current Packing'}
            </button>

            <div className="color-exports">
              <h3>By Color:</h3>
              {Array.from(colorGroups.entries()).map(([colorIndex, pieces]) => (
                <button
                  key={colorIndex}
                  onClick={() => handleDownloadByColor(colorIndex)}
                  className="color-export-btn"
                  style={{ backgroundColor: palette[colorIndex] }}
                >
                  {getColorName(colorIndex)} ({pieces.length} pieces)
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="preview">
          <div className="preview-tabs">
            <button
              className={activeTab === 'full' ? 'tab active' : 'tab'}
              onClick={() => setActiveTab('full')}
            >
              Full Pattern
            </button>
            {Array.from(colorGroups.keys()).map(colorIndex => (
              <button
                key={colorIndex}
                className={activeTab === `color-${colorIndex}` ? 'tab active' : 'tab'}
                onClick={() => setActiveTab(`color-${colorIndex}` as ViewTab)}
                style={{ borderBottomColor: palette[colorIndex] }}
              >
                {getColorName(colorIndex)} Packing
              </button>
            ))}
          </div>

          <div className="preview-content">
            {activeTab === 'full' ? (
              <div className="svg-container" dangerouslySetInnerHTML={{ __html: svg }} />
            ) : (
              (() => {
                const colorIndex = parseInt(activeTab.split('-')[1]);
                const packed = packedLayouts.get(colorIndex);
                if (!packed) return null;

                const packedSvg = generatePackedSVG(packed, getColorName(colorIndex), {
                  units: 'mm'
                });

                return <div className="svg-container" dangerouslySetInnerHTML={{ __html: packedSvg }} />;
              })()
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
