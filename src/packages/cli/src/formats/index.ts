/**
 * Format detection and parser factory
 */

import { extname } from 'path';
import { JsonParser } from './json-parser';
import { YamlParser } from './yaml-parser';
import { TomlParser } from './toml-parser';
import { XmlParser } from './xml-parser';
import { FormatParser, SupportedFormat, SUPPORTED_EXTENSIONS } from './types';

export type { FormatParser, SupportedFormat };
export { SUPPORTED_EXTENSIONS };
export { JsonParser } from './json-parser';
export { YamlParser } from './yaml-parser';
export { TomlParser } from './toml-parser';
export { XmlParser } from './xml-parser';

/**
 * Detect format from file path extension
 * @param filePath File path to detect format from
 * @returns Detected format or null if not recognized
 */
export function detectFormat(filePath: string): SupportedFormat | null {
  const ext = extname(filePath).toLowerCase();
  return SUPPORTED_EXTENSIONS[ext] || null;
}

/**
 * Get parser for detected format
 * @param format Format type
 * @returns Parser instance for the format
 */
export function getParser(format: SupportedFormat): FormatParser {
  switch (format) {
    case 'json':
      return new JsonParser();
    case 'yaml':
      return new YamlParser();
    case 'toml':
      return new TomlParser();
    case 'xml':
      return new XmlParser();
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

/**
 * Parse content with auto-detection from file path
 * @param content Content to parse
 * @param filePath File path for format detection
 * @returns Parsed data
 */
export function parseData(content: string, filePath: string): Record<string, unknown> {
  const format = detectFormat(filePath);
  if (!format) {
    throw new Error(
      `Unable to detect format from file path: ${filePath}. Supported formats: .json, .yaml, .yml, .toml, .xml`
    );
  }

  const parser = getParser(format);
  return parser.parse(content);
}

/**
 * Parse content with async support for XML
 * @param content Content to parse
 * @param filePath File path for format detection (defaults to JSON for stdin "-")
 * @returns Promise resolving to parsed data
 */
export async function parseDataAsync(
  content: string,
  filePath: string
): Promise<Record<string, unknown>> {
  // Default stdin ("-") to JSON format
  const effectivePath = filePath === '-' ? 'input.json' : filePath;
  const format = detectFormat(effectivePath);
  if (!format) {
    throw new Error(
      `Unable to detect format from file path: ${filePath}. Supported formats: .json, .yaml, .yml, .toml, .xml`
    );
  }

  if (format === 'xml') {
    const parser = new XmlParser();
    return parser.parseAsync(content);
  }

  const parser = getParser(format);
  return parser.parse(content);
}
