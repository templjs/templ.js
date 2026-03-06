/**
 * YAML format parser
 */

import { FormatParser } from './types';

// Dynamically import js-yaml to handle optional dependency
let jsYaml: typeof import('js-yaml') | null = null;

function getYamlModule(): typeof import('js-yaml') {
  if (!jsYaml) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      jsYaml = require('js-yaml');
    } catch {
      throw new Error(
        'YAML support requires the "js-yaml" package. Install it with: pnpm add js-yaml'
      );
    }
  }
  return jsYaml;
}

export class YamlParser implements FormatParser {
  formatName = 'YAML';

  parse(content: string): Record<string, unknown> {
    try {
      const yaml = getYamlModule();
      const parsed = yaml.load(content) as unknown;

      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Input data must be a YAML object (mapping/hash)');
      }

      return parsed as Record<string, unknown>;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('js-yaml')) {
        throw error; // Re-throw dependency error
      }
      throw new Error(`Invalid YAML: ${message}`, { cause: error });
    }
  }
}
