/**
 * Token types for the templjs templating system
 */
export enum TokenType {
  /** Plain text content */
  TEXT = 'TEXT',
  /** Control flow statements like {% if %}, {% for %} */
  STATEMENT = 'STATEMENT',
  /** Variable expressions like {{ user.name }} */
  EXPRESSION = 'EXPRESSION',
  /** Comments like {# note #} - ignored in output */
  COMMENT = 'COMMENT',
}

/**
 * Position in the template (1-indexed line, 0-indexed column)
 */
export interface Position {
  /** Line number (1-indexed) */
  line: number;
  /** Column number (0-indexed) */
  column: number;
}

/**
 * A token produced by the lexer
 */
export interface Token {
  /** Type of token */
  type: TokenType;
  /** Full content including delimiters */
  content: string;
  /** Delimiter start marker for non-text tokens */
  delimiterStart?: string;
  /** Delimiter end marker for non-text tokens */
  delimiterEnd?: string;
  /** Starting position in source */
  start: Position;
  /** Ending position in source */
  end: Position;
}

/**
 * Configuration for custom template delimiters
 */
export interface DelimiterConfig {
  /** Statement start delimiter (default: "{% ") */
  statement_start?: string;
  /** Statement end delimiter (default: " %}") */
  statement_end?: string;
  /** Statement delimiter pair shorthand (start, end); when provided, this takes precedence over statement_start/statement_end. */
  statement?: [string, string];
  /** Expression start delimiter (default: "{{ ") */
  expression_start?: string;
  /** Expression end delimiter (default: " }}") */
  expression_end?: string;
  /** Expression delimiter pair shorthand (start, end); when provided, this takes precedence over expression_start/expression_end. */
  expression?: [string, string];
  /** Comment start delimiter (default: "{# ") */
  comment_start?: string;
  /** Comment end delimiter (default: " #}") */
  comment_end?: string;
  /** Comment delimiter pair shorthand (start, end); when provided, this takes precedence over comment_start/comment_end. */
  comment?: [string, string];
}

/**
 * Options for the lexer
 */
export interface LexerOptions {
  /** Custom delimiter configuration */
  delimiters?: DelimiterConfig;
}

/**
 * Default delimiter configuration
 */
export const DEFAULT_DELIMITERS: Required<DelimiterConfig> = {
  statement_start: '{%',
  statement_end: '%}',
  statement: ['{%', '%}'],
  expression_start: '{{',
  expression_end: '}}',
  expression: ['{{', '}}'],
  comment_start: '{#',
  comment_end: '#}',
  comment: ['{#', '#}'],
};
