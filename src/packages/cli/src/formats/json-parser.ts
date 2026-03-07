import type { FormatParser } from './types.js';

export class JsonParser implements FormatParser {
  parse(content: string): Record<string, unknown> {
    let parsed: unknown;

    try {
      parsed = JSON.parse(content);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid JSON: ${message}`, {
        cause: error,
      });
    }

    if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') {
      throw new Error('Input data must be a JSON object');
    }

    return parsed as Record<string, unknown>;
  }
}
