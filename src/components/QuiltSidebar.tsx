import { TessellationConfig, TessellationResult } from '../lib/types';
import { CollapsibleSection } from './CollapsibleSection';

const getColorName = (index: number) => `Color ${index + 1}`;

interface QuiltSidebarProps {
  config: TessellationConfig;
  updateConfig: (partial: Partial<TessellationConfig>) => void;
  showSeamAllowance: boolean;
  setShowSeamAllowance: (value: boolean) => void;
  packingSpacing: number;
  setPackingSpacing: (value: number) => void;
  palette: string[];
  updatePaletteColor: (index: number, color: string) => void;
  updateColorProbability: (index: number, value: number) => void;
  tessellation: TessellationResult;
  collapsedSections: Record<string, boolean>;
  toggleSection: (name: string) => void;
  onRegenerate: () => void;
  onDownload: () => void;
}

export function QuiltSidebar({
  config,
  updateConfig,
  showSeamAllowance,
  setShowSeamAllowance,
  packingSpacing,
  setPackingSpacing,
  palette,
  updatePaletteColor,
  updateColorProbability,
  tessellation,
  collapsedSections,
  toggleSection,
  onRegenerate,
  onDownload
}: QuiltSidebarProps) {
  return (
    <>
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
        <button onClick={onRegenerate} className="regenerate-btn">
          🎲 Regenerate Pattern
        </button>

        <button onClick={onDownload} className="export-btn">
          📥 Download Full Pattern
        </button>
      </div>
    </>
  );
}
