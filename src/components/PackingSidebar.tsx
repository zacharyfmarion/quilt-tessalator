import { TessellationConfig } from '../lib/types';
import { PackedResult } from '../lib/packing';
import { CollapsibleSection } from './CollapsibleSection';

const getColorName = (index: number) => `Color ${index + 1}`;

interface PackingSidebarProps {
  config: TessellationConfig;
  updateConfig: (partial: Partial<TessellationConfig>) => void;
  packingSpacing: number;
  setPackingSpacing: (value: number) => void;
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
}

export function PackingSidebar({
  config,
  updateConfig,
  packingSpacing,
  setPackingSpacing,
  sheetWidth,
  setSheetWidth,
  sheetHeight,
  setSheetHeight,
  packedLayout,
  colorIndex,
  palette,
  collapsedSections,
  toggleSection,
  onDownload
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
        </CollapsibleSection>

        <CollapsibleSection
          title="Packing Statistics"
          isCollapsed={!!collapsedSections['packing-stats']}
          onToggle={() => toggleSection('packing-stats')}
        >
          {packedLayout ? (
            <>
              <p><strong>Color:</strong> {getColorName(colorIndex)}</p>
              <p><strong>Pieces:</strong> {packedLayout.pieces.length}</p>
              <p><strong>Sheet Size:</strong> {packedLayout.sheetWidth.toFixed(1)} × {packedLayout.sheetHeight.toFixed(1)} mm</p>
              <p><strong>Efficiency:</strong> {packedLayout.efficiency.toFixed(1)}%</p>
            </>
          ) : (
            <p>No packing data available</p>
          )}
        </CollapsibleSection>
      </div>

      <div className="controls-footer">
        <button onClick={onDownload} className="export-btn">
          📥 Download {getColorName(colorIndex)} Packing
        </button>
      </div>
    </>
  );
}
