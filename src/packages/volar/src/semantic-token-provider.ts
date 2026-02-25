/**
 * @templjs/volar - Semantic Token Provider
 *
 * Provides semantic highlighting for template syntax including keywords, variables, and filters.
 */

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

/**
 * Built-in filters for template language
 */
const FILTERS = new Set([
  'upper',
  'lower',
  'capitalize',
  'title',
  'trim',
  'length',
  'slice',
  'first',
  'last',
  'reverse',
  'sort',
  'default',
  'escape',
  'safe',
  'json',
  'join',
  'split',
  'replace',
  'round',
  'abs',
  'int',
  'float',
]);

/**
 * Token information for semantic highlighting
 */
export interface TokenInfo {
  offset: number;
  length: number;
  type: string;
  modifiers?: string[];
}

/**
 * Delimiter configuration for template syntax
 */
export interface DelimiterConfig {
  commentStart: string;
  commentEnd: string;
  statementStart: string;
  statementEnd: string;
  expressionStart: string;
  expressionEnd: string;
}

/**
 * Default delimiters for template syntax
 */
export const DEFAULT_DELIMITERS: DelimiterConfig = {
  commentStart: '{#',
  commentEnd: '#}',
  statementStart: '{%',
  statementEnd: '%}',
  expressionStart: '{{',
  expressionEnd: '}}',
};

/**
 * Escape special regex characters in delimiter
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
  const config = { ...DEFAULT_DELIMITERS, ...delimiters };
  const tokens: TokenInfo[] = [];

  if (!text) return tokens;

  // Match template comments
  const commentPattern = new RegExp(
    escapeRegex(config.commentStart) + '[\\s\\S]*?' + escapeRegex(config.commentEnd),
    'g'
  );
  let match: RegExpExecArray | null;

  commentPattern.lastIndex = 0;
  while ((match = commentPattern.exec(text)) !== null) {
    tokens.push({
      offset: match.index,
      length: match[0].length,
      type: SemanticTokenTypes.Comment,
    });
  }

  // Match template statements
  const statementPattern = new RegExp(
    escapeRegex(config.statementStart) + '[\\s\\S]*?' + escapeRegex(config.statementEnd),
    'g'
  );
  statementPattern.lastIndex = 0;
  while ((match = statementPattern.exec(text)) !== null) {
    tokens.push({
      offset: match.index,
      length: match[0].length,
      type: SemanticTokenTypes.Keyword,
    });

    // Extract keywords within statement
    const content = match[0]
      .slice(config.statementStart.length, -config.statementEnd.length)
      .trim();
    const keyword = content.split(/\s+/)[0];
    if (KEYWORDS.has(keyword)) {
      const keywordOffset = match.index + config.statementStart.length;
      tokens.push({
        offset: keywordOffset,
        length: keyword.length,
        type: SemanticTokenTypes.Keyword,
      });
    }
  }

  // Match template expressions
  const expressionPattern = new RegExp(
    escapeRegex(config.expressionStart) + '[\\s\\S]*?' + escapeRegex(config.expressionEnd),
    'g'
  );
  expressionPattern.lastIndex = 0;
  while ((match = expressionPattern.exec(text)) !== null) {
    tokens.push({
      offset: match.index,
      length: match[0].length,
      type: SemanticTokenTypes.Variable,
    });

    // Extract filters (text after |)
    const content = match[0].slice(config.expressionStart.length, -config.expressionEnd.length);
    const parts = content.split('|');
    if (parts.length > 1) {
      let filterBaseOffset = match.index + config.expressionStart.length;
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) {
          filterBaseOffset += 1; // Account for the pipe character
        }
        const filterPart = parts[i].trim();
        const filterMatch = filterPart.match(/^(\w+)/);
        if (filterMatch && FILTERS.has(filterMatch[1])) {
          const trimmedPart = parts[i];
          const filterStartInPart = trimmedPart.indexOf(filterMatch[1]);
          const filterOffset = filterBaseOffset + filterStartInPart;
          tokens.push({
            offset: filterOffset,
            length: filterMatch[1].length,
            type: SemanticTokenTypes.Function,
            modifiers: [SemanticTokenModifiers.Readonly],
          });
        }
        filterBaseOffset += parts[i].length;
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
