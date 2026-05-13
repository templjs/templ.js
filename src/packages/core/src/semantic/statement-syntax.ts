export interface TemplateStatementSyntaxValidationResult {
  valid: boolean;
  message?: string;
  suggestion?: string;
}

export interface TemplateForHeader {
  aliasName: string;
  aliasStart: number;
  aliasEnd: number;
  iterableExpression: string;
  iterableStart: number;
}

export interface TemplateStatementExpression {
  expression: string;
  startOffset: number;
}

/**
 * Tokenize statement content while discarding standalone whitespace-control
 * markers that remain after slicing statement delimiters.
 */
function tokenizeStatementContent(content: string): string[] {
  return content.split(/\s+/).filter((token) => token.length > 0 && token !== '-');
}

function isIdentifier(token: string | undefined): boolean {
  return token !== undefined && /^[A-Za-z_]\w*$/.test(token);
}

function isBlockName(token: string | undefined): boolean {
  return token !== undefined && /^[A-Za-z_][\w-]*$/.test(token);
}

function isWhitespace(char: string | undefined): boolean {
  return char !== undefined && /\s/.test(char);
}

function stripLeadingTrimMarker(statementContent: string): {
  content: string;
  offsetDelta: number;
} {
  let cursor = 0;
  while (cursor < statementContent.length && isWhitespace(statementContent[cursor])) {
    cursor += 1;
  }

  if (statementContent[cursor] !== '-') {
    return {
      content: statementContent,
      offsetDelta: 0,
    };
  }

  cursor += 1;
  while (cursor < statementContent.length && isWhitespace(statementContent[cursor])) {
    cursor += 1;
  }

  return {
    content: statementContent.slice(cursor),
    offsetDelta: cursor,
  };
}

export function parseTemplateForHeader(statementContent: string): TemplateForHeader | null {
  const normalized = stripLeadingTrimMarker(statementContent);
  const content = normalized.content.trimStart();
  const contentOffset = normalized.offsetDelta + (normalized.content.length - content.length);
  const tokens = tokenizeStatementContent(content);

  if (
    tokens.length < 3 ||
    tokens[0] !== 'for' ||
    !isIdentifier(tokens[1] ?? '') ||
    tokens[2] !== 'in'
  ) {
    return null;
  }

  const aliasName = tokens[1]!;
  let cursor = 0;

  while (cursor < content.length && isWhitespace(content[cursor])) {
    cursor += 1;
  }

  while (cursor < content.length && !isWhitespace(content[cursor])) {
    cursor += 1;
  }
  while (cursor < content.length && isWhitespace(content[cursor])) {
    cursor += 1;
  }

  const aliasStart = cursor;
  while (cursor < content.length && /\w/.test(content[cursor]!)) {
    cursor += 1;
  }
  const aliasEnd = cursor;

  while (cursor < content.length && isWhitespace(content[cursor])) {
    cursor += 1;
  }
  while (cursor < content.length && !isWhitespace(content[cursor])) {
    cursor += 1;
  }
  while (cursor < content.length && isWhitespace(content[cursor])) {
    cursor += 1;
  }

  const iterableStart = cursor;
  const iterableExpression = content.slice(iterableStart).replace(/\s*-\s*$/, '');

  return {
    aliasName,
    aliasStart: contentOffset + aliasStart,
    aliasEnd: contentOffset + aliasEnd,
    iterableExpression,
    iterableStart: contentOffset + iterableStart,
  };
}

export function extractTemplateStatementExpression(
  statementContent: string
): TemplateStatementExpression | null {
  const normalized = stripLeadingTrimMarker(statementContent);
  const content = normalized.content.trim();
  const contentOffset =
    normalized.offsetDelta + (normalized.content.length - normalized.content.trimStart().length);

  if (!content) {
    return null;
  }

  const tokens = tokenizeStatementContent(content);
  const keyword = tokens[0];
  if (!keyword || !isIdentifier(keyword) || content === keyword || !content.includes(' ')) {
    return null;
  }

  if (keyword === 'for') {
    const parsed = parseTemplateForHeader(statementContent);
    if (!parsed) {
      return null;
    }

    return {
      expression: parsed.iterableExpression,
      startOffset: parsed.iterableStart,
    };
  }

  let cursor = 0;
  while (cursor < content.length && isWhitespace(content[cursor])) {
    cursor += 1;
  }
  while (cursor < content.length && !isWhitespace(content[cursor])) {
    cursor += 1;
  }
  while (cursor < content.length && isWhitespace(content[cursor])) {
    cursor += 1;
  }

  const expression = content.slice(cursor);
  if (!expression) {
    return null;
  }

  return {
    expression,
    startOffset: contentOffset + cursor,
  };
}

export function validateTemplateStatementSyntax(
  tag: string,
  statementContent: string
): TemplateStatementSyntaxValidationResult {
  const tokens = tokenizeStatementContent(statementContent);

  switch (tag) {
    case 'for':
      if (tokens.length < 4 || !isIdentifier(tokens[1]) || tokens[2] !== 'in') {
        return {
          valid: false,
          message: 'Invalid for statement: expected "for <name> in <expression>"',
          suggestion: 'Use `{% for item in items %}`',
        };
      }
      return { valid: true };

    case 'if':
      if (tokens.length < 2) {
        return {
          valid: false,
          message: 'Invalid if statement: expected "if <expression>"',
          suggestion: 'Use `{% if condition %}`',
        };
      }
      return { valid: true };

    case 'while':
      if (tokens.length < 2) {
        return {
          valid: false,
          message: 'Invalid while statement: expected "while <expression>"',
          suggestion: 'Use `{% while condition %}`',
        };
      }
      return { valid: true };

    case 'switch':
      if (tokens.length < 2) {
        return {
          valid: false,
          message: 'Invalid switch statement: expected "switch <expression>"',
          suggestion: 'Use `{% switch value %}`',
        };
      }
      return { valid: true };

    case 'block':
      if (tokens.length !== 2 || !isBlockName(tokens[1])) {
        return {
          valid: false,
          message: 'Invalid block statement: expected "block <name>"',
          suggestion: 'Use `{% block content %}`',
        };
      }
      return { valid: true };

    case 'set':
      if (!isIdentifier(tokens[1])) {
        return {
          valid: false,
          message: 'Invalid set statement: expected "set <name>" or "set <name> = <expression>"',
          suggestion: 'Use `{% set var = value %}` or `{% set var %}`',
        };
      }

      if (tokens.length > 2 && (tokens[2] !== '=' || tokens.length < 4)) {
        return {
          valid: false,
          message: 'Invalid set statement: expected "set <name>" or "set <name> = <expression>"',
          suggestion: 'Use `{% set var = value %}` or `{% set var %}`',
        };
      }
      return { valid: true };

    case 'case':
      if (tokens.length < 2) {
        return {
          valid: false,
          message: 'Invalid case statement: expected "case <value>"',
          suggestion: 'Use `{% case value %}`',
        };
      }
      return { valid: true };

    case 'default':
      if (tokens.length !== 1) {
        return {
          valid: false,
          message: 'Invalid default statement: expected "default" with no arguments',
          suggestion: 'Use `{% default %}`',
        };
      }
      return { valid: true };

    default:
      return { valid: true };
  }
}
