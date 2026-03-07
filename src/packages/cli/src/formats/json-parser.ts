/**
 * JSON format parser
 */

import { FormatParser } from './types.js';

export class JsonParser implements FormatParser {
  formatName = 'JSON';

  parse(content: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(content) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Input data must be a JSON object');
      }
      return parsed as Record<string, unknown>;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid JSON: ${message}`, { cause: error });
    }
  }
}
