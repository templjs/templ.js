/**
 * Format parser types and constants
 */

export interface FormatParser {
  /**
   * Parse content and return as JavaScript object
   */
  parse(content: string): Record<string, unknown>;

  /**
   * Format name for error messages
   */
  formatName: string;
}

export interface FormatParserAsync extends FormatParser {
  /**
   * Async parse method for formats that require it
   */
  parseAsync?(content: string): Promise<Record<string, unknown>>;
}

export type SupportedFormat = 'json' | 'yaml' | 'toml' | 'xml';

export const SUPPORTED_EXTENSIONS: Record<string, SupportedFormat> = {
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.xml': 'xml',
};
