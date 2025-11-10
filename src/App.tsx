import { useState, useMemo, useRef } from 'react';
import { TessellationConfig } from './lib/types';
import { generateTessellation, applySeamAllowance, groupByColor } from './lib/tessellation';
import { generateFullSVG, downloadSVG } from './lib/svg';
import { packPolygons, generatePackedSVG, PackedResult, PackingProgress } from './lib/packing';
import { AnyNest } from 'any-nest';
import { QuiltSidebar } from './components/QuiltSidebar';
import { PackingSidebar } from './components/PackingSidebar';
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

type ViewTab = 'full' | `color-${number}`;

function App() {
  const [config, setConfig] = useState<TessellationConfig>(DEFAULT_CONFIG);
  const [showSeamAllowance, setShowSeamAllowance] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [palette, setPalette] = useState<string[]>(() => generateInitialPalette(DEFAULT_COLORS));
  const [packingSpacing, setPackingSpacing] = useState(3); // mm
  const [activeTab, setActiveTab] = useState<ViewTab>('full');
  const [sheetWidth, setSheetWidth] = useState(600); // mm
  const [sheetHeight, setSheetHeight] = useState(400); // mm

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
      baseTessellation: showSeamAllowance ? baseTessellation : undefined,
      units: 'mm',
    });
  }, [tessellation, palette, showSeamAllowance, baseTessellation]);

  const colorGroups = useMemo(() => {
    return groupByColor(tessellation);
  }, [tessellation]);

  // Generate packed layouts for each color
  const [packedLayouts, setPackedLayouts] = useState<Map<number, PackedResult>>(new Map());
  const [packingProgress, setPackingProgress] = useState<Map<number, PackingProgress>>(new Map());
  const nestersRef = useRef<Map<number, AnyNest>>(new Map());

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

  // Removed - not currently used
  // const handleDownloadByColor = (_colorIndex: number) => {
  //   const pieces = colorGroups.get(_colorIndex);
  //   if (!pieces) return;

  //   const colorName = getColorName(_colorIndex);
  //   const colorSvg = generateColorSVG(pieces, colorName, { units: 'mm' });
  //   downloadSVG(colorSvg, `tessellation-${colorName.toLowerCase().replace(' ', '-')}.svg`);
  // };

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

  const handlePackColor = async (colorIndex: number) => {
    console.log('[handlePackColor] Starting pack for color:', colorIndex);
    const pieces = colorGroups.get(colorIndex);
    console.log('[handlePackColor] Pieces found:', pieces?.length);
    if (!pieces) {
      console.log('[handlePackColor] No pieces found, returning');
      return;
    }

    console.log('[handlePackColor] Calling packPolygons with:', {
      sheetWidth,
      sheetHeight,
      seamAllowance: config.seamAllowance,
      spacing: packingSpacing,
      pieceCount: pieces.length
    });

    try {
      const packed = await packPolygons(pieces, {
        sheetWidth,
        sheetHeight,
        seamAllowance: config.seamAllowance,
        spacing: packingSpacing,
        onProgress: (progress) => {
          console.log('[handlePackColor] Progress update:', progress);
          setPackingProgress(prev => {
            const newMap = new Map(prev);
            newMap.set(colorIndex, progress);
            return newMap;
          });
        },
        onNesterCreated: (nester) => {
          console.log('[handlePackColor] Nester created');
          nestersRef.current.set(colorIndex, nester);
        }
      });

      console.log('[handlePackColor] Packing complete, result:', packed);
      setPackedLayouts(prev => {
        const newMap = new Map(prev);
        newMap.set(colorIndex, packed);
        return newMap;
      });
    } catch (error) {
      console.error('[handlePackColor] Packing error:', error);
      // Clear progress on error
      setPackingProgress(prev => {
        const newMap = new Map(prev);
        newMap.delete(colorIndex);
        return newMap;
      });
    }
  };

  const handleStopPacking = (colorIndex: number) => {
    const nester = nestersRef.current.get(colorIndex);
    if (nester) {
      nester.stop();
      // Update progress to show stopped state
      setPackingProgress(prev => {
        const newMap = new Map(prev);
        const current = newMap.get(colorIndex);
        if (current) {
          newMap.set(colorIndex, { ...current, isRunning: false });
        }
        return newMap;
      });
    }
  };

  return (
    <div className="app">
      <header>
        <h1>Quilted Tessellation Generator</h1>
      </header>

      <div className="container">
        <aside className="controls">
          {activeTab === 'full' ? (
            <QuiltSidebar
              config={config}
              updateConfig={updateConfig}
              showSeamAllowance={showSeamAllowance}
              setShowSeamAllowance={setShowSeamAllowance}
              packingSpacing={packingSpacing}
              setPackingSpacing={setPackingSpacing}
              palette={palette}
              updatePaletteColor={updatePaletteColor}
              updateColorProbability={updateColorProbability}
              tessellation={tessellation}
              collapsedSections={collapsedSections}
              toggleSection={toggleSection}
              onRegenerate={handleRegenerateTessellation}
              onDownload={handleDownloadCurrent}
            />
          ) : (
            <PackingSidebar
              config={config}
              updateConfig={updateConfig}
              packingSpacing={packingSpacing}
              setPackingSpacing={setPackingSpacing}
              sheetWidth={sheetWidth}
              setSheetWidth={setSheetWidth}
              sheetHeight={sheetHeight}
              setSheetHeight={setSheetHeight}
              packedLayout={packedLayouts.get(parseInt(activeTab.split('-')[1]))}
              colorIndex={parseInt(activeTab.split('-')[1])}
              palette={palette}
              collapsedSections={collapsedSections}
              toggleSection={toggleSection}
              onDownload={handleDownloadCurrent}
              packingProgress={packingProgress.get(parseInt(activeTab.split('-')[1]))}
              onPackColor={() => handlePackColor(parseInt(activeTab.split('-')[1]))}
              onStopPacking={() => handleStopPacking(parseInt(activeTab.split('-')[1]))}
            />
          )}
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
