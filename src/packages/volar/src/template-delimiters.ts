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
  const resolved: DelimiterConfig = {
    commentStart: delimiters.commentStart ?? DEFAULT_DELIMITERS.commentStart,
    commentEnd: delimiters.commentEnd ?? DEFAULT_DELIMITERS.commentEnd,
    statementStart: delimiters.statementStart ?? DEFAULT_DELIMITERS.statementStart,
    statementEnd: delimiters.statementEnd ?? DEFAULT_DELIMITERS.statementEnd,
    expressionStart: delimiters.expressionStart ?? DEFAULT_DELIMITERS.expressionStart,
    expressionEnd: delimiters.expressionEnd ?? DEFAULT_DELIMITERS.expressionEnd,
  };

  const values = Object.values(resolved);
  if (values.some((value) => value.length === 0)) {
    throw new Error('resolveDelimiters: delimiter values must be non-empty strings');
  }

  if (new Set(values).size !== values.length) {
    throw new Error('resolveDelimiters: delimiter values must be distinct');
  }

  const hasPrefixOverlap = (left: string, right: string): boolean =>
    left !== right && (left.startsWith(right) || right.startsWith(left));

  const starts = [resolved.statementStart, resolved.expressionStart, resolved.commentStart];
  const ends = [resolved.statementEnd, resolved.expressionEnd, resolved.commentEnd];

  for (let i = 0; i < starts.length; i += 1) {
    for (let j = i + 1; j < starts.length; j += 1) {
      if (hasPrefixOverlap(starts[i], starts[j])) {
        throw new Error('resolveDelimiters: start delimiters must not overlap by prefix');
      }
    }
  }

  for (let i = 0; i < ends.length; i += 1) {
    for (let j = i + 1; j < ends.length; j += 1) {
      if (hasPrefixOverlap(ends[i], ends[j])) {
        throw new Error('resolveDelimiters: end delimiters must not overlap by prefix');
      }
    }
  }

  return resolved;
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
