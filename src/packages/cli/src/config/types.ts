/**
 * CLI Configuration types for .templjs.json config files
 */

export interface TemplateDelimiters {
  statement_start?: string;
  statement_end?: string;
  expression_start?: string;
  expression_end?: string;
}

export interface ValidationConfig {
  validateInput?: boolean;
  validateOutput?: boolean;
  schemaPath?: string;
}

export interface CliConfig {
  inputFormat?: 'json' | 'yaml' | 'toml' | 'xml';
  outputFormat?: 'text' | 'json' | 'html' | 'markdown';
  defaultTemplate?: string;
  defaultOutput?: string;
  templateDelimiters?: TemplateDelimiters;
  validation?: ValidationConfig;
}

export interface ResolvedConfig extends CliConfig {
  configPath?: string;
}
