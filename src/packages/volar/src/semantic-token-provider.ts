/**
 * @templjs/volar - Semantic Token Provider
 *
 * Provides semantic highlighting for template syntax including keywords, variables, and filters.
 */

import {
  resolveDelimiters,
  type DelimiterConfig,
  DEFAULT_DELIMITERS,
} from './template-delimiters.js';
import {
  extractExpressionFilterReferences,
  getBuiltinFilterNames,
  tokenize,
  TokenType,
} from '@templjs/core';
import { LineColumnMapper } from './position-mapping.js';

/**
 * Semantic token types for template syntax highlighting
 */
export const SemanticTokenTypes = {
  Keyword: 'keyword',
  Variable: 'variable',
  Function: 'function',
  Comment: 'comment',
  String: 'string',
  Operator: 'operator',
} as const;

/**
 * Semantic token modifiers for additional context
 */
export const SemanticTokenModifiers = {
  Readonly: 'readonly',
  Deprecated: 'deprecated',
} as const;

/**
 * Token type and modifier definitions for VS Code
 */
export const SEMANTIC_TOKEN_LEGEND = {
  tokenTypes: Object.values(SemanticTokenTypes),
  tokenModifiers: Object.values(SemanticTokenModifiers),
};

/**
 * Template language keywords
 */
const KEYWORDS = new Set([
  'if',
  'elif',
  'else',
  'endif',
  'for',
  'endfor',
  'foreach',
  'endforeach',
  'while',
  'endwhile',
  'block',
  'endblock',
  'extends',
  'include',
  'import',
  'from',
  'as',
  'set',
  'in',
  'is',
  'not',
  'and',
  'or',
  'true',
  'false',
  'none',
  'null',
]);

const FILTERS = new Set(getBuiltinFilterNames());

/**
 * Token information for semantic highlighting
 */
export interface TokenInfo {
  offset: number;
  length: number;
  type: string;
  modifiers?: string[];
}

export type { DelimiterConfig };
export { DEFAULT_DELIMITERS };

function tokenPositionToOffset(mapper: LineColumnMapper, line: number, column: number): number {
  return mapper.lineColCodePointToOffset(Math.max(0, line - 1), column);
}

function getTokenContentRange(
  tokenContent: string,
  tokenOffset: number,
  openingDelimiter: string,
  closingDelimiter: string,
  trimLeft?: boolean,
  trimRight?: boolean
): { content: string; offset: number } {
  const hasClosingDelimiter =
    closingDelimiter.length > 0 && tokenContent.endsWith(closingDelimiter);
  let start = openingDelimiter.length;
  let end = hasClosingDelimiter
    ? tokenContent.length - closingDelimiter.length
    : tokenContent.length;

  if (trimLeft && tokenContent[start] === '-') {
    start += 1;
  }
  if (trimRight && hasClosingDelimiter && tokenContent[end - 1] === '-') {
    end -= 1;
  }

  return {
    content: tokenContent.slice(start, Math.max(start, end)),
    offset: tokenOffset + start,
  };
}

function extractFilterReferencesForHighlighting(
  content: string
): Array<{ name: string; start: number; end: number }> {
  const parserBacked = extractExpressionFilterReferences(content).flatMap((ref) => {
    const identifier = /^[A-Za-z_][\w-]*/.exec(ref.name)?.[0];
    if (!identifier) {
      return [];
    }
    const prefix = content.slice(0, ref.start);
    if (!isTopLevelFilterContext(prefix)) {
      return [];
    }
    return [
      {
        name: identifier,
        start: ref.start,
        end: ref.start + identifier.length,
      },
    ];
  });
  if (parserBacked.length > 0) {
    return parserBacked;
  }

  // Syntax-highlighting fallback only: core expression parsing does not yet
  // accept legacy `| filter: arg` syntax, but themes still need the filter name.
  const refs: Array<{ name: string; start: number; end: number }> = [];
  let inString: '"' | "'" | null = null;
  let escaped = false;
  let bracketDepth = 0;
  let parenDepth = 0;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === inString) {
        inString = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = char;
      continue;
    }
    if (char === '[') {
      bracketDepth += 1;
      continue;
    }
    if (char === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1);
      continue;
    }
    if (char === '(') {
      parenDepth += 1;
      continue;
    }
    if (char === ')') {
      parenDepth = Math.max(0, parenDepth - 1);
      continue;
    }

    if (
      char !== '|' ||
      content[index + 1] === '|' ||
      content[index - 1] === '|' ||
      bracketDepth > 0 ||
      parenDepth > 0
    ) {
      continue;
    }

    let cursor = index + 1;
    while (cursor < content.length && /\s/.test(content[cursor]!)) {
      cursor += 1;
    }
    const start = cursor;
    if (!/[A-Za-z_]/.test(content[cursor] ?? '')) {
      continue;
    }
    cursor += 1;
    while (cursor < content.length && /[\w-]/.test(content[cursor]!)) {
      cursor += 1;
    }
    refs.push({
      name: content.slice(start, cursor),
      start,
      end: cursor,
    });
  }

  return refs;
}

function isTopLevelFilterContext(prefix: string): boolean {
  let inString: '"' | "'" | null = null;
  let escaped = false;
  let bracketDepth = 0;
  let parenDepth = 0;

  for (let index = 0; index < prefix.length; index += 1) {
    const char = prefix[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === inString) {
        inString = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = char;
      continue;
    }
    if (char === '[') {
      bracketDepth += 1;
      continue;
    }
    if (char === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1);
      continue;
    }
    if (char === '(') {
      parenDepth += 1;
      continue;
    }
    if (char === ')') {
      parenDepth = Math.max(0, parenDepth - 1);
    }
  }

  return inString === null && bracketDepth === 0 && parenDepth === 0;
}

/**
 * Extract semantic tokens from template text
 * @param text Template source code
 * @param delimiters Optional custom delimiters (defaults to DEFAULT_DELIMITERS)
 * @returns Array of token information sorted by offset
 */
export function extractSemanticTokens(
  text: string,
  delimiters: Partial<DelimiterConfig> = {}
): TokenInfo[] {
  const config = resolveDelimiters(delimiters);
  const tokens: TokenInfo[] = [];

  if (!text) return tokens;

  const mapper = new LineColumnMapper(text);
  const templateTokens = tokenize(text, {
    recoverUnclosedDelimiters: true,
    delimiters: {
      statement_start: config.statementStart,
      statement_end: config.statementEnd,
      expression_start: config.expressionStart,
      expression_end: config.expressionEnd,
      comment_start: config.commentStart,
      comment_end: config.commentEnd,
    },
  });

  for (const token of templateTokens) {
    if (token.type === TokenType.TEXT) {
      continue;
    }

    const tokenOffset = tokenPositionToOffset(mapper, token.start.line, token.start.column);
    tokens.push({
      offset: tokenOffset,
      length: token.content.length,
      type:
        token.type === TokenType.COMMENT
          ? SemanticTokenTypes.Comment
          : token.type === TokenType.STATEMENT
            ? SemanticTokenTypes.Keyword
            : SemanticTokenTypes.Variable,
    });

    if (token.type === TokenType.STATEMENT) {
      const inner = getTokenContentRange(
        token.content,
        tokenOffset,
        token.delimiterStart ?? config.statementStart,
        token.delimiterEnd ?? config.statementEnd,
        token.trimLeft,
        token.trimRight
      );
      const keywordMatch = inner.content.match(/[A-Za-z_]\w*/);
      if (keywordMatch && KEYWORDS.has(keywordMatch[0])) {
        tokens.push({
          offset: inner.offset + keywordMatch.index!,
          length: keywordMatch[0].length,
          type: SemanticTokenTypes.Keyword,
        });
      }
    }

    if (token.type === TokenType.EXPRESSION) {
      const inner = getTokenContentRange(
        token.content,
        tokenOffset,
        token.delimiterStart ?? config.expressionStart,
        token.delimiterEnd ?? config.expressionEnd,
        token.trimLeft,
        token.trimRight
      );
      for (const filter of extractFilterReferencesForHighlighting(inner.content)) {
        if (!FILTERS.has(filter.name)) {
          continue;
        }

        tokens.push({
          offset: inner.offset + filter.start,
          length: filter.name.length,
          type: SemanticTokenTypes.Function,
          modifiers: [SemanticTokenModifiers.Readonly],
        });
      }
    }
  }

  // Sort by offset and remove duplicates
  tokens.sort((a, b) => a.offset - b.offset);
  return removeDuplicateTokens(tokens);
}

/**
 * Remove duplicate tokens that have identical offset and length
 */
function removeDuplicateTokens(tokens: TokenInfo[]): TokenInfo[] {
  const seen = new Set<string>();
  return tokens.filter((token) => {
    // Keep the first occurrence of each offset-length combination
    // This handles cases where we have overlapping tokens
    const key = `${token.offset}-${token.length}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
