import { TessellationConfig, TessellationResult, TessellationPiece } from './types';

/**
 * Version of the save format
 * Increment this when making breaking changes to the save format
 */
export const PATTERN_FORMAT_VERSION = '1.0.0';

/**
 * Saved pattern format
 */
export interface SavedPattern {
  version: string;
  config: TessellationConfig;
  palette: string[];
  pieces: TessellationPiece[];
  bounds: {
    width: number;
    height: number;
  };
  metadata: {
    saved: string; // ISO timestamp
    name?: string;
  };
}

/**
 * Save a tessellation pattern to JSON
 */
export function savePattern(
  tessellation: TessellationResult,
  palette: string[],
  name?: string
): SavedPattern {
  return {
    version: PATTERN_FORMAT_VERSION,
    config: tessellation.config,
    palette,
    pieces: tessellation.pieces,
    bounds: tessellation.bounds,
    metadata: {
      saved: new Date().toISOString(),
      name,
    },
  };
}

/**
 * Load a tessellation pattern from JSON
 * Throws error if version is incompatible or data is invalid
 */
export function loadPattern(data: unknown): SavedPattern {
  // Validate structure
  if (typeof data !== 'object' || data === null) {
    throw new Error('Invalid pattern file: not a valid JSON object');
  }

  const pattern = data as Partial<SavedPattern>;

  // Check version
  if (!pattern.version) {
    throw new Error('Invalid pattern file: missing version information');
  }

  // For now, we only support version 1.0.0
  // In the future, we can add migration logic here
  if (!pattern.version.startsWith('1.')) {
    throw new Error(`Incompatible pattern version: ${pattern.version}. This app supports version 1.x.x`);
  }

  // Validate required fields
  if (!pattern.config || !pattern.palette || !pattern.pieces || !pattern.bounds) {
    throw new Error('Invalid pattern file: missing required data');
  }

  return pattern as SavedPattern;
}

/**
 * Download a pattern as a JSON file
 */
export function downloadPattern(pattern: SavedPattern, filename?: string): void {
  const json = JSON.stringify(pattern, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;

  // Generate filename with timestamp if not provided
  const defaultName = `tessellation-${new Date().toISOString().split('T')[0]}.json`;
  link.download = filename || pattern.metadata.name || defaultName;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Upload and parse a pattern JSON file
 */
export function uploadPattern(file: File): Promise<SavedPattern> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = JSON.parse(text);
        const pattern = loadPattern(data);
        resolve(pattern);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}
