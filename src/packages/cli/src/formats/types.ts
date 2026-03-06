export type SupportedFormat = 'json' | 'yaml' | 'toml' | 'xml';

export interface FormatParser {
  parse(content: string): Record<string, unknown>;
}

export const SUPPORTED_EXTENSIONS: Record<string, SupportedFormat> = {
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.xml': 'xml',
};
