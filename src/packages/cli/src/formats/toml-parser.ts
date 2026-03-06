/**
 * TOML format parser
 */

import { FormatParser } from './types';

// Dynamically import toml parser to handle optional dependency
let tomlParser: { parse: (input: string) => unknown } | null = null;

function getTomlModule(): { parse: (input: string) => unknown } {
  if (!tomlParser) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      tomlParser = require('@iarna/toml');
    } catch {
      throw new Error(
        'TOML support requires the "@iarna/toml" package. Install it with: pnpm add @iarna/toml'
      );
    }
  }
  if (!tomlParser) {
    throw new Error('Failed to load TOML parser module');
  }
  return tomlParser;
}

export class TomlParser implements FormatParser {
  formatName = 'TOML';

  parse(content: string): Record<string, unknown> {
    try {
      const toml = getTomlModule();
      const parsed = toml.parse(content) as unknown;

      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Input data must be a TOML table (object)');
      }

      return parsed as Record<string, unknown>;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('@iarna/toml')) {
        throw error; // Re-throw dependency error
      }
      throw new Error(`Invalid TOML: ${message}`, { cause: error });
    }
  }
}
