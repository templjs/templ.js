import type { FormatParser } from './types.js';

function parseTomlScalar(value: string): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;

  const numeric = Number(value);
  if (!Number.isNaN(numeric) && value.trim() !== '') {
    return numeric;
  }

  const quoted = value.match(/^"([\s\S]*)"$/);
  if (quoted) {
    return quoted[1];
  }

  return value;
}

export class TomlParser implements FormatParser {
  parse(content: string): Record<string, unknown> {
    const lines = content.split(/\r?\n/);
    const result: Record<string, unknown> = {};

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line === '' || line.startsWith('#')) {
        continue;
      }

      const separator = line.indexOf('=');
      if (separator === -1) {
        throw new Error(`Invalid TOML line: ${rawLine}`);
      }

      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim();

      if (!key) {
        throw new Error(`Invalid TOML key in line: ${rawLine}`);
      }

      result[key] = parseTomlScalar(value);
    }

    return result;
  }
}
