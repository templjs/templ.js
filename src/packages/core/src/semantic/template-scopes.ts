import { tokenize } from '../lexer/lexer.js';
import { parse } from '../parser/parser.js';
import { DEFAULT_DELIMITERS } from '../lexer/types.js';
import type { DelimiterConfig, LexerOptions } from '../lexer/types.js';
import type {
  ASTNode,
  ExpressionNode,
  ForNode,
  PathSegment,
  SetNode,
  TemplateNode,
} from '../parser/types.js';

export type TemplateBindingKind = 'for-alias' | 'for-value-alias' | 'set-variable';

export interface TemplateBinding {
  kind: TemplateBindingKind;
  name: string;
  scopeStartOffset: number;
  scopeEndOffset: number;
  declarationStartOffset?: number;
  declarationEndOffset?: number;
  sourcePath?: string;
  sourceExpression?: string;
}

interface NormalizedTemplate {
  text: string;
  toOriginalOffset: (normalizedOffset: number | undefined) => number | undefined;
}

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
    { from: resolved.statement_start, to: DEFAULT_DELIMITERS.statement_start },
    { from: resolved.statement_end, to: DEFAULT_DELIMITERS.statement_end },
    { from: resolved.expression_start, to: DEFAULT_DELIMITERS.expression_start },
    { from: resolved.expression_end, to: DEFAULT_DELIMITERS.expression_end },
    { from: resolved.comment_start, to: DEFAULT_DELIMITERS.comment_start },
    { from: resolved.comment_end, to: DEFAULT_DELIMITERS.comment_end },
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

function normalizePathFromExpression(rawExpression: string): string | null {
  const beforeFilter = rawExpression.split('|', 1)[0]?.trim();
  if (!beforeFilter) {
    return null;
  }

  const withoutParens = beforeFilter.replace(/^\((.*)\)$/, '$1').trim();
  const pathMatch = withoutParens.match(/[A-Za-z_][\w]*(?:\[[^\]]+\]|\.[A-Za-z_][\w]*)*/);
  if (!pathMatch) {
    return null;
  }

  return pathMatch[0].replace(/\[([^\]]+)\]/g, (_segment, innerRaw: string) => {
    const inner = innerRaw.trim();
    if (/^['"].*['"]$/.test(inner)) {
      return `[${inner.slice(1, -1)}]`;
    }

    if (/^-?\d+(?:\.\d+)?$/.test(inner) || /^[A-Za-z_][\w]*$/.test(inner)) {
      return `[${inner}]`;
    }

    return '[0]';
  });
}

function getForDeclarationOffsets(
  template: string,
  node: ForNode,
  statementEnd: string
): Array<{ name: string; start: number; end: number }> {
  const nodeStart = positionToOffset(template, node.start.line, node.start.column);
  const openingTagEnd = template.indexOf(statementEnd, nodeStart);
  if (openingTagEnd === -1) {
    return [];
  }

  const openingTag = template.slice(nodeStart, openingTagEnd + statementEnd.length);
  const match = openingTag.match(/\bfor\s+([A-Za-z_][\w]*)(?:\s*,\s*([A-Za-z_][\w]*))?\s+in\b/);
  if (!match || typeof match.index !== 'number') {
    return [];
  }

  const names = [match[1], match[2]].filter((value): value is string => Boolean(value));
  const results: Array<{ name: string; start: number; end: number }> = [];
  let searchFrom = match.index;

  for (const name of names) {
    const start = openingTag.indexOf(name, searchFrom);
    if (start === -1) {
      continue;
    }
    results.push({
      name,
      start: nodeStart + start,
      end: nodeStart + start + name.length,
    });
    searchFrom = start + name.length;
  }

  return results;
}

function getForSourceExpression(
  template: string,
  node: ForNode,
  statementEnd: string
): string | undefined {
  const nodeStart = positionToOffset(template, node.start.line, node.start.column);
  const openingTagEnd = template.indexOf(statementEnd, nodeStart);
  if (openingTagEnd === -1) {
    return undefined;
  }
  const rawInner = template
    .slice(nodeStart, openingTagEnd + statementEnd.length)
    .slice(DEFAULT_DELIMITERS.statement_start.length, -statementEnd.length)
    .trim();
  const match = rawInner.match(/^for\s+[A-Za-z_][\w]*(?:\s*,\s*[A-Za-z_][\w]*)?\s+in\s+([\s\S]+)$/);
  return match?.[1]?.trim();
}

function getSetDeclarationOffset(
  template: string,
  node: SetNode,
  statementEnd: string
): { start: number; end: number } | undefined {
  const nodeStart = positionToOffset(template, node.start.line, node.start.column);
  const openingTagEnd = template.indexOf(statementEnd, nodeStart);
  if (openingTagEnd === -1) {
    return undefined;
  }
  const rawInner = template
    .slice(nodeStart, openingTagEnd + statementEnd.length)
    .slice(DEFAULT_DELIMITERS.statement_start.length, -statementEnd.length)
    .trim();
  const match = rawInner.match(/^set\s+([A-Za-z_][\w]*)\s*=\s*[\s\S]+$/);
  if (!match || typeof match.index !== 'number') {
    return undefined;
  }
  const name = match[1];
  const relativeStart = rawInner.indexOf(name, match.index);
  if (relativeStart === -1) {
    return undefined;
  }
  return {
    start: nodeStart + DEFAULT_DELIMITERS.statement_start.length + relativeStart,
    end: nodeStart + DEFAULT_DELIMITERS.statement_start.length + relativeStart + name.length,
  };
}

function getSetSourceExpression(
  template: string,
  node: SetNode,
  statementEnd: string
): string | undefined {
  const nodeStart = positionToOffset(template, node.start.line, node.start.column);
  const openingTagEnd = template.indexOf(statementEnd, nodeStart);
  if (openingTagEnd === -1) {
    return undefined;
  }
  const rawInner = template
    .slice(nodeStart, openingTagEnd + statementEnd.length)
    .slice(DEFAULT_DELIMITERS.statement_start.length, -statementEnd.length)
    .trim();
  const match = rawInner.match(/^set\s+[A-Za-z_][\w]*\s*=\s*([\s\S]+)$/);
  return match?.[1]?.trim();
}

function collectBindingsFallback(template: string): TemplateBinding[] {
  const startDelimiter = DEFAULT_DELIMITERS.statement_start;
  const endDelimiter = DEFAULT_DELIMITERS.statement_end;
  const bindings: TemplateBinding[] = [];

  type OpenLoop = {
    names: Array<{ name: string; kind: TemplateBindingKind }>;
    sourcePath: string;
    sourceExpression: string;
    scopeStartOffset: number;
    declarationOffsets: Record<string, { start: number; end: number } | undefined>;
  };

  const stack: OpenLoop[] = [];
  let cursor = 0;

  while (cursor < template.length) {
    const statementStart = template.indexOf(startDelimiter, cursor);
    if (statementStart === -1) {
      break;
    }

    const statementEnd = template.indexOf(endDelimiter, statementStart + startDelimiter.length);
    if (statementEnd === -1) {
      break;
    }

    const contentStart = statementStart + startDelimiter.length;
    const content = template.slice(contentStart, statementEnd).trim();

    const forMatch = content.match(
      /^for\s+([A-Za-z_][\w]*)(?:\s*,\s*([A-Za-z_][\w]*))?\s+in\s+([\s\S]+)$/
    );
    if (forMatch) {
      const sourceExpression = forMatch[3].trim();
      const sourcePath = normalizePathFromExpression(sourceExpression);

      if (sourcePath) {
        const names: Array<{ name: string; kind: TemplateBindingKind }> = [
          { name: forMatch[1], kind: 'for-alias' },
        ];
        if (forMatch[2]) {
          names.push({ name: forMatch[2], kind: 'for-value-alias' });
        }

        const declarationOffsets: Record<string, { start: number; end: number } | undefined> = {};
        let searchFrom = 0;
        for (const nameInfo of names) {
          const relativeIndex = content.indexOf(nameInfo.name, searchFrom);
          if (relativeIndex >= 0) {
            declarationOffsets[nameInfo.name] = {
              start: contentStart + relativeIndex,
              end: contentStart + relativeIndex + nameInfo.name.length,
            };
            searchFrom = relativeIndex + nameInfo.name.length;
          } else {
            declarationOffsets[nameInfo.name] = undefined;
          }
        }

        stack.push({
          names,
          sourcePath,
          sourceExpression,
          scopeStartOffset: statementEnd + endDelimiter.length,
          declarationOffsets,
        });
      }

      cursor = statementEnd + endDelimiter.length;
      continue;
    }

    const setMatch = content.match(/^set\s+([A-Za-z_][\w]*)\s*=\s+([\s\S]+)$/);
    if (setMatch) {
      const declarationStart = content.indexOf(setMatch[1]);
      const declarationOffset =
        declarationStart >= 0
          ? {
              start: contentStart + declarationStart,
              end: contentStart + declarationStart + setMatch[1].length,
            }
          : undefined;

      bindings.push({
        kind: 'set-variable',
        name: setMatch[1],
        sourceExpression: setMatch[2].trim(),
        sourcePath: normalizePathFromExpression(setMatch[2]) ?? undefined,
        scopeStartOffset: statementEnd + endDelimiter.length,
        scopeEndOffset: template.length,
        declarationStartOffset: declarationOffset?.start,
        declarationEndOffset: declarationOffset?.end,
      });

      cursor = statementEnd + endDelimiter.length;
      continue;
    }

    if (/^endfor\b/.test(content)) {
      const openLoop = stack.pop();
      if (openLoop) {
        for (const nameInfo of openLoop.names) {
          const declaration = openLoop.declarationOffsets[nameInfo.name];
          bindings.push({
            kind: nameInfo.kind,
            name: nameInfo.name,
            sourcePath: openLoop.sourcePath,
            sourceExpression: openLoop.sourceExpression,
            scopeStartOffset: openLoop.scopeStartOffset,
            scopeEndOffset: statementStart,
            declarationStartOffset: declaration?.start,
            declarationEndOffset: declaration?.end,
          });
        }
      }
    }

    cursor = statementEnd + endDelimiter.length;
  }

  while (stack.length > 0) {
    const openLoop = stack.pop()!;
    for (const nameInfo of openLoop.names) {
      const declaration = openLoop.declarationOffsets[nameInfo.name];
      bindings.push({
        kind: nameInfo.kind,
        name: nameInfo.name,
        sourcePath: openLoop.sourcePath,
        sourceExpression: openLoop.sourceExpression,
        scopeStartOffset: openLoop.scopeStartOffset,
        scopeEndOffset: template.length,
        declarationStartOffset: declaration?.start,
        declarationEndOffset: declaration?.end,
      });
    }
  }

  return bindings.sort((left, right) => left.scopeStartOffset - right.scopeStartOffset);
}

function collectBindings(
  template: string,
  node: ASTNode,
  bindings: TemplateBinding[],
  statementEnd: string,
  scopeBoundary: number
): void {
  switch (node.type) {
    case 'template':
      for (const child of node.children) {
        collectBindings(template, child, bindings, statementEnd, template.length);
      }
      return;
    case 'for': {
      const sourcePath = expressionToPath(node.iterable);
      const sourceExpression =
        getForSourceExpression(template, node, statementEnd) ?? sourcePath ?? '';

      if (sourcePath) {
        const declarations = getForDeclarationOffsets(template, node, statementEnd);
        const nodeStart = positionToOffset(template, node.start.line, node.start.column);
        const openingTagEnd = template.indexOf(statementEnd, nodeStart);
        const openingTagEndOffset =
          openingTagEnd === -1 ? nodeStart : openingTagEnd + statementEnd.length;
        const scopeStartOffset =
          node.body.length > 0
            ? positionToOffset(template, node.body[0].start.line, node.body[0].start.column)
            : openingTagEndOffset;
        const scopeEndOffset = positionToOffset(template, node.end.line, node.end.column);

        const names: Array<{ name: string; kind: TemplateBindingKind }> = [
          { name: node.iterator, kind: 'for-alias' },
        ];
        if (node.valueIterator) {
          names.push({ name: node.valueIterator, kind: 'for-value-alias' });
        }

        for (const nameInfo of names) {
          const declaration = declarations.find((entry) => entry.name === nameInfo.name);
          bindings.push({
            kind: nameInfo.kind,
            name: nameInfo.name,
            sourcePath,
            sourceExpression,
            scopeStartOffset,
            scopeEndOffset,
            declarationStartOffset: declaration?.start,
            declarationEndOffset: declaration?.end,
          });
        }
      }

      const forBoundary = positionToOffset(template, node.end.line, node.end.column);
      for (const child of node.body) {
        collectBindings(template, child, bindings, statementEnd, forBoundary);
      }
      return;
    }
    case 'set': {
      const declaration = getSetDeclarationOffset(template, node, statementEnd);
      const sourcePath = expressionToPath(node.value) ?? undefined;
      const sourceExpression =
        getSetSourceExpression(template, node, statementEnd) ?? sourcePath ?? undefined;
      const nodeStart = positionToOffset(template, node.start.line, node.start.column);
      const nodeEnd = positionToOffset(template, node.end.line, node.end.column);
      const scopeStartOffset = declaration?.end ?? Math.max(nodeStart, nodeEnd);

      bindings.push({
        kind: 'set-variable',
        name: node.name,
        sourcePath,
        sourceExpression,
        scopeStartOffset,
        scopeEndOffset: scopeBoundary,
        declarationStartOffset: declaration?.start,
        declarationEndOffset: declaration?.end,
      });
      return;
    }
    case 'if': {
      const ifBoundary = positionToOffset(template, node.end.line, node.end.column);
      for (const child of node.body) {
        collectBindings(template, child, bindings, statementEnd, ifBoundary);
      }
      for (const child of node.elseBody ?? []) {
        collectBindings(template, child, bindings, statementEnd, ifBoundary);
      }
      return;
    }
    case 'block': {
      const blockBoundary = positionToOffset(template, node.end.line, node.end.column);
      for (const child of node.body) {
        collectBindings(template, child, bindings, statementEnd, blockBoundary);
      }
      return;
    }
    default:
      return;
  }
}

function mapBindingOffsets(
  binding: TemplateBinding,
  toOriginalOffset: (normalizedOffset: number | undefined) => number | undefined
): TemplateBinding {
  return {
    ...binding,
    scopeStartOffset: toOriginalOffset(binding.scopeStartOffset) ?? binding.scopeStartOffset,
    scopeEndOffset: toOriginalOffset(binding.scopeEndOffset) ?? binding.scopeEndOffset,
    declarationStartOffset: toOriginalOffset(binding.declarationStartOffset),
    declarationEndOffset: toOriginalOffset(binding.declarationEndOffset),
  };
}

export function getTemplateBindingsAtOffset(
  bindings: TemplateBinding[],
  offset: number
): TemplateBinding[] {
  return bindings
    .filter((binding) => offset >= binding.scopeStartOffset && offset < binding.scopeEndOffset)
    .sort((left, right) => right.scopeStartOffset - left.scopeStartOffset);
}

export function extractTemplateBindings(
  template: string,
  options?: LexerOptions
): TemplateBinding[] {
  const normalized = normalizeTemplateDelimiters(template, options);
  const statementEnd = DEFAULT_DELIMITERS.statement_end;

  try {
    const parseResult = parse(tokenize(normalized.text));
    const ast = parseResult.ast as TemplateNode | null;
    const bindings: TemplateBinding[] = [];

    if (ast) {
      collectBindings(normalized.text, ast, bindings, statementEnd, normalized.text.length);
    }

    const recoveredBindings =
      bindings.length === 0 && parseResult.errors.length > 0
        ? collectBindingsFallback(normalized.text)
        : bindings;

    if (recoveredBindings.length === 0) {
      return [];
    }

    return recoveredBindings
      .map((binding) => mapBindingOffsets(binding, normalized.toOriginalOffset))
      .sort((left, right) => left.scopeStartOffset - right.scopeStartOffset);
  } catch {
    return [];
  }
}
