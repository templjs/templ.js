export interface TemplateStatementSyntaxValidationResult {
  valid: boolean;
  message?: string;
  suggestion?: string;
}

export interface TemplateForHeader {
  aliasName: string;
  aliasStart: number;
  aliasEnd: number;
  valueAliasName?: string;
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
  return token !== undefined && /^[A-Za-z_]\w*$/.test(token);
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
  // Strip trailing trim-control marker before matching
  const contentForMatch = content.replace(/\s*-\s*$/, '').trimEnd();

  // Support both "for alias in iterable" and "for key, value in iterable" forms
  const match = contentForMatch.match(
    /^for\s+([A-Za-z_]\w*)(?:\s*,\s*([A-Za-z_]\w*))?\s+in\s+([\s\S]+)$/
  );
  if (!match) {
    return null;
  }

  const aliasName = match[1]!;
  const valueAliasName = match[2];
  const iterableExpression = match[3]!.trim();

  if (!iterableExpression) {
    return null;
  }

  // Locate alias: it always appears immediately after "for "
  const aliasStart = contentForMatch.indexOf(aliasName, 4);
  const aliasEnd = aliasStart + aliasName.length;

  // Locate iterable: find " in " after the alias (and optional value alias)
  const inPos = contentForMatch.indexOf(' in ', aliasStart + aliasName.length);
  let iterableStart = inPos + 4;
  while (iterableStart < content.length && isWhitespace(content[iterableStart])) {
    iterableStart += 1;
  }

  return {
    aliasName,
    ...(valueAliasName !== undefined && { valueAliasName }),
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
  if (!keyword || !isIdentifier(keyword) || content === keyword || !/\s/.test(content)) {
    return null;
  }

  if (keyword === 'for') {
    const parsed = parseTemplateForHeader(statementContent);
    if (!parsed) {
      // Partial for header (e.g. "for item in " with empty iterable) –
      // return an empty expression at the end of the content so completions
      // are offered at the iterable position while the user is still typing.
      if (/^for\s+[A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)?\s+in\s*$/.test(content)) {
        return { expression: '', startOffset: contentOffset + content.length };
      }
      return null;
    }

    return {
      expression: parsed.iterableExpression,
      startOffset: parsed.iterableStart,
    };
  }

  if (keyword === 'set') {
    // For set statements extract only the RHS expression after "set name ="
    const setMatch = content.match(/^set\s+\w+\s*=\s*([\s\S]+)$/);
    if (!setMatch) {
      return null;
    }
    const setExpression = setMatch[1]!.trim();
    if (!setExpression) {
      return null;
    }
    const eqPos = content.indexOf('=');
    let setCursor = eqPos + 1;
    while (setCursor < content.length && isWhitespace(content[setCursor])) {
      setCursor += 1;
    }
    return { expression: setExpression, startOffset: contentOffset + setCursor };
  }

  let cursor = 0;
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
    case 'for': {
      // Validate using regex to support both single-alias and key/value forms
      const normalized = statementContent
        .replace(/^\s*-\s*/, '')
        .replace(/\s*-\s*$/, '')
        .trim();
      if (!/^for\s+[A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)?\s+in\s+\S/.test(normalized)) {
        return {
          valid: false,
          message: 'Invalid for statement: expected "for <name> in <expression>"',
          suggestion: 'Use `{% for item in items %}`',
        };
      }
      return { valid: true };
    }

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
      return {
        valid: false,
        message: 'Unsupported statement type: "while" is not a valid templjs statement',
        suggestion: 'Supported statement types: if, for, set, block',
      };

    case 'switch':
      return {
        valid: false,
        message: 'Unsupported statement type: "switch" is not a valid templjs statement',
        suggestion: 'Supported statement types: if, for, set, block',
      };

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
          message: 'Invalid set statement: expected "set <name> = <expression>"',
          suggestion: 'Use `{% set var = value %}`',
        };
      }

      if (tokens[2] !== '=' || tokens.length < 4) {
        return {
          valid: false,
          message: 'Invalid set statement: expected "set <name> = <expression>"',
          suggestion: 'Use `{% set var = value %}`',
        };
      }
      return { valid: true };

    case 'case':
      return {
        valid: false,
        message: 'Unsupported statement type: "case" is not a valid templjs statement',
        suggestion: 'Supported statement types: if, for, set, block',
      };

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
