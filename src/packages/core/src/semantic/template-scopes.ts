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
  inferredPaths?: string[];
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
      /* c8 ignore next */
      /* v8 ignore next */
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

/* c8 ignore start */
function splitTopLevelEntries(content: string): string[] {
  const entries: string[] = [];
  let depthCurly = 0;
  let depthSquare = 0;
  let depthParen = 0;
  let quote: '"' | "'" | null = null;
  let escape = false;
  let start = 0;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];

    if (quote) {
      if (escape) {
        escape = false;
        continue;
      }
      if (char === '\\') {
        escape = true;
        continue;
      }
      if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === '{') {
      depthCurly += 1;
      continue;
    }
    if (char === '}') {
      depthCurly = Math.max(0, depthCurly - 1);
      continue;
    }
    if (char === '[') {
      depthSquare += 1;
      continue;
    }
    if (char === ']') {
      depthSquare = Math.max(0, depthSquare - 1);
      continue;
    }
    if (char === '(') {
      depthParen += 1;
      continue;
    }
    if (char === ')') {
      depthParen = Math.max(0, depthParen - 1);
      continue;
    }

    if (char === ',' && depthCurly === 0 && depthSquare === 0 && depthParen === 0) {
      const entry = content.slice(start, index).trim();
      if (entry.length > 0) {
        entries.push(entry);
      }
      start = index + 1;
    }
  }

  const trailing = content.slice(start).trim();
  if (trailing.length > 0) {
    entries.push(trailing);
  }

  return entries;
}

function splitTopLevelKeyValue(entry: string): { keyRaw: string; valueRaw: string } | null {
  let depthCurly = 0;
  let depthSquare = 0;
  let depthParen = 0;
  let quote: '"' | "'" | null = null;
  let escape = false;

  for (let index = 0; index < entry.length; index += 1) {
    const char = entry[index];

    if (quote) {
      if (escape) {
        escape = false;
        continue;
      }
      if (char === '\\') {
        escape = true;
        continue;
      }
      if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === '{') {
      depthCurly += 1;
      continue;
    }
    if (char === '}') {
      depthCurly = Math.max(0, depthCurly - 1);
      continue;
    }
    if (char === '[') {
      depthSquare += 1;
      continue;
    }
    if (char === ']') {
      depthSquare = Math.max(0, depthSquare - 1);
      continue;
    }
    if (char === '(') {
      depthParen += 1;
      continue;
    }
    if (char === ')') {
      depthParen = Math.max(0, depthParen - 1);
      continue;
    }

    if (char === ':' && depthCurly === 0 && depthSquare === 0 && depthParen === 0) {
      const keyRaw = entry.slice(0, index).trim();
      const valueRaw = entry.slice(index + 1).trim();
      if (!keyRaw || !valueRaw) {
        return null;
      }
      return { keyRaw, valueRaw };
    }
  }

  return null;
}

function normalizeObjectKey(keyRaw: string): string | null {
  if (/^[A-Za-z_][\w]*$/.test(keyRaw)) {
    return keyRaw;
  }

  const quoted = keyRaw.match(/^['"](.+)['"]$/);
  if (quoted?.[1]) {
    return quoted[1];
  }

  return null;
}

function collectObjectLiteralPaths(expression: string, prefix = ''): string[] {
  const trimmed = expression.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return [];
  }

  const inner = trimmed.slice(1, -1).trim();
  if (!inner) {
    return [];
  }

  const paths: string[] = [];
  for (const entry of splitTopLevelEntries(inner)) {
    const keyValue = splitTopLevelKeyValue(entry);
    if (!keyValue) {
      continue;
    }

    const key = normalizeObjectKey(keyValue.keyRaw);
    if (!key) {
      continue;
    }

    const path = prefix ? `${prefix}.${key}` : key;
    paths.push(path);
    paths.push(...collectObjectLiteralPaths(keyValue.valueRaw, path));
  }

  return paths;
}

function inferPathsFromSourceExpression(sourceExpression?: string): string[] | undefined {
  if (!sourceExpression) {
    return undefined;
  }

  const inferred = Array.from(new Set(collectObjectLiteralPaths(sourceExpression))).sort((a, b) =>
    a.localeCompare(b)
  );

  return inferred.length > 0 ? inferred : undefined;
}
/* c8 ignore stop */

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

  const rawInnerStart = nodeStart + DEFAULT_DELIMITERS.statement_start.length;
  const rawInner = template.slice(rawInnerStart, openingTagEnd);
  const parsed = parseFallbackForStatement(rawInner);
  if (!parsed) {
    return [];
  }

  return parsed.names.map((nameInfo) => ({
    name: nameInfo.name,
    start: rawInnerStart + nameInfo.declarationStart,
    end: rawInnerStart + nameInfo.declarationEnd,
  }));
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
  const rawInner = template.slice(
    nodeStart + DEFAULT_DELIMITERS.statement_start.length,
    openingTagEnd
  );
  return parseFallbackForStatement(rawInner)?.sourceExpression;
}

function getSetDeclarationOffset(
  template: string,
  node: SetNode,
  statementEnd: string
): { start: number; end: number } | undefined {
  const nodeStart = positionToOffset(template, node.start.line, node.start.column);
  const openingTagEnd = template.indexOf(statementEnd, nodeStart);
  /* c8 ignore next */
  /* v8 ignore next */
  if (openingTagEnd === -1) {
    return undefined;
  }
  const rawInnerStart = nodeStart + DEFAULT_DELIMITERS.statement_start.length;
  const rawInner = template.slice(rawInnerStart, openingTagEnd);
  const parsed = parseFallbackSetStatement(rawInner);
  if (!parsed) {
    return undefined;
  }

  return {
    start: rawInnerStart + parsed.declarationStart,
    end: rawInnerStart + parsed.declarationEnd,
  };
}

function getSetSourceExpression(
  template: string,
  node: SetNode,
  statementEnd: string
): string | undefined {
  const nodeStart = positionToOffset(template, node.start.line, node.start.column);
  const openingTagEnd = template.indexOf(statementEnd, nodeStart);
  /* c8 ignore next */
  /* v8 ignore next */
  if (openingTagEnd === -1) {
    return undefined;
  }
  const rawInner = template.slice(
    nodeStart + DEFAULT_DELIMITERS.statement_start.length,
    openingTagEnd
  );
  return parseFallbackSetStatement(rawInner)?.sourceExpression;
}

/* c8 ignore start */
function isWhitespaceChar(char: string | undefined): boolean {
  return char === ' ' || char === '\t' || char === '\n' || char === '\r';
}

function isIdentifierStart(char: string | undefined): boolean {
  if (!char) {
    return false;
  }
  const code = char.charCodeAt(0);
  return char === '_' || (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function isIdentifierPart(char: string | undefined): boolean {
  if (!char) {
    return false;
  }
  const code = char.charCodeAt(0);
  return (
    char === '_' ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    (code >= 48 && code <= 57)
  );
}

function skipWhitespace(text: string, index: number): number {
  let cursor = index;
  while (cursor < text.length && isWhitespaceChar(text[cursor])) {
    cursor += 1;
  }
  return cursor;
}

function trimStatementTrimMarker(value: string): string {
  const trimmed = value.trimEnd();
  if (trimmed.endsWith('-')) {
    return trimmed.slice(0, -1).trimEnd();
  }
  return trimmed;
}

function stripLeadingStatementTrimMarker(rawContent: string): {
  content: string;
  offsetDelta: number;
} {
  const firstNonWhitespace = skipWhitespace(rawContent, 0);
  if (rawContent[firstNonWhitespace] !== '-') {
    return { content: rawContent, offsetDelta: 0 };
  }

  const afterMarker = skipWhitespace(rawContent, firstNonWhitespace + 1);
  return {
    content: rawContent.slice(afterMarker),
    offsetDelta: afterMarker,
  };
}

function parseLeadingIdentifier(
  text: string,
  startIndex: number
): { value: string; start: number; end: number } | null {
  const start = skipWhitespace(text, startIndex);
  if (!isIdentifierStart(text[start])) {
    return null;
  }

  let end = start + 1;
  while (end < text.length && isIdentifierPart(text[end])) {
    end += 1;
  }

  return {
    value: text.slice(start, end),
    start,
    end,
  };
}

function isKeywordAt(
  text: string,
  keyword: string,
  index: number
): { start: number; end: number } | null {
  const start = skipWhitespace(text, index);
  if (!text.startsWith(keyword, start)) {
    return null;
  }

  const end = start + keyword.length;
  const nextChar = text[end];
  if (nextChar && !isWhitespaceChar(nextChar) && nextChar !== '=') {
    return null;
  }

  return { start, end };
}

function parseFallbackForStatement(rawContent: string): {
  names: Array<{
    name: string;
    kind: TemplateBindingKind;
    declarationStart: number;
    declarationEnd: number;
  }>;
  sourceExpression: string;
} | null {
  const normalized = stripLeadingStatementTrimMarker(rawContent);
  const statementContent = normalized.content;

  const forKeyword = isKeywordAt(statementContent, 'for', 0);
  if (!forKeyword) {
    return null;
  }

  const iterator = parseLeadingIdentifier(statementContent, forKeyword.end);
  if (!iterator) {
    return null;
  }

  const names: Array<{
    name: string;
    kind: TemplateBindingKind;
    declarationStart: number;
    declarationEnd: number;
  }> = [
    {
      name: iterator.value,
      kind: 'for-alias',
      declarationStart: iterator.start + normalized.offsetDelta,
      declarationEnd: iterator.end + normalized.offsetDelta,
    },
  ];

  let cursor = skipWhitespace(statementContent, iterator.end);
  if (statementContent[cursor] === ',') {
    cursor += 1;
    const valueIterator = parseLeadingIdentifier(statementContent, cursor);
    if (!valueIterator) {
      return null;
    }

    names.push({
      name: valueIterator.value,
      kind: 'for-value-alias',
      declarationStart: valueIterator.start + normalized.offsetDelta,
      declarationEnd: valueIterator.end + normalized.offsetDelta,
    });

    cursor = valueIterator.end;
  }

  const inKeyword = isKeywordAt(statementContent, 'in', cursor);
  if (!inKeyword) {
    return null;
  }

  const expressionStart = skipWhitespace(statementContent, inKeyword.end);
  const sourceExpression = trimStatementTrimMarker(statementContent.slice(expressionStart));
  if (!sourceExpression) {
    return null;
  }

  return {
    names,
    sourceExpression,
  };
}

function parseFallbackSetStatement(rawContent: string): {
  name: string;
  declarationStart: number;
  declarationEnd: number;
  sourceExpression: string;
} | null {
  const normalized = stripLeadingStatementTrimMarker(rawContent);
  const statementContent = normalized.content;

  const setKeyword = isKeywordAt(statementContent, 'set', 0);
  if (!setKeyword) {
    return null;
  }

  const name = parseLeadingIdentifier(statementContent, setKeyword.end);
  if (!name) {
    return null;
  }

  let cursor = skipWhitespace(statementContent, name.end);
  if (statementContent[cursor] !== '=') {
    return null;
  }

  cursor += 1;
  const expressionStart = skipWhitespace(statementContent, cursor);
  const sourceExpression = trimStatementTrimMarker(statementContent.slice(expressionStart));
  if (!sourceExpression) {
    return null;
  }

  return {
    name: name.value,
    declarationStart: name.start + normalized.offsetDelta,
    declarationEnd: name.end + normalized.offsetDelta,
    sourceExpression,
  };
}

function isFallbackEndForStatement(rawContent: string): boolean {
  const normalized = stripLeadingStatementTrimMarker(rawContent);
  const statementContent = normalized.content;

  const keyword = isKeywordAt(statementContent, 'endfor', 0);
  if (!keyword) {
    return false;
  }

  const remainder = statementContent.slice(keyword.end).trim();
  return remainder.length === 0 || remainder === '-';
}
/* c8 ignore stop */

function collectBindingsFallback(template: string): TemplateBinding[] {
  const startDelimiter = DEFAULT_DELIMITERS.statement_start;
  const endDelimiter = DEFAULT_DELIMITERS.statement_end;
  const bindings: TemplateBinding[] = [];

  type OpenLoop = {
    names: Array<{ name: string; kind: TemplateBindingKind }>;
    sourcePath?: string;
    sourceExpression: string;
    inferredPaths?: string[];
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
    const rawContent = template.slice(contentStart, statementEnd);
    const content = rawContent.trim();

    const forStatement = parseFallbackForStatement(rawContent);
    if (forStatement) {
      const sourceExpression = forStatement.sourceExpression;
      const sourcePath = normalizePathFromExpression(sourceExpression);
      const inferredPaths = inferPathsFromSourceExpression(sourceExpression);

      const names = forStatement.names.map((nameInfo) => ({
        name: nameInfo.name,
        kind: nameInfo.kind,
      }));
      const declarationOffsets: Record<string, { start: number; end: number } | undefined> = {};
      for (const nameInfo of forStatement.names) {
        declarationOffsets[nameInfo.name] = {
          start: contentStart + nameInfo.declarationStart,
          end: contentStart + nameInfo.declarationEnd,
        };
      }

      stack.push({
        names,
        sourcePath: sourcePath ?? undefined,
        sourceExpression,
        inferredPaths,
        scopeStartOffset: statementEnd + endDelimiter.length,
        declarationOffsets,
      });

      cursor = statementEnd + endDelimiter.length;
      continue;
    }

    const setStatement = parseFallbackSetStatement(rawContent);
    if (setStatement) {
      const declarationOffset = {
        start: contentStart + setStatement.declarationStart,
        end: contentStart + setStatement.declarationEnd,
      };

      bindings.push({
        kind: 'set-variable',
        name: setStatement.name,
        sourceExpression: setStatement.sourceExpression,
        sourcePath: normalizePathFromExpression(setStatement.sourceExpression) ?? undefined,
        inferredPaths: inferPathsFromSourceExpression(setStatement.sourceExpression),
        scopeStartOffset: statementEnd + endDelimiter.length,
        scopeEndOffset: template.length,
        declarationStartOffset: declarationOffset.start,
        declarationEndOffset: declarationOffset.end,
      });

      cursor = statementEnd + endDelimiter.length;
      continue;
    }

    if (isFallbackEndForStatement(content)) {
      const openLoop = stack.pop();
      if (openLoop) {
        for (const nameInfo of openLoop.names) {
          const declaration = openLoop.declarationOffsets[nameInfo.name];
          const inferredPaths =
            openLoop.names.length === 1 || nameInfo.kind === 'for-value-alias'
              ? openLoop.inferredPaths
              : undefined;
          bindings.push({
            kind: nameInfo.kind,
            name: nameInfo.name,
            sourcePath: openLoop.sourcePath,
            sourceExpression: openLoop.sourceExpression,
            inferredPaths,
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
      const inferredPaths =
        openLoop.names.length === 1 || nameInfo.kind === 'for-value-alias'
          ? openLoop.inferredPaths
          : undefined;
      bindings.push({
        kind: nameInfo.kind,
        name: nameInfo.name,
        sourcePath: openLoop.sourcePath,
        sourceExpression: openLoop.sourceExpression,
        inferredPaths,
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
      const sourcePath = expressionToPath(node.iterable) ?? undefined;
      const sourceExpression =
        getForSourceExpression(template, node, statementEnd) ?? sourcePath ?? '';
      const inferredPaths = inferPathsFromSourceExpression(sourceExpression);

      if (sourcePath || inferredPaths?.length) {
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
          const bindingInferredPaths =
            names.length === 1 || nameInfo.kind === 'for-value-alias' ? inferredPaths : undefined;
          bindings.push({
            kind: nameInfo.kind,
            name: nameInfo.name,
            sourcePath,
            sourceExpression,
            inferredPaths: bindingInferredPaths,
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
        inferredPaths: inferPathsFromSourceExpression(sourceExpression),
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
    /* c8 ignore next */
    /* v8 ignore next */
    scopeStartOffset: toOriginalOffset(binding.scopeStartOffset) ?? binding.scopeStartOffset,
    /* c8 ignore next */
    /* v8 ignore next */
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

    const fallbackBindings =
      parseResult.errors.length > 0 ? collectBindingsFallback(normalized.text) : [];

    const bindingQuality = (binding: TemplateBinding): number => {
      let score = 0;
      if (binding.scopeEndOffset > binding.scopeStartOffset) {
        score += 2;
      }
      if (binding.sourcePath) {
        score += 1;
      }
      return score;
    };

    const rangesOverlap = (
      leftStart: number,
      leftEnd: number,
      rightStart: number,
      rightEnd: number
    ): boolean => leftStart < rightEnd && rightStart < leftEnd;

    const hasValidScopeRange = (binding: TemplateBinding): boolean =>
      binding.scopeEndOffset > binding.scopeStartOffset;

    /* c8 ignore start */
    /* v8 ignore start */
    const declarationOffsetsAreClose = (left: TemplateBinding, right: TemplateBinding): boolean => {
      if (
        left.declarationStartOffset === undefined ||
        left.declarationEndOffset === undefined ||
        right.declarationStartOffset === undefined ||
        right.declarationEndOffset === undefined
      ) {
        return false;
      }

      return (
        Math.abs(left.declarationStartOffset - right.declarationStartOffset) <= 1 &&
        Math.abs(left.declarationEndOffset - right.declarationEndOffset) <= 1
      );
    };
    /* v8 ignore stop */
    /* c8 ignore stop */

    const mergedBindings = [...bindings];
    for (const fallbackBinding of fallbackBindings) {
      const matchingIndex = mergedBindings.findIndex(
        (existingBinding) =>
          existingBinding.kind === fallbackBinding.kind &&
          existingBinding.name === fallbackBinding.name &&
          (rangesOverlap(
            existingBinding.scopeStartOffset,
            existingBinding.scopeEndOffset,
            fallbackBinding.scopeStartOffset,
            fallbackBinding.scopeEndOffset
          ) ||
            !hasValidScopeRange(existingBinding) ||
            !hasValidScopeRange(fallbackBinding)) &&
          declarationOffsetsAreClose(existingBinding, fallbackBinding)
      );

      if (matchingIndex === -1) {
        mergedBindings.push(fallbackBinding);
        continue;
      }

      const existingBinding = mergedBindings[matchingIndex];
      const existingQuality = bindingQuality(existingBinding);
      const fallbackQuality = bindingQuality(fallbackBinding);
      if (
        fallbackQuality > existingQuality ||
        (fallbackQuality === existingQuality &&
          fallbackBinding.scopeEndOffset > existingBinding.scopeEndOffset)
      ) {
        mergedBindings[matchingIndex] = fallbackBinding;
      }
    }

    if (mergedBindings.length === 0) {
      return [];
    }

    return mergedBindings
      .map((binding) => mapBindingOffsets(binding, normalized.toOriginalOffset))
      .sort((left, right) => left.scopeStartOffset - right.scopeStartOffset);
  } catch {
    return [];
  }
}
