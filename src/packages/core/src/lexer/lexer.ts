import type { Token, Position, LexerOptions } from './types.js';
import { TokenType, mergeDelimiterConfig } from './types.js';

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
  const delimiters = mergeDelimiterConfig(options?.delimiters ?? {});

  const tokens: Token[] = [];
  let position = 0;
  let line = 1;
  let column = 0;

  function positionAfter(start: Position, content: string): Position {
    let nextLine = start.line;
    let nextColumn = start.column;
    for (const char of content) {
      if (char === '\n') {
        nextLine++;
        nextColumn = 0;
      } else {
        nextColumn++;
      }
    }
    return { line: nextLine, column: nextColumn };
  }

  // Track which delimiter starts earliest in the remaining string
  function findNextDelimiter(
    text: string,
    offset: number
  ): {
    type: TokenType;
    start: number;
    end: number;
    content: string;
    delimiterStart: string;
    delimiterEnd: string;
    trimLeft: boolean;
    trimRight: boolean;
  } | null {
    let earliest: {
      type: TokenType;
      start: number;
      end: number;
      content: string;
      delimiterStart: string;
      delimiterEnd: string;
      trimLeft: boolean;
      trimRight: boolean;
    } | null = null;

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

      const trimLeftPos = startPos + check.start.length;
      const charAfterTrimLeftMarker = text.charAt(trimLeftPos + 1);
      // Require whitespace after the '-' so that '{{-1}}' is NOT treated as
      // trim-left + expression '1' — unary minus and negative literals need
      // '{{- expr }}' (dash followed by whitespace) to activate trim-left.
      const trimLeft = text[trimLeftPos] === '-' && /[ \t\r\n]/.test(charAfterTrimLeftMarker);
      const searchStart = trimLeft ? trimLeftPos + 1 : trimLeftPos;

      const endPos = text.indexOf(check.end, searchStart);
      if (endPos === -1) {
        if (options?.recoverUnclosedDelimiters) {
          if (
            earliest === null ||
            startPos < earliest.start ||
            (startPos === earliest.start && check.start.length > earliest.delimiterStart.length)
          ) {
            earliest = {
              type: check.type,
              start: startPos,
              end: text.length,
              content: text.substring(startPos),
              delimiterStart: check.start,
              delimiterEnd: check.end,
              trimLeft,
              trimRight: false,
            };
          }
          continue;
        }

        // Unclosed delimiter
        const lines = text.substring(0, startPos).split('\n');
        const errorLine = lines.length;
        const errorCol = lines[lines.length - 1].length;
        throw new Error(
          `Unclosed ${check.type.toLowerCase()} starting at line ${errorLine}, column ${errorCol}`
        );
      }

      if (
        earliest === null ||
        startPos < earliest.start ||
        (startPos === earliest.start && check.start.length > earliest.delimiterStart.length)
      ) {
        earliest = {
          type: check.type,
          start: startPos,
          end: endPos + check.end.length,
          content: text.substring(startPos, endPos + check.end.length),
          delimiterStart: check.start,
          delimiterEnd: check.end,
          trimLeft,
          // Require whitespace before the '-' so that '{{ 1-}}' is NOT
          // treated as trim-right + expression '1' — trim-right activates
          // only with '{{ expr -}}' (whitespace then dash then close).
          trimRight: text[endPos - 1] === '-' && /[ \t\r\n]/.test(text.charAt(endPos - 2)),
        };
      }
    }

    return earliest;
  }

  let trimNextTextLeadingWhitespace = false;

  // Process the template
  while (position < template.length) {
    const nextDelim = findNextDelimiter(template, position);

    if (nextDelim === null || nextDelim.start > position) {
      // There's text before the next delimiter (or no more delimiters)
      const textEnd = nextDelim ? nextDelim.start : template.length;
      const originalTextContent = template.substring(position, textEnd);
      const textContent = trimNextTextLeadingWhitespace
        ? originalTextContent.replace(/^[\t\n\r ]+/, '')
        : originalTextContent;
      const trimmedLeadingLength =
        trimNextTextLeadingWhitespace && textContent.length <= originalTextContent.length
          ? originalTextContent.length - textContent.length
          : 0;

      trimNextTextLeadingWhitespace = false;

      const rawStart: Position = { line, column };
      const start =
        trimmedLeadingLength > 0
          ? positionAfter(rawStart, originalTextContent.slice(0, trimmedLeadingLength))
          : rawStart;

      // Always advance raw cursor, even when trimming removes all text.
      for (const char of originalTextContent) {
        if (char === '\n') {
          line++;
          column = 0;
        } else {
          column++;
        }
      }

      if (textContent.length > 0) {
        tokens.push({
          type: TokenType.TEXT,
          content: textContent,
          start,
          end: positionAfter(start, textContent),
        });
      }

      position = textEnd;
    }

    if (nextDelim && position === nextDelim.start) {
      if (nextDelim.trimLeft) {
        const previousToken = tokens[tokens.length - 1];
        if (previousToken?.type === TokenType.TEXT) {
          const trimmedContent = previousToken.content.replace(/[\t\n\r ]+$/, '');
          if (trimmedContent !== previousToken.content) {
            previousToken.content = trimmedContent;
            previousToken.end = positionAfter(previousToken.start, previousToken.content);
          }
          if (previousToken.content.length === 0) {
            tokens.pop();
          }
        }
      }

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
        delimiterStart: nextDelim.delimiterStart,
        delimiterEnd: nextDelim.delimiterEnd,
        trimLeft: nextDelim.trimLeft,
        trimRight: nextDelim.trimRight,
        start,
        end: { line, column },
      });

      trimNextTextLeadingWhitespace = nextDelim.trimRight;

      position = nextDelim.end;
    }
  }

  return tokens;
}
