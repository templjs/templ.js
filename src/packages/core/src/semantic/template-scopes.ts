import { tokenize } from '../lexer/lexer.js';
import { parse } from '../parser/parser.js';
import { DEFAULT_DELIMITERS } from '../lexer/types.js';
import type { DelimiterConfig, LexerOptions } from '../lexer/types.js';
import type {
  ASTNode,
  ExpressionNode,
  ForNode,
  PathSegment,
  TemplateNode,
} from '../parser/types.js';

export interface TemplateScopeBinding {
  alias: string;
  iterablePath: string;
  scopeStartOffset: number;
  scopeEndOffset: number;
  declarationStartOffset?: number;
  declarationEndOffset?: number;
}

interface NormalizedTemplate {
  text: string;
  toOriginalOffset: (normalizedOffset: number | undefined) => number | undefined;
}
/**
 * Resolves delimiter configuration from options, supporting both array-based
 * and legacy underscore-based formats.
 *
 * Precedence order for each delimiter type:
 * 1. Array format: options.delimiters.<type>[0|1]
 * 2. Underscore format: options.delimiters.<type>_start/_end
 * 3. DEFAULT_DELIMITERS fallback
 *
 * @param options - Lexer options containing delimiter configuration
 * @returns Fully resolved delimiter config with both array and underscore formats
 */
function getResolvedDelimiters(options?: LexerOptions): Required<DelimiterConfig> {
  const statementStart =
    options?.delimiters?.statement?.[0] ??
    options?.delimiters?.statement_start ??
    DEFAULT_DELIMITERS.statement_start;
  const statementEnd =
    options?.delimiters?.statement?.[1] ??
    options?.delimiters?.statement_end ??
    DEFAULT_DELIMITERS.statement_end;
  const expressionStart =
    options?.delimiters?.expression?.[0] ??
    options?.delimiters?.expression_start ??
    DEFAULT_DELIMITERS.expression_start;
  const expressionEnd =
    options?.delimiters?.expression?.[1] ??
    options?.delimiters?.expression_end ??
    DEFAULT_DELIMITERS.expression_end;
  const commentStart =
    options?.delimiters?.comment?.[0] ??
    options?.delimiters?.comment_start ??
    DEFAULT_DELIMITERS.comment_start;
  const commentEnd =
    options?.delimiters?.comment?.[1] ??
    options?.delimiters?.comment_end ??
    DEFAULT_DELIMITERS.comment_end;

  return {
    statement_start: statementStart,
    statement_end: statementEnd,
    statement: [statementStart, statementEnd],
    expression_start: expressionStart,
    expression_end: expressionEnd,
    expression: [expressionStart, expressionEnd],
    comment_start: commentStart,
    comment_end: commentEnd,
    comment: [commentStart, commentEnd],
  };
}

function normalizeTemplateDelimiters(template: string, options?: LexerOptions): NormalizedTemplate {
  const resolved = getResolvedDelimiters(options);
  const unchanged =
    resolved.statement_start === DEFAULT_DELIMITERS.statement_start &&
    resolved.statement_end === DEFAULT_DELIMITERS.statement_end &&
    resolved.expression_start === DEFAULT_DELIMITERS.expression_start &&
    resolved.expression_end === DEFAULT_DELIMITERS.expression_end &&
    resolved.comment_start === DEFAULT_DELIMITERS.comment_start &&
    resolved.comment_end === DEFAULT_DELIMITERS.comment_end;

  if (unchanged) {
    return {
      text: template,
      toOriginalOffset: (offset) => offset,
    };
  }

  const pairs = [
    {
      from: resolved.statement_start,
      to: DEFAULT_DELIMITERS.statement_start,
    },
    {
      from: resolved.statement_end,
      to: DEFAULT_DELIMITERS.statement_end,
    },
    {
      from: resolved.expression_start,
      to: DEFAULT_DELIMITERS.expression_start,
    },
    {
      from: resolved.expression_end,
      to: DEFAULT_DELIMITERS.expression_end,
    },
    {
      from: resolved.comment_start,
      to: DEFAULT_DELIMITERS.comment_start,
    },
    {
      from: resolved.comment_end,
      to: DEFAULT_DELIMITERS.comment_end,
    },
  ].sort((left, right) => right.from.length - left.from.length);

  const normalizedChars: string[] = [];
  const normalizedToOriginal: number[] = [];

  let index = 0;
  while (index < template.length) {
    let matched = false;
    for (const pair of pairs) {
      if (pair.from.length === 0) {
        continue;
      }
      if (template.startsWith(pair.from, index)) {
        for (let j = 0; j < pair.to.length; j += 1) {
          normalizedChars.push(pair.to[j]);
          normalizedToOriginal.push(index + Math.min(j, pair.from.length - 1));
        }
        index += pair.from.length;
        matched = true;
        break;
      }
    }

    if (!matched) {
      normalizedChars.push(template[index]);
      normalizedToOriginal.push(index);
      index += 1;
    }
  }

  return {
    text: normalizedChars.join(''),
    toOriginalOffset: (offset) => {
      if (offset === undefined) {
        return undefined;
      }
      if (offset <= 0) {
        return 0;
      }
      if (offset >= normalizedToOriginal.length) {
        return template.length;
      }
      return normalizedToOriginal[offset];
    },
  };
}

function positionToOffset(text: string, line: number, column: number): number {
  if (line <= 1) {
    return Math.max(0, column);
  }

  let currentLine = 1;
  let currentOffset = 0;

  while (currentLine < line && currentOffset < text.length) {
    const newlineIndex = text.indexOf('\n', currentOffset);
    if (newlineIndex === -1) {
      return text.length;
    }

    currentOffset = newlineIndex + 1;
    currentLine += 1;
  }

  return Math.min(text.length, currentOffset + Math.max(0, column));
}

export function pathSegmentToString(segment: PathSegment): string {
  if (segment.type === 'property') {
    return `.${String(segment.value)}`;
  }

  if (typeof segment.value === 'string') {
    return `[${segment.value}]`;
  }

  if (segment.value.type === 'literal') {
    return `[${String(segment.value.value)}]`;
  }

  // For non-literal index expressions (segment.value.type !== 'literal'), normalize to [0]
  // for scope resolution; the original expression (segment.value.value) is intentionally not preserved.
  return '[0]';
}

function expressionToPath(node: ExpressionNode): string | null {
  switch (node.type) {
    case 'variable':
      return `${node.name}${node.path.map((segment) => pathSegmentToString(segment)).join('')}`;
    case 'filter':
      return expressionToPath(node.source);
    case 'paren':
      return expressionToPath(node.value);
    default:
      return null;
  }
}

function getDeclarationOffsets(
  template: string,
  node: ForNode,
  statementEnd: string
): { start: number; end: number } | undefined {
  const nodeStart = positionToOffset(template, node.start.line, node.start.column);
  const openingTagEnd = template.indexOf(statementEnd, nodeStart);
  if (openingTagEnd === -1) {
    return undefined;
  }

  const openingTag = template.slice(nodeStart, openingTagEnd + statementEnd.length);
  const match = openingTag.match(/\bfor\s+([A-Za-z_][\w]*)\s+in\b/);
  if (!match || typeof match.index !== 'number') {
    return undefined;
  }

  const alias = match[1];
  const aliasStart = openingTag.indexOf(alias, match.index);
  if (aliasStart === -1) {
    return undefined;
  }

  return {
    start: nodeStart + aliasStart,
    end: nodeStart + aliasStart + alias.length,
  };
}

function collectBindings(
  template: string,
  node: ASTNode,
  bindings: TemplateScopeBinding[],
  statementEnd: string
): void {
  switch (node.type) {
    case 'template':
      for (const child of node.children) {
        collectBindings(template, child, bindings, statementEnd);
      }
      return;
    case 'for': {
      const iterablePath = expressionToPath(node.iterable);
      if (iterablePath) {
        const declaration = getDeclarationOffsets(template, node, statementEnd);
        const nodeStart = positionToOffset(template, node.start.line, node.start.column);
        const openingTagEnd = template.indexOf(statementEnd, nodeStart);
        const openingTagEndOffset =
          openingTagEnd === -1 ? nodeStart : openingTagEnd + statementEnd.length;
        const scopeStartOffset =
          node.body.length > 0
            ? positionToOffset(template, node.body[0].start.line, node.body[0].start.column)
            : openingTagEndOffset;

        bindings.push({
          alias: node.iterator,
          iterablePath,
          scopeStartOffset,
          scopeEndOffset: positionToOffset(template, node.end.line, node.end.column),
          declarationStartOffset: declaration?.start,
          declarationEndOffset: declaration?.end,
        });
      }

      for (const child of node.body) {
        collectBindings(template, child, bindings, statementEnd);
      }
      return;
    }
    case 'if':
      for (const child of node.body) {
        collectBindings(template, child, bindings, statementEnd);
      }
      for (const child of node.elseBody ?? []) {
        collectBindings(template, child, bindings, statementEnd);
      }
      return;
    case 'block':
      for (const child of node.body) {
        collectBindings(template, child, bindings, statementEnd);
      }
      return;
    default:
      return;
  }
}

export function extractTemplateScopeBindings(
  template: string,
  options?: LexerOptions
): TemplateScopeBinding[] {
  const normalized = normalizeTemplateDelimiters(template, options);
  const statementEnd = DEFAULT_DELIMITERS.statement_end;
  try {
    const parseResult = parse(tokenize(normalized.text));
    const ast = parseResult.ast as TemplateNode | null;
    if (!ast) {
      return [];
    }

    const bindings: TemplateScopeBinding[] = [];
    collectBindings(normalized.text, ast, bindings, statementEnd);
    return bindings
      .map((binding) => ({
        ...binding,
        scopeStartOffset:
          normalized.toOriginalOffset(binding.scopeStartOffset) ?? binding.scopeStartOffset,
        scopeEndOffset:
          normalized.toOriginalOffset(binding.scopeEndOffset) ?? binding.scopeEndOffset,
        declarationStartOffset: normalized.toOriginalOffset(binding.declarationStartOffset),
        declarationEndOffset: normalized.toOriginalOffset(binding.declarationEndOffset),
      }))
      .sort((left, right) => left.scopeStartOffset - right.scopeStartOffset);
  } catch {
    return [];
  }
}
