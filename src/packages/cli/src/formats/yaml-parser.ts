import YAML from 'yaml';
import { FormatParser } from './types';

export class YamlParser implements FormatParser {
  parse(content: string): Record<string, unknown> {
    let parsed: unknown;

    try {
      parsed = YAML.parse(content);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid YAML: ${message}`, {
        cause: error,
      });
    }

    if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') {
      throw new Error('Input data must be a YAML object');
    }

    return parsed as Record<string, unknown>;
  }
}
