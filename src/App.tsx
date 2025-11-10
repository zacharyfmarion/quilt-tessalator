import { useState, useMemo, useRef, useEffect } from 'react';
import { Save, FolderOpen, Moon, Sun } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { TessellationConfig, TessellationResult } from './lib/types';
import { generateTessellation, applySeamAllowance, groupByColor } from './lib/tessellation';
import { generateFullSVG, downloadSVG } from './lib/svg';
import { packPolygons, generatePackedSVG, PackedResult, PackingProgress } from './lib/packing';
import { savePattern, downloadPattern, uploadPattern } from './lib/pattern-io';
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
  rows: 6,
  cols: 9,
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
  const [maxPackingIterations, setMaxPackingIterations] = useState(10);
  const [activeTab, setActiveTab] = useState<ViewTab>('full');
  const [sheetWidth, setSheetWidth] = useState(600); // mm
  const [sheetHeight, setSheetHeight] = useState(400); // mm
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const stored = localStorage.getItem('darkMode');
    return stored ? JSON.parse(stored) : false;
  });
  const [loadedTessellation, setLoadedTessellation] = useState<TessellationResult | null>(null);
  const [colorOverrides, setColorOverrides] = useState<Map<string, number>>(new Map());
  const [colorPickerState, setColorPickerState] = useState<{
    visible: boolean;
    pieceId: string | null;
    x: number;
    y: number;
  }>({ visible: false, pieceId: null, x: 0, y: 0 });

  // Apply dark mode class and persist preference
  useEffect(() => {
    document.documentElement.classList.toggle('dark-mode', isDarkMode);
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  // Generate base tessellation (without seam allowance)
  const baseTessellation = useMemo(() => {
    // If we have a loaded tessellation, use it instead of generating
    if (loadedTessellation) {
      return loadedTessellation;
    }
    return generateTessellation(config);
  }, [config, loadedTessellation]);

  // Apply color overrides to tessellation
  const tessellationWithOverrides = useMemo(() => {
    if (colorOverrides.size === 0) return baseTessellation;

    return {
      ...baseTessellation,
      pieces: baseTessellation.pieces.map(piece => {
        const override = colorOverrides.get(piece.id);
        if (override !== undefined) {
          return { ...piece, colorIndex: override };
        }
        return piece;
      }),
    };
  }, [baseTessellation, colorOverrides]);

  // Apply seam allowance if needed (doesn't regenerate the pattern)
  const tessellation = useMemo(() => {
    return showSeamAllowance ? applySeamAllowance(tessellationWithOverrides) : tessellationWithOverrides;
  }, [tessellationWithOverrides, showSeamAllowance]);

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
    // Clear any loaded tessellation so we regenerate from config
    setLoadedTessellation(null);
    // Clear color overrides
    setColorOverrides(new Map());
    // Force regeneration by creating new config object
    setConfig({ ...config });
  };

  const handlePieceClick = (event: React.MouseEvent<HTMLDivElement>) => {
    // Only handle clicks on the full pattern view
    if (activeTab !== 'full') return;

    const target = event.target as SVGElement;
    if (target.tagName === 'path' && target.id) {
      const pieceId = target.id.replace('-original', ''); // Handle seam allowance view
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();

      setColorPickerState({
        visible: true,
        pieceId,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    }
  };

  const handleColorChange = (colorIndex: number) => {
    if (colorPickerState.pieceId) {
      setColorOverrides(prev => {
        const newMap = new Map(prev);
        newMap.set(colorPickerState.pieceId!, colorIndex);
        return newMap;
      });
      setColorPickerState({ visible: false, pieceId: null, x: 0, y: 0 });
      toast.success('Color updated');
    }
  };

  const handleCloseColorPicker = () => {
    setColorPickerState({ visible: false, pieceId: null, x: 0, y: 0 });
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
        maxIterations: maxPackingIterations,
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

      // Show success toast
      toast.success(`Packing complete! Efficiency: ${packed.efficiency.toFixed(1)}%`);
    } catch (error) {
      console.error('[handlePackColor] Packing error:', error);
      // Clear progress on error
      setPackingProgress(prev => {
        const newMap = new Map(prev);
        newMap.delete(colorIndex);
        return newMap;
      });

      // Show error toast
      toast.error(`Packing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

      // Show info toast
      toast('Packing stopped', {
        icon: '⏸️',
      });
    }
  };

  const handleSavePattern = () => {
    try {
      const pattern = savePattern(baseTessellation, palette);
      downloadPattern(pattern);
      toast.success('Pattern saved successfully');
    } catch (error) {
      console.error('Failed to save pattern:', error);
      toast.error('Failed to save pattern. Please try again.');
    }
  };

  const handleLoadPattern = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const pattern = await uploadPattern(file);

      // Restore the config
      setConfig(pattern.config);

      // Restore the palette
      setPalette(pattern.palette);

      // Clear color overrides
      setColorOverrides(new Map());

      // Restore the exact tessellation
      setLoadedTessellation({
        pieces: pattern.pieces,
        config: pattern.config,
        bounds: pattern.bounds,
      });

      toast.success('Pattern loaded successfully');
    } catch (error) {
      console.error('Failed to load pattern:', error);
      toast.error(`Failed to load: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Reset the file input
    event.target.value = '';
  };

  return (
    <div className="app">
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: isDarkMode ? '#1a1f2e' : '#ffffff',
            color: isDarkMode ? '#e2e8f0' : '#1a202c',
            border: isDarkMode ? '1px solid #2d3748' : '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: isDarkMode
              ? '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.3)'
              : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            fontSize: '0.875rem',
            fontWeight: '500',
          },
          success: {
            iconTheme: {
              primary: '#27AE60',
              secondary: isDarkMode ? '#1a1f2e' : '#ffffff',
            },
          },
          error: {
            iconTheme: {
              primary: '#E74C3C',
              secondary: isDarkMode ? '#1a1f2e' : '#ffffff',
            },
          },
        }}
      />
      <header>
        <h1>Quilted Tessellation Generator</h1>
        <div className="header-buttons">
          <button
            className="header-icon-button"
            onClick={handleSavePattern}
            aria-label="Save pattern"
            title="Save pattern"
          >
            <Save size={18} />
          </button>
          <label className="header-icon-button" title="Load pattern">
            <FolderOpen size={18} />
            <input
              type="file"
              accept=".json"
              onChange={handleLoadPattern}
              style={{ display: 'none' }}
            />
          </label>
          <button
            className="header-icon-button"
            onClick={toggleDarkMode}
            aria-label="Toggle dark mode"
            title={isDarkMode ? 'Light mode' : 'Dark mode'}
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
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
              maxPackingIterations={maxPackingIterations}
              setMaxPackingIterations={setMaxPackingIterations}
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
                style={activeTab === `color-${colorIndex}` ? { borderBottomColor: palette[colorIndex] } : {}}
              >
                {getColorName(colorIndex)} Packing
                <span
                  style={{
                    display: 'inline-block',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: palette[colorIndex],
                    marginLeft: '8px',
                    border: '1px solid rgba(0,0,0,0.2)'
                  }}
                />
              </button>
            ))}
          </div>

          <div className="preview-content">
            {activeTab === 'full' ? (
              <div className="svg-container" onClick={handlePieceClick} style={{ cursor: 'pointer', position: 'relative' }}>
                <div dangerouslySetInnerHTML={{ __html: svg }} />
                {colorPickerState.visible && (
                  <>
                    <div className="color-picker-overlay" onClick={handleCloseColorPicker} />
                    <div
                      className="color-picker-popover"
                      style={{
                        position: 'absolute',
                        left: `${colorPickerState.x}px`,
                        top: `${colorPickerState.y}px`,
                      }}
                    >
                      <div className="color-picker-header">Select Color</div>
                      <div className="color-picker-options">
                        {Array.from({ length: config.colors }, (_, i) => i).map(colorIndex => (
                          <button
                            key={colorIndex}
                            className="color-picker-option"
                            onClick={() => handleColorChange(colorIndex)}
                            style={{ backgroundColor: palette[colorIndex] }}
                            title={getColorName(colorIndex)}
                          >
                            <span className="color-picker-label">{getColorName(colorIndex)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
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
