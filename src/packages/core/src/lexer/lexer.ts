import type { Token, Position, DelimiterConfig, LexerOptions } from './types';
import { TokenType, DEFAULT_DELIMITERS } from './types';

/**
 * Tokenize a template string into structured tokens
 *
 * @param template - The template string to tokenize
 * @param options - Lexer options including custom delimiters
 * @returns Array of tokens
 *
 * @example
 * ```typescript
 * const tokens = tokenize('Hello {{ name }}!');
 * // Returns: [
 * //   { type: 'TEXT', content: 'Hello ', ... },
 * //   { type: 'EXPRESSION', content: '{{ name }}', ... },
 * //   { type: 'TEXT', content: '!', ... }
 * // ]
 * ```
 */
export function tokenize(template: string, options?: LexerOptions): Token[] {
  // Merge delimiters with defaults
  const delimiters: Required<DelimiterConfig> = {
    ...DEFAULT_DELIMITERS,
    ...options?.delimiters,
  };

  const tokens: Token[] = [];
  let position = 0;
  let line = 1;
  let column = 0;

  // Track which delimiter starts earliest in the remaining string
  function findNextDelimiter(
    text: string,
    offset: number
  ): {
    type: TokenType;
    start: number;
    end: number;
    content: string;
  } | null {
    let earliest: { type: TokenType; start: number; end: number; content: string } | null = null;

    // Check each delimiter type
    const checks = [
      {
        type: TokenType.STATEMENT,
        start: delimiters.statement_start,
        end: delimiters.statement_end,
      },
      {
        type: TokenType.EXPRESSION,
        start: delimiters.expression_start,
        end: delimiters.expression_end,
      },
      {
        type: TokenType.COMMENT,
        start: delimiters.comment_start,
        end: delimiters.comment_end,
      },
    ];

    for (const check of checks) {
      const startPos = text.indexOf(check.start, offset);
      if (startPos === -1) continue;

      const endPos = text.indexOf(check.end, startPos + check.start.length);
      if (endPos === -1) {
        // Unclosed delimiter
        const lines = text.substring(0, startPos).split('\n');
        const errorLine = lines.length;
        const errorCol = lines[lines.length - 1].length;
        throw new Error(
          `Unclosed ${check.type.toLowerCase()} starting at line ${errorLine}, column ${errorCol}`
        );
      }

      if (earliest === null || startPos < earliest.start) {
        earliest = {
          type: check.type,
          start: startPos,
          end: endPos + check.end.length,
          content: text.substring(startPos, endPos + check.end.length),
        };
      }
    }

    return earliest;
  }

  // Process the template
  while (position < template.length) {
    const nextDelim = findNextDelimiter(template, position);

    if (nextDelim === null || nextDelim.start > position) {
      // There's text before the next delimiter (or no more delimiters)
      const textEnd = nextDelim ? nextDelim.start : template.length;
      const textContent = template.substring(position, textEnd);

      if (textContent.length > 0) {
        const start: Position = { line, column };

        // Update position tracking
        for (const char of textContent) {
          if (char === '\n') {
            line++;
            column = 0;
          } else {
            column++;
          }
        }

        tokens.push({
          type: TokenType.TEXT,
          content: textContent,
          start,
          end: { line, column },
        });
      }

      position = textEnd;
    }

    if (nextDelim && position === nextDelim.start) {
      // Process the delimiter token
      const start: Position = { line, column };

      // Update position tracking
      for (const char of nextDelim.content) {
        if (char === '\n') {
          line++;
          column = 0;
        } else {
          column++;
        }
      }

      tokens.push({
        type: nextDelim.type,
        content: nextDelim.content,
        start,
        end: { line, column },
      });

      position = nextDelim.end;
    }
  }

  return tokens;
}
