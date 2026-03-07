/**
 * TOML format parser
 */

import { FormatParser } from './types.js';
import * as tomlParser from '@iarna/toml';

export class TomlParser implements FormatParser {
  formatName = 'TOML';

  parse(content: string): Record<string, unknown> {
    try {
      const parsed = tomlParser.parse(content) as unknown;

      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Input data must be a TOML table (object)');
      }

      return parsed as Record<string, unknown>;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid TOML: ${message}`, { cause: error });
    }
  }
}
