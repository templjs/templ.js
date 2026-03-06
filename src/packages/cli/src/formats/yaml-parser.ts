/**
 * YAML format parser
 */

import { FormatParser } from './types';
import * as jsYaml from 'js-yaml';

export class YamlParser implements FormatParser {
  formatName = 'YAML';

  parse(content: string): Record<string, unknown> {
    try {
      const parsed = jsYaml.load(content) as unknown;

      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Input data must be a YAML object (mapping/hash)');
      }

      return parsed as Record<string, unknown>;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid YAML: ${message}`, { cause: error });
    }
  }
}
