import { TessellationConfig } from '../lib/types';
import { PackedResult, PackingProgress } from '../lib/packing';
import { CollapsibleSection } from './CollapsibleSection';

const getColorName = (index: number) => `Color ${index + 1}`;

interface PackingSidebarProps {
  config: TessellationConfig;
  updateConfig: (partial: Partial<TessellationConfig>) => void;
  packingSpacing: number;
  setPackingSpacing: (value: number) => void;
  maxPackingIterations: number;
  setMaxPackingIterations: (value: number) => void;
  sheetWidth: number;
  setSheetWidth: (value: number) => void;
  sheetHeight: number;
  setSheetHeight: (value: number) => void;
  packedLayout: PackedResult | undefined;
  colorIndex: number;
  palette: string[];
  collapsedSections: Record<string, boolean>;
  toggleSection: (name: string) => void;
  onDownload: () => void;
  packingProgress?: PackingProgress;
  onPackColor: () => void;
  onStopPacking: () => void;
  showPackedLabels: boolean;
  setShowPackedLabels: (value: boolean) => void;
  showPackedSewingLines: boolean;
  setShowPackedSewingLines: (value: boolean) => void;
}

export function PackingSidebar({
  config,
  updateConfig,
  packingSpacing,
  setPackingSpacing,
  maxPackingIterations,
  setMaxPackingIterations,
  sheetWidth,
  setSheetWidth,
  sheetHeight,
  setSheetHeight,
  packedLayout,
  colorIndex,
  palette: _palette,
  collapsedSections,
  toggleSection,
  onDownload,
  packingProgress,
  onPackColor: _onPackColor,
  onStopPacking,
  showPackedLabels,
  setShowPackedLabels,
  showPackedSewingLines,
  setShowPackedSewingLines
}: PackingSidebarProps) {
  return (
    <>
      <div className="controls-scrollable">
        <CollapsibleSection
          title="Sheet Dimensions"
          isCollapsed={!!collapsedSections['sheet-dimensions']}
          onToggle={() => toggleSection('sheet-dimensions')}
        >
          <label>
            Sheet Width (mm)
            <input
              type="number"
              min="100"
              max="2000"
              step="10"
              value={sheetWidth}
              onChange={(e) => setSheetWidth(parseFloat(e.target.value))}
              style={{ marginTop: '0.5rem' }}
            />
          </label>

          <label>
            Sheet Height (mm)
            <input
              type="number"
              min="100"
              max="2000"
              step="10"
              value={sheetHeight}
              onChange={(e) => setSheetHeight(parseFloat(e.target.value))}
              style={{ marginTop: '0.5rem' }}
            />
          </label>
        </CollapsibleSection>

        <CollapsibleSection
          title="Packing Settings"
          isCollapsed={!!collapsedSections['packing-settings']}
          onToggle={() => toggleSection('packing-settings')}
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

          <label>
            Max Packing Iterations: {maxPackingIterations}
            <input
              type="range"
              min="1"
              max="100"
              step="1"
              value={maxPackingIterations}
              onChange={(e) => setMaxPackingIterations(parseInt(e.target.value))}
            />
            <small>More iterations = better packing but slower</small>
          </label>
        </CollapsibleSection>

        <CollapsibleSection
          title="Packing Statistics"
          isCollapsed={!!collapsedSections['packing-stats']}
          onToggle={() => toggleSection('packing-stats')}
        >
          {packingProgress && packingProgress.isRunning && (
            <>
              <p><strong>Status:</strong> Running...</p>
              <p><strong>Iteration:</strong> {packingProgress.iteration} / {maxPackingIterations}</p>
              <p><strong>Current Efficiency:</strong> {packingProgress.utilization.toFixed(1)}%</p>
              <button
                onClick={onStopPacking}
                style={{
                  background: 'linear-gradient(135deg, #E74C3C 0%, #C0392B 100%)',
                  marginTop: '1rem'
                }}
              >
                ⏹ Stop Packing
              </button>
            </>
          )}
          {packedLayout && (!packingProgress || !packingProgress.isRunning) && (
            <>
              <p><strong>Color:</strong> {getColorName(colorIndex)}</p>
              <p><strong>Pieces:</strong> {packedLayout.pieces.length}</p>
              <p><strong>Sheet Size:</strong> {packedLayout.sheetWidth.toFixed(1)} × {packedLayout.sheetHeight.toFixed(1)} mm</p>
              <p><strong>Efficiency:</strong> {packedLayout.efficiency.toFixed(1)}%</p>
            </>
          )}
          {!packedLayout && (!packingProgress || !packingProgress.isRunning) && (
            <p>No packing data available</p>
          )}
        </CollapsibleSection>

        <CollapsibleSection
          title="Display Options"
          isCollapsed={!!collapsedSections['display-options']}
          onToggle={() => toggleSection('display-options')}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showPackedLabels}
              onChange={(e) => setShowPackedLabels(e.target.checked)}
            />
            <span>Show Grid Labels</span>
          </label>
          <small style={{ display: 'block', marginTop: '0.25rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            Display (row, col) coordinates on each piece
          </small>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showPackedSewingLines}
              onChange={(e) => setShowPackedSewingLines(e.target.checked)}
            />
            <span>Show Sewing Lines</span>
          </label>
          <small style={{ display: 'block', marginTop: '0.25rem', color: 'var(--text-secondary)' }}>
            Display dotted lines for actual piece size (minus seam allowance)
          </small>
        </CollapsibleSection>
      </div>

      <div className="controls-footer">
        {!packingProgress?.isRunning && (
          <button
            onClick={() => {
              console.log('[PackingSidebar] Pack button clicked for color:', colorIndex);
              _onPackColor();
            }}
            style={{
              background: 'linear-gradient(135deg, #3498DB 0%, #2980B9 100%)',
              marginBottom: '0.75rem'
            }}
          >
            📦 {packedLayout ? 'Re-pack' : 'Pack'} {getColorName(colorIndex)}
          </button>
        )}

        {packedLayout && (
          <button onClick={onDownload} className="export-btn">
            📥 Download {getColorName(colorIndex)} Packing
          </button>
        )}
      </div>
    </>
  );
}
