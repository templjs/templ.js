/**
 * Shared delimiter configuration and regex helpers for template parsing.
 */

export interface DelimiterConfig {
  commentStart: string;
  commentEnd: string;
  statementStart: string;
  statementEnd: string;
  expressionStart: string;
  expressionEnd: string;
}

export const DEFAULT_DELIMITERS: DelimiterConfig = {
  commentStart: '{#',
  commentEnd: '#}',
  statementStart: '{%',
  statementEnd: '%}',
  expressionStart: '{{',
  expressionEnd: '}}',
};

export function resolveDelimiters(delimiters: Partial<DelimiterConfig> = {}): DelimiterConfig {
  return { ...DEFAULT_DELIMITERS, ...delimiters };
}

export function escapeDelimiterForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildBlockPattern(start: string, end: string): RegExp {
  return new RegExp(
    `${escapeDelimiterForRegex(start)}[\\s\\S]*?${escapeDelimiterForRegex(end)}`,
    'g'
  );
}

export function buildDelimiterPairPattern(delimiters: DelimiterConfig): RegExp {
  const delimiterParts = [
    delimiters.expressionStart,
    delimiters.expressionEnd,
    delimiters.statementStart,
    delimiters.statementEnd,
    delimiters.commentStart,
    delimiters.commentEnd,
  ].map(escapeDelimiterForRegex);

  return new RegExp(`(${delimiterParts.join('|')})`);
}

export function buildTemplateBlockPattern(delimiters: DelimiterConfig): RegExp {
  return new RegExp(
    `(${escapeDelimiterForRegex(delimiters.statementStart)}[\\s\\S]*?${escapeDelimiterForRegex(delimiters.statementEnd)}|${escapeDelimiterForRegex(delimiters.expressionStart)}[\\s\\S]*?${escapeDelimiterForRegex(delimiters.expressionEnd)}|${escapeDelimiterForRegex(delimiters.commentStart)}[\\s\\S]*?${escapeDelimiterForRegex(delimiters.commentEnd)})`,
    'g'
  );
}
