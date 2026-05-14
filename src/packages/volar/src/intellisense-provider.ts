import {
  extractTemplateStatementExpression,
  getBuiltinFilterNames,
  getBuiltinFilterSignatures,
  parseTemplateForHeader as parseCoreTemplateForHeader,
  resolveSemanticHostLanguage,
  resolveSemanticZoneByHostLanguage,
  resolveSemanticZone,
  type FunctionSignature,
} from '@templjs/core';
import {
  resolveDelimiters,
  type DelimiterConfig as IntellisenseDelimiters,
} from './template-delimiters.js';
import {
  extractExpressionFilterReferences,
  extractExpressionVariableReferences,
} from './expression-analysis.js';
import { buildForScopesInText, resolveScopedPath } from './scope-resolution.js';
import {
  createContextGraphSemanticReadAdapter,
  type ContextGraphSemanticReadAdapter,
  type SemanticQueryContext,
} from './context-graph-adapter.js';
import {
  createSemantifyServices,
  type CandidateItem,
  type DelimiterConfigInput as SemantifyDelimiterConfigInput,
  type SemantifyServices,
} from '@templjs/semantify';

export interface CompletionItem {
  label: string;
  kind: 'variable' | 'filter' | 'keyword' | 'property';
  detail?: string;
  documentation?: string;
}

export interface HoverInfo {
  contents: string;
}

export interface DefinitionLocation {
  uri: string;
  path?: string;
  pathKind?: 'property' | 'value';
  valueToken?: string;
  range?: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

export interface SignatureHelp {
  name: string;
  documentation?: string;
  parameters: Array<{ name: string; type: string; documentation?: string }>;
}

export interface IntellisenseOptions {
  schema?: object;
  schemaUri?: string;
  contentSchema?: object;
  contentSchemaUri?: string;
  documentUri?: string;
  workspaceRoot?: string;
  debugLog?: (message: string, level?: 'messages' | 'verbose') => void;
  customFilters?: FilterSignature[];
  customKeywords?: string[];
  delimiters?: Partial<IntellisenseDelimiters>;
}

export type { IntellisenseDelimiters };

export interface FilterSignature {
  name: string;
  description: string;
  returnType: string;
  parameters: Array<{ name: string; type: string; description?: string }>;
}

export type SemanticReadAdapter = Pick<
  ContextGraphSemanticReadAdapter,
  | 'resolveScopedPath'
  | 'getChildCompletions'
  | 'getEnumValueCompletions'
  | 'getPathDetails'
  | 'resolvePathDefinition'
  | 'resolveDocumentDefinition'
  | 'resolveLocalAliasDefinition'
>;

const DEFAULT_KEYWORDS = [
  'if',
  'elif',
  'else',
  'endif',
  'for',
  'endfor',
  'block',
  'endblock',
  'include',
  'set',
  'in',
];

const BUILTIN_FILTER_SIGNATURES = getBuiltinFilterSignatures();

function getDefaultFilters(): FilterSignature[] {
  return getBuiltinFilterNames().map((name: string) => {
    const signature =
      BUILTIN_FILTER_SIGNATURES[name] ??
      ({
        name,
        description: `Apply ${name} filter.`,
        returnType: 'any',
        parameters: [],
      } satisfies FilterSignature);

    return {
      name: signature.name,
      description: signature.description,
      returnType: signature.returnType,
      parameters: signature.parameters.map((param: FunctionSignature['parameters'][number]) => ({
        name: param.name,
        type: param.type,
        description: param.description,
      })),
    };
  });
}

function getDelimiters(options?: IntellisenseOptions): IntellisenseDelimiters {
  return resolveDelimiters(options?.delimiters);
}

function findEnclosingRange(
  text: string,
  offset: number,
  start: string,
  end: string,
  allowOpen: boolean
): { start: number; end: number } | null {
  const startIndex = text.lastIndexOf(start, offset);
  if (startIndex === -1) return null;
  const endIndex = text.indexOf(end, startIndex + start.length);
  if (endIndex === -1) {
    return allowOpen ? { start: startIndex, end: text.length } : null;
  }
  const rangeEnd = endIndex + end.length;
  if (offset > rangeEnd) {
    return null;
  }
  return { start: startIndex, end: rangeEnd };
}

function findEnclosingRangeNearOffset(
  text: string,
  offset: number,
  start: string,
  end: string,
  allowOpen: boolean
): { start: number; end: number } | null {
  const direct = findEnclosingRange(text, offset, start, end, allowOpen);
  if (direct) {
    return direct;
  }

  if (offset > 0) {
    return findEnclosingRange(text, offset - 1, start, end, allowOpen);
  }

  return null;
}

function createScopedPathResolver(
  semanticReadAdapter: SemanticReadAdapter,
  text: string,
  offset: number,
  delimiters: IntellisenseDelimiters
): (basePath: string) => string {
  const scopeOffset = Math.max(0, offset - 1);
  const forScopes = buildForScopesInText(text, delimiters);

  return (basePath: string): string => {
    const graphResolved = semanticReadAdapter.resolveScopedPath(text, basePath, scopeOffset);
    if (graphResolved !== basePath) {
      return graphResolved;
    }

    return resolveScopedPath(basePath, scopeOffset, forScopes);
  };
}

type LocalAliasResolution = {
  alias: string;
  declaration: { start: number; end: number };
  isAliasTokenOnly: boolean;
};

function resolveLocalAliasReference(
  semanticReadAdapter: SemanticReadAdapter,
  text: string,
  variablePath: string,
  offset: number
): LocalAliasResolution | null {
  const declaration = semanticReadAdapter.resolveLocalAliasDefinition(text, variablePath, offset);
  if (!declaration) {
    return null;
  }

  const alias = variablePath.split(/[.[]/, 1)[0] ?? variablePath;
  const isAliasTokenOnly = /^[A-Za-z_][\w]*$/.test(variablePath);

  return {
    alias,
    declaration,
    isAliasTokenOnly,
  };
}

function buildSemanticQueryContext(
  text: string,
  offset: number,
  operation: SemanticQueryContext['operation'],
  semanticZone: NonNullable<SemanticQueryContext['semanticZone']>,
  documentUri?: string
): SemanticQueryContext {
  const position = getPositionForOffset(text, offset);
  return {
    operation,
    contextBlock: semanticZone.legacyContextBlock,
    semanticZone,
    documentUri,
    offset,
    line: position.line,
    character: position.character,
  };
}

function resolveSemanticQueryZone(
  text: string,
  offset: number,
  documentUri?: string
): NonNullable<SemanticQueryContext['semanticZone']> {
  const hostLanguage = resolveSemanticHostLanguage(documentUri);
  if (hostLanguage === 'unknown') {
    return resolveSemanticZone(text, offset);
  }

  return resolveSemanticZoneByHostLanguage(text, offset, hostLanguage);
}

const VALID_COMPLETION_KINDS = new Set<CompletionItem['kind']>([
  'variable',
  'filter',
  'keyword',
  'property',
]);

function coerceCandidates(items: CandidateItem[]): CompletionItem[] {
  return items.map((item) => ({
    label: item.label,
    kind: VALID_COMPLETION_KINDS.has(item.kind as CompletionItem['kind'])
      ? (item.kind as CompletionItem['kind'])
      : 'variable',
    detail: item.detail,
    documentation: item.documentation,
  }));
}

function getCandidateStartOffset(item: CandidateItem): number {
  const metadata = item.metadata as { startOffset?: unknown } | undefined;
  const startOffset = metadata?.startOffset;
  return typeof startOffset === 'number' ? startOffset : Number.NEGATIVE_INFINITY;
}

function dedupeCandidatesByNearestLabel(items: CandidateItem[]): CandidateItem[] {
  if (items.length <= 1) {
    return items;
  }

  const nearestByLabel = new Map<string, CandidateItem>();
  for (const item of items) {
    const key = item.label.toLowerCase();
    const current = nearestByLabel.get(key);
    if (!current || getCandidateStartOffset(item) >= getCandidateStartOffset(current)) {
      nearestByLabel.set(key, item);
    }
  }

  return items.filter((item) => nearestByLabel.get(item.label.toLowerCase()) === item);
}

function applyFilterSignatureMetadata(
  items: CompletionItem[],
  filters: FilterSignature[]
): CompletionItem[] {
  if (items.length === 0) {
    return items;
  }

  return items.map((item) => {
    if (item.kind !== 'filter') {
      return item;
    }

    const signature = resolveFilterSignature(filters, item.label);
    if (!signature) {
      return item;
    }

    return {
      ...item,
      detail: signature.returnType,
      documentation: signature.description,
    };
  });
}

function getKeywordCompletions(keywords: string[]): CompletionItem[] {
  return keywords.map((keyword) => ({
    label: keyword,
    kind: 'keyword',
  }));
}

function filterAndSortCompletions(items: CompletionItem[], rawPrefix: string): CompletionItem[] {
  const prefix = rawPrefix.trim().toLowerCase();
  if (!prefix) {
    return items;
  }

  const withScore = items
    .map((item) => {
      const label = item.label.toLowerCase();
      const startsWith = label.startsWith(prefix);
      const includes = label.includes(prefix);

      if (!startsWith && !includes) {
        return null;
      }

      return {
        item,
        score: startsWith ? 0 : 1,
      };
    })
    .filter((entry): entry is { item: CompletionItem; score: number } => entry !== null)
    .sort((left, right) => {
      if (left.score !== right.score) {
        return left.score - right.score;
      }
      return left.item.label.localeCompare(right.item.label);
    });

  return withScore.map((entry) => entry.item);
}

function mergeUniqueCompletions(
  primary: CompletionItem[],
  secondary: CompletionItem[]
): CompletionItem[] {
  if (secondary.length === 0) {
    return primary;
  }

  // Combine primary and secondary, keeping duplicates within each source
  // but avoiding duplicates across sources
  const seenFromPrimary = new Set(primary.map((item) => item.label.toLowerCase()));
  const merged = [...primary];

  for (const item of secondary) {
    const key = item.label.toLowerCase();
    if (seenFromPrimary.has(key)) {
      continue; // Skip items from secondary that are already in primary
    }
    merged.push(item);
  }

  return merged;
}

function dedupeCompletionItems(items: CompletionItem[]): CompletionItem[] {
  if (items.length <= 1) {
    return items;
  }

  const seen = new Set<string>();
  const deduped: CompletionItem[] = [];
  for (const item of items) {
    const key = `${item.label.toLowerCase()}::${item.kind}::${item.detail ?? ''}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}

function summarizeDuplicateLabels(items: CompletionItem[]): string[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = item.label.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, total]) => total > 1)
    .map(([label, total]) => `${label}×${total}`)
    .sort((left, right) => left.localeCompare(right));
}

function logCompletionSummary(
  options: IntellisenseOptions | undefined,
  branch: string,
  items: CompletionItem[]
): void {
  options?.debugLog?.(`[intellisense] completion branch=${branch} count=${items.length}`);
  const duplicates = summarizeDuplicateLabels(items);
  if (duplicates.length > 0) {
    options?.debugLog?.(
      `[intellisense] completion duplicate labels: ${duplicates.slice(0, 12).join(', ')}`,
      'messages'
    );
  }

  if (items.length > 0) {
    options?.debugLog?.(
      `[intellisense] completion top labels: ${items
        .slice(0, 8)
        .map((item) => JSON.stringify(item.label))
        .join(', ')}`,
      'verbose'
    );
  }
}

function resolveFilterSignature(filters: FilterSignature[], name: string): FilterSignature | null {
  return filters.find((filter) => filter.name === name) ?? null;
}

function normalizeExpression(text: string, delimiters: IntellisenseDelimiters): string {
  const trimmed = text.trim();
  if (
    trimmed.startsWith(delimiters.expressionStart) &&
    trimmed.endsWith(delimiters.expressionEnd)
  ) {
    return trimmed
      .slice(delimiters.expressionStart.length, -delimiters.expressionEnd.length)
      .trim();
  }
  return trimmed;
}

function getVariablePathAtOffset(content: string, offsetInContent: number): string | null {
  const refs = extractExpressionVariableReferences(content);
  const activeRef = refs.find((ref) => offsetInContent >= ref.start && offsetInContent <= ref.end);
  if (activeRef) {
    return activeRef.path;
  }

  if (refs.length === 1) {
    return refs[0].path;
  }

  return null;
}

function splitPathSegments(path: string): string[] {
  if (!path) {
    return [];
  }

  const segments: string[] = [];
  let start = 0;
  let bracketDepth = 0;

  for (let index = 0; index < path.length; index += 1) {
    const char = path[index];
    if (char === '[') {
      bracketDepth += 1;
      continue;
    }

    if (char === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1);
      continue;
    }

    if (char === '.' && bracketDepth === 0) {
      segments.push(path.slice(start, index));
      start = index + 1;
    }
  }

  segments.push(path.slice(start));

  return segments.filter((segment) => segment.length > 0);
}

function getVariablePathPrefixAtOffset(content: string, offsetInContent: number): string | null {
  const refs = extractExpressionVariableReferences(content);
  const activeRef = refs.find((ref) => offsetInContent >= ref.start && offsetInContent <= ref.end);
  const targetRef = activeRef ?? (refs.length === 1 ? refs[0] : null);
  if (!targetRef) {
    return null;
  }

  const segments = splitPathSegments(targetRef.path);
  if (segments.length === 0) {
    return null;
  }

  let relativeOffset = Math.max(
    0,
    Math.min(offsetInContent - targetRef.start, targetRef.path.length - 1)
  );
  if (targetRef.path[relativeOffset] === '.' && relativeOffset > 0) {
    relativeOffset -= 1;
  }

  let cursor = 0;
  for (let index = 0; index < segments.length; index += 1) {
    const segmentLength = segments[index].length;
    const segmentStart = cursor;
    const segmentEnd = segmentStart + segmentLength - 1;
    if (relativeOffset >= segmentStart && relativeOffset <= segmentEnd) {
      return segments.slice(0, index + 1).join('.');
    }

    cursor = segmentEnd + 2;
  }

  return targetRef.path;
}

function getFilterNameAtOffset(content: string, offsetInContent: number): string | null {
  const refs = extractExpressionFilterReferences(content);
  const activeRef = refs.find((ref) => offsetInContent >= ref.start && offsetInContent <= ref.end);
  if (activeRef) {
    return activeRef.name;
  }

  if (refs.length === 1) {
    return refs[0].name;
  }

  return null;
}

function getLineAtOffset(
  text: string,
  offset: number
): { lineStart: number; lineEnd: number; line: string } {
  const lineStart = text.lastIndexOf('\n', Math.max(0, offset - 1)) + 1;
  const nextNewline = text.indexOf('\n', offset);
  const lineEnd = nextNewline === -1 ? text.length : nextNewline;
  return {
    lineStart,
    lineEnd,
    line: text.slice(lineStart, lineEnd),
  };
}

type FrontmatterContext = {
  key?: string;
  path?: string;
  parentPath?: string;
  keyPrefix: string;
  inKey: boolean;
  inValue: boolean;
  valuePrefix: string;
  valueToken?: string;
};

function getFrontmatterContext(text: string, offset: number): FrontmatterContext {
  const { lineStart, line } = getLineAtOffset(text, offset);
  const match = line.match(/^(\s*)(["']?)([A-Za-z_$][\w$-]*)(["']?\s*:\s*)(.*)$/);

  if (!match) {
    return {
      keyPrefix: line.trim(),
      inKey: true,
      inValue: false,
      valuePrefix: '',
    };
  }

  const [, indent, keyPrefixQuote, key, separator, rawValue] = match;
  const keyStart = lineStart + indent.length + keyPrefixQuote.length;
  const keyEnd = keyStart + key.length;
  const valueStart = keyEnd + separator.length;
  const keyCursor = offset >= keyStart && offset <= keyEnd;
  const valueCursor = offset >= valueStart;

  const keyPrefix = keyCursor
    ? key.slice(0, Math.max(0, Math.min(offset - keyStart, key.length)))
    : key;

  const safeValueOffset = Math.max(0, offset - valueStart);
  const valuePrefix = valueCursor
    ? rawValue.slice(0, Math.min(rawValue.length, safeValueOffset))
    : '';

  const tokenChars = /[A-Za-z0-9_./:#$~+-]/;
  const cursorInRawValue = Math.max(0, Math.min(rawValue.length, safeValueOffset));
  let tokenStart = cursorInRawValue;
  while (tokenStart > 0 && tokenChars.test(rawValue[tokenStart - 1])) {
    tokenStart -= 1;
  }
  let tokenEnd = cursorInRawValue;
  while (tokenEnd < rawValue.length && tokenChars.test(rawValue[tokenEnd])) {
    tokenEnd += 1;
  }
  const tokenFromCursor = rawValue.slice(tokenStart, tokenEnd).trim();
  const valueToken = tokenFromCursor.length > 0 ? tokenFromCursor : undefined;

  const linePrefix = text.slice(0, lineStart);
  const priorLines = linePrefix.split('\n');
  const scopeStack: Array<{ indent: number; path: string }> = [];

  for (const priorLine of priorLines) {
    const priorMatch = priorLine.match(/^(\s*)(["']?)([A-Za-z_$][\w$-]*)(["']?\s*:\s*)(.*)$/);
    if (!priorMatch) {
      continue;
    }

    const [, priorIndentText, , priorKey, , priorRawValue] = priorMatch;
    const priorIndent = priorIndentText.length;

    while (scopeStack.length > 0 && scopeStack[scopeStack.length - 1].indent >= priorIndent) {
      scopeStack.pop();
    }

    const parentPath = scopeStack.length > 0 ? scopeStack[scopeStack.length - 1].path : undefined;
    const priorPath = parentPath ? `${parentPath}.${priorKey}` : priorKey;
    const trimmedPriorRawValue = priorRawValue.trim();
    const opensScope =
      trimmedPriorRawValue.length === 0 &&
      !trimmedPriorRawValue.startsWith('|') &&
      !trimmedPriorRawValue.endsWith('|') &&
      !trimmedPriorRawValue.startsWith('>') &&
      !trimmedPriorRawValue.endsWith('>') &&
      !trimmedPriorRawValue.startsWith('[') &&
      !trimmedPriorRawValue.startsWith('{') &&
      !trimmedPriorRawValue.startsWith('&') &&
      !trimmedPriorRawValue.startsWith('*');

    if (opensScope) {
      scopeStack.push({ indent: priorIndent, path: priorPath });
    }
  }

  while (scopeStack.length > 0 && scopeStack[scopeStack.length - 1].indent >= indent.length) {
    scopeStack.pop();
  }

  const parentPath = scopeStack.length > 0 ? scopeStack[scopeStack.length - 1].path : undefined;
  const path = parentPath ? `${parentPath}.${key}` : key;

  return {
    key,
    path,
    parentPath,
    keyPrefix,
    inKey: keyCursor,
    inValue: valueCursor,
    valuePrefix,
    valueToken,
  };
}

function getPositionForOffset(text: string, offset: number): { line: number; character: number } {
  const safeOffset = Math.max(0, Math.min(offset, text.length));
  let line = 0;
  let lineStart = 0;

  for (let index = 0; index < safeOffset; index += 1) {
    if (text[index] === '\n') {
      line += 1;
      lineStart = index + 1;
    }
  }

  return {
    line,
    character: safeOffset - lineStart,
  };
}

function getCompletionPrefix(text: string): string {
  const trimmed = text.replace(/[}\])\s]+$/g, '').trim();

  const hasDot = trimmed.indexOf('.') >= 0;
  const hasPipe = trimmed.indexOf('|') >= 0;

  if (!hasDot && !hasPipe) {
    const bracketIndex = trimmed.indexOf('[');
    if (bracketIndex > 0) {
      return trimmed.slice(0, bracketIndex);
    }
  }

  return trimmed;
}

function getExpressionCompletionsAtOffset(
  semanticReadAdapter: SemanticReadAdapter,
  semantifyServices: SemantifyServices,
  fullText: string,
  fullOffset: number,
  delimiters: IntellisenseDelimiters,
  content: string,
  offsetInContent: number,
  filters: FilterSignature[],
  semanticContext: SemanticQueryContext,
  semanticOptions: {
    schema?: object;
    contentSchema?: object;
    schemaUri?: string;
    contentSchemaUri?: string;
  },
  /** Optional resolver to translate for-loop alias paths to their schema equivalents. */
  pathResolver?: (basePath: string) => string,
  debugLog?: IntellisenseOptions['debugLog']
): CompletionItem[] {
  const prefix = getCompletionPrefix(content.slice(0, offsetInContent));

  // Filter completions: use semantify planCandidates for canonical filter candidates
  const lastPipe = prefix.lastIndexOf('|');
  if (lastPipe >= 0) {
    const filterPrefix = prefix.slice(lastPipe + 1).replace(/[^A-Za-z_\d]+$/g, '');
    const semantifyDelimiters: SemantifyDelimiterConfigInput = {
      statementStart: delimiters.statementStart,
      statementEnd: delimiters.statementEnd,
      expressionStart: delimiters.expressionStart,
      expressionEnd: delimiters.expressionEnd,
      commentStart: delimiters.commentStart,
      commentEnd: delimiters.commentEnd,
    };
    const candidates = semantifyServices.planCandidates(
      {
        type: 'filterCandidates',
      },
      {
        text: fullText,
        offset: fullOffset,
        delimiters: semantifyDelimiters,
      }
    );
    // Semantify returns built-in filters; merge with custom filters from options
    const customFilterItems: CompletionItem[] = filters
      .filter((f) => !getBuiltinFilterNames().includes(f.name))
      .map((f) => ({
        label: f.name,
        kind: 'filter' as const,
      }));
    const allFilters = applyFilterSignatureMetadata(
      mergeUniqueCompletions(coerceCandidates(candidates), customFilterItems),
      filters
    );
    return filterAndSortCompletions(allFilters, filterPrefix);
  }

  const resolveBase = (basePath: string): string =>
    pathResolver ? pathResolver(basePath) : basePath;

  const logRawDuplicateLabels = (items: CompletionItem[]): void => {
    const duplicates = summarizeDuplicateLabels(items);
    if (duplicates.length > 0) {
      debugLog?.(
        `[intellisense] completion duplicate labels: ${duplicates.slice(0, 12).join(', ')}`,
        'messages'
      );
    }
  };

  const variableRefs = extractExpressionVariableReferences(content);
  const activeRef = variableRefs.find(
    (ref) => offsetInContent >= ref.start && offsetInContent <= ref.end + 1
  );
  if (activeRef) {
    const typedPath = content.slice(activeRef.start, offsetInContent).trim();
    const lastDot = typedPath.lastIndexOf('.');
    if (lastDot >= 0) {
      // Property completions: keep using semantic read adapter (schema-driven)
      const resolvedBase = resolveBase(typedPath.slice(0, lastDot));
      const propertyPrefix = typedPath.slice(lastDot + 1);
      const graphItems = semanticReadAdapter.getChildCompletions(
        semanticContext,
        resolvedBase,
        semanticOptions
      );
      const filtered = filterAndSortCompletions(graphItems, propertyPrefix);
      return filtered.length > 0 ? filtered : graphItems;
    }

    // Symbol completions: use semantify for local bindings + schema root properties
    const semantifyDelimiters: SemantifyDelimiterConfigInput = {
      statementStart: delimiters.statementStart,
      statementEnd: delimiters.statementEnd,
      expressionStart: delimiters.expressionStart,
      expressionEnd: delimiters.expressionEnd,
      commentStart: delimiters.commentStart,
      commentEnd: delimiters.commentEnd,
    };
    const localBindings = semantifyServices.planCandidates(
      {
        type: 'symbolCandidates',
      },
      {
        text: fullText,
        offset: fullOffset,
        delimiters: semantifyDelimiters,
      }
    );
    // Also get schema root properties to provide complete symbol context
    const schemaRoots = semanticReadAdapter.getChildCompletions(
      semanticContext,
      '',
      semanticOptions
    );
    const merged = mergeUniqueCompletions(
      coerceCandidates(dedupeCandidatesByNearestLabel(localBindings)),
      schemaRoots
    );
    logRawDuplicateLabels(merged);
    return filterAndSortCompletions(merged, typedPath);
  }

  const lastDot = prefix.lastIndexOf('.');
  if (lastDot >= 0) {
    // Property completions: keep using semantic read adapter (schema-driven)
    const resolvedBase = resolveBase(prefix.slice(0, lastDot));
    const propertyPrefix = prefix.slice(lastDot + 1);
    const graphItems = semanticReadAdapter.getChildCompletions(
      semanticContext,
      resolvedBase,
      semanticOptions
    );
    const filtered = filterAndSortCompletions(graphItems, propertyPrefix);
    return filtered.length > 0 ? filtered : graphItems;
  }

  // Root symbol completions: use semantify for local bindings + schema root properties
  const semantifyDelimiters: SemantifyDelimiterConfigInput = {
    statementStart: delimiters.statementStart,
    statementEnd: delimiters.statementEnd,
    expressionStart: delimiters.expressionStart,
    expressionEnd: delimiters.expressionEnd,
    commentStart: delimiters.commentStart,
    commentEnd: delimiters.commentEnd,
  };
  const localBindings = semantifyServices.planCandidates(
    {
      type: 'symbolCandidates',
    },
    {
      text: fullText,
      offset: fullOffset,
      delimiters: semantifyDelimiters,
    }
  );
  // Also get schema root properties to provide complete symbol context
  const schemaRoots = semanticReadAdapter.getChildCompletions(semanticContext, '', semanticOptions);
  const merged = mergeUniqueCompletions(
    coerceCandidates(dedupeCandidatesByNearestLabel(localBindings)),
    schemaRoots
  );
  logRawDuplicateLabels(merged);
  return filterAndSortCompletions(merged, prefix);
}

/**
 * Deterministic, token-based parser for a complete `for ALIAS in EXPR`
 * statement content (the text between the statement delimiters, trimmed).
 *
 * Per project guidelines, multi-token regex spanning unbounded content strings
 * must not be used for statement-semantic decisions. This helper:
 *  1. Tokenises once with split(/\s+/) and validates the structural shape.
 *  2. Walks character-by-character only to locate byte offsets — never to
 *     match semantic content.
 *  3. Uses regex only for the single-token identifier character-class check.
 *
 * Returns null if the content is not a well-formed for-header.
 */
interface ForHeaderParsed {
  aliasName: string;
  aliasStart: number; // character offset (JS string index) inside statementContent
  aliasEnd: number;
  iterableExpression: string;
  iterableStart: number; // character offset (JS string index) inside statementContent
}

function parseForHeader(statementContent: string): ForHeaderParsed | null {
  return parseCoreTemplateForHeader(statementContent);
}

function getStatementExpressionFragment(
  statementPrefix: string
): { expression: string; offsetInExpression: number } | null {
  const expression = extractTemplateStatementExpression(statementPrefix);
  if (!expression) {
    return null;
  }

  return {
    expression: expression.expression,
    offsetInExpression: expression.expression.length,
  };
}

/**
 * @internal
 * Exported solely for white-box unit testing. Not part of the stable public API.
 * These helpers are subject to change or removal without notice.
 */
export const intellisenseTesting = {
  findEnclosingRange,
  findEnclosingRangeNearOffset,
  normalizeExpression,
  splitPathSegments,
  getVariablePathAtOffset,
  getVariablePathPrefixAtOffset,
  getFilterNameAtOffset,
  getCompletionPrefix,
  getStatementExpressionFragment,
  getFrontmatterContext,
  parseForHeader,
};

export class IntellisenseProvider {
  constructor(
    private readonly semanticReadAdapter: SemanticReadAdapter = createContextGraphSemanticReadAdapter(),
    private readonly semantifyServices: SemantifyServices = createSemantifyServices()
  ) {}

  getCompletions(text: string, offset: number, options?: IntellisenseOptions): CompletionItem[] {
    const delimiters = getDelimiters(options);
    const expression = findEnclosingRangeNearOffset(
      text,
      offset,
      delimiters.expressionStart,
      delimiters.expressionEnd,
      true
    );
    const statement = findEnclosingRangeNearOffset(
      text,
      offset,
      delimiters.statementStart,
      delimiters.statementEnd,
      true
    );
    const semanticZone = resolveSemanticQueryZone(text, offset, options?.documentUri);
    const contextBlock = semanticZone.legacyContextBlock;
    const completionContext = buildSemanticQueryContext(
      text,
      offset,
      'completion',
      semanticZone,
      options?.documentUri
    );
    const semanticOptions = {
      schema: options?.schema,
      contentSchema: options?.contentSchema,
      schemaUri: options?.schemaUri,
      contentSchemaUri: options?.contentSchemaUri,
    };
    const filters = [...getDefaultFilters(), ...(options?.customFilters ?? [])];
    const keywords = [...DEFAULT_KEYWORDS, ...(options?.customKeywords ?? [])];

    const scopeResolver = createScopedPathResolver(
      this.semanticReadAdapter,
      text,
      offset,
      delimiters
    );

    if (expression) {
      const expressionText = text.slice(expression.start, expression.end);
      let content = expressionText;
      if (content.startsWith(delimiters.expressionStart)) {
        content = content.slice(delimiters.expressionStart.length);
      }
      if (content.endsWith(delimiters.expressionEnd)) {
        content = content.slice(0, -delimiters.expressionEnd.length);
      }

      const contentOffset = offset - expression.start - delimiters.expressionStart.length;

      const expressionCompletions = getExpressionCompletionsAtOffset(
        this.semanticReadAdapter,
        this.semantifyServices,
        text,
        offset,
        delimiters,
        content,
        Math.max(0, contentOffset),
        filters,
        completionContext,
        semanticOptions,
        scopeResolver,
        options?.debugLog
      );

      const dedupedExpressionCompletions = dedupeCompletionItems(expressionCompletions);
      logCompletionSummary(options, 'expression', dedupedExpressionCompletions);
      return dedupedExpressionCompletions;
    }

    if (statement) {
      const startOffset = statement.start + delimiters.statementStart.length;
      const statementPrefix = text.slice(startOffset, offset);
      const normalizedStatementPrefix = statementPrefix.replace(/^\s*-\s*/, '');
      const trimmed = normalizedStatementPrefix.trim();

      const keywordMatch = trimmed.match(/^([A-Za-z_][\w]*)\b/);
      if (!keywordMatch || !trimmed.includes(' ')) {
        const statementKeywords = filterAndSortCompletions(
          getKeywordCompletions(keywords),
          trimmed
        );
        logCompletionSummary(options, 'statement-keyword', statementKeywords);
        return statementKeywords;
      }

      const expressionFragment = getStatementExpressionFragment(normalizedStatementPrefix);
      if (!expressionFragment) {
        const fallbackKeywords = filterAndSortCompletions(getKeywordCompletions(keywords), trimmed);
        logCompletionSummary(options, 'statement-keyword-fallback', fallbackKeywords);
        return fallbackKeywords;
      }

      const statementExpressionCompletions = getExpressionCompletionsAtOffset(
        this.semanticReadAdapter,
        this.semantifyServices,
        text,
        offset,
        delimiters,
        expressionFragment.expression,
        expressionFragment.offsetInExpression,
        filters,
        completionContext,
        semanticOptions,
        scopeResolver,
        options?.debugLog
      );

      const dedupedStatementExpressionCompletions = dedupeCompletionItems(
        statementExpressionCompletions
      );
      logCompletionSummary(options, 'statement-expression', dedupedStatementExpressionCompletions);
      return dedupedStatementExpressionCompletions;
    }

    if (contextBlock === 'frontmatter') {
      const context = getFrontmatterContext(text, offset);

      if (context.inValue && context.path) {
        const graphEnumValues = this.semanticReadAdapter.getEnumValueCompletions(
          completionContext,
          context.path,
          semanticOptions
        );
        if (graphEnumValues.length > 0) {
          const normalizedPrefix = context.valuePrefix.replace(/^["']/, '').toLowerCase();
          const enumItems = graphEnumValues.filter((value) =>
            value.label.toLowerCase().startsWith(normalizedPrefix)
          );
          const dedupedEnumItems = dedupeCompletionItems(enumItems);
          logCompletionSummary(options, 'frontmatter-enum-graph', dedupedEnumItems);
          return dedupedEnumItems;
        }
      }

      const graphItems = this.semanticReadAdapter.getChildCompletions(
        completionContext,
        context.parentPath ?? '',
        semanticOptions
      );
      const sortedFrontmatter = filterAndSortCompletions(graphItems, context.keyPrefix);
      const dedupedFrontmatter = dedupeCompletionItems(sortedFrontmatter);
      logCompletionSummary(options, 'frontmatter-graph-children', dedupedFrontmatter);
      return dedupedFrontmatter;
    }

    options?.debugLog?.('[intellisense] completion branch=none count=0', 'verbose');
    return [];
  }

  getHover(text: string, offset: number, options?: IntellisenseOptions): HoverInfo | null {
    const delimiters = getDelimiters(options);
    const expression = findEnclosingRangeNearOffset(
      text,
      offset,
      delimiters.expressionStart,
      delimiters.expressionEnd,
      false
    );
    const statement = expression
      ? null
      : findEnclosingRangeNearOffset(
          text,
          offset,
          delimiters.statementStart,
          delimiters.statementEnd,
          false
        );
    const semanticZone = resolveSemanticQueryZone(text, offset, options?.documentUri);
    const contextBlock = semanticZone.legacyContextBlock;
    const hoverContext = buildSemanticQueryContext(
      text,
      offset,
      'hover',
      semanticZone,
      options?.documentUri
    );
    const semanticOptions = {
      schema: options?.schema,
      contentSchema: options?.contentSchema,
      schemaUri: options?.schemaUri,
      contentSchemaUri: options?.contentSchemaUri,
    };
    const resolveHoverPath = createScopedPathResolver(
      this.semanticReadAdapter,
      text,
      offset,
      delimiters
    );
    const filters = [...getDefaultFilters(), ...(options?.customFilters ?? [])];

    const getHoverDetailsForPath = (rawPath: string): HoverInfo | null => {
      const resolvedPath = resolveHoverPath(rawPath);
      const graphDetails = this.semanticReadAdapter.getPathDetails(
        hoverContext,
        resolvedPath,
        semanticOptions
      );
      const details = graphDetails
        ? graphDetails.description
          ? `${graphDetails.path}: ${graphDetails.type ?? 'unknown'}\n\n${graphDetails.description}`
          : `${graphDetails.path}: ${graphDetails.type ?? 'unknown'}`
        : undefined;
      options?.debugLog?.(
        `[intellisense] hover variable=${rawPath} resolved=${resolvedPath} source=graph result=${details ? 'present' : 'none'}`
      );
      return details ? { contents: details } : null;
    };

    if (!expression && !statement) {
      if (contextBlock !== 'frontmatter') {
        options?.debugLog?.(
          '[intellisense] hover miss: outside expression and frontmatter',
          'messages'
        );
        return null;
      }

      const context = getFrontmatterContext(text, offset);
      if (!context.path) {
        options?.debugLog?.('[intellisense] hover miss: frontmatter path unresolved', 'messages');
        return null;
      }

      const graphDetails = this.semanticReadAdapter.getPathDetails(
        hoverContext,
        context.path,
        semanticOptions
      );
      const keyDetails = graphDetails
        ? graphDetails.description
          ? `${graphDetails.path}: ${graphDetails.type ?? 'unknown'}\n\n${graphDetails.description}`
          : `${graphDetails.path}: ${graphDetails.type ?? 'unknown'}`
        : undefined;
      options?.debugLog?.(
        `[intellisense] hover frontmatter path=${context.path} source=graph result=${keyDetails ? 'present' : 'none'}`
      );
      return keyDetails ? { contents: keyDetails } : null;
    }

    if (!expression && statement) {
      const rawInner = text
        .slice(statement.start, statement.end)
        .slice(delimiters.statementStart.length, -delimiters.statementEnd.length);
      const statementContent = rawInner.trim();
      if (!statementContent) {
        return null;
      }

      const statementOffset =
        statement.start +
        delimiters.statementStart.length +
        (rawInner.indexOf(statementContent) >= 0 ? rawInner.indexOf(statementContent) : 0);
      const cursorInStatement = offset - statementOffset;

      const forHeaderMatch = parseForHeader(statementContent);
      if (forHeaderMatch) {
        const { aliasName, aliasStart, aliasEnd, iterableExpression, iterableStart } =
          forHeaderMatch;

        if (cursorInStatement >= aliasStart && cursorInStatement <= aliasEnd) {
          options?.debugLog?.(
            `[intellisense] hover alias=${aliasName} source=statement-local result=present`
          );
          return { contents: `${aliasName}: local loop alias` };
        }

        const cursorInIterable = cursorInStatement - iterableStart;
        if (cursorInIterable >= 0) {
          const iterablePath = getVariablePathPrefixAtOffset(
            iterableExpression,
            Math.max(0, cursorInIterable)
          );
          if (iterablePath) {
            const localAlias = resolveLocalAliasReference(
              this.semanticReadAdapter,
              text,
              iterablePath,
              offset
            );
            if (localAlias?.isAliasTokenOnly) {
              options?.debugLog?.(
                `[intellisense] hover alias=${localAlias.alias} source=statement-iterable-local result=present`
              );
              return { contents: `${localAlias.alias}: local template variable` };
            }

            return getHoverDetailsForPath(iterablePath);
          }
        }
      }

      const statementExpression = extractTemplateStatementExpression(statementContent);
      if (!statementExpression) {
        return null;
      }

      const expressionPart = statementExpression.expression;
      const expressionPartStart = statementExpression.startOffset;
      const relativeOffset = offset - statementOffset - expressionPartStart;

      const filterName = getFilterNameAtOffset(expressionPart, Math.max(0, relativeOffset));
      if (filterName) {
        const signature = resolveFilterSignature(filters, filterName);
        options?.debugLog?.(
          `[intellisense] hover filter=${filterName} result=${signature ? 'present' : 'none'}`
        );
        return signature ? { contents: `${signature.name}: ${signature.description}` } : null;
      }

      const variablePath = getVariablePathAtOffset(expressionPart, Math.max(0, relativeOffset));
      if (variablePath) {
        const localAlias = resolveLocalAliasReference(
          this.semanticReadAdapter,
          text,
          variablePath,
          offset
        );
        if (localAlias?.isAliasTokenOnly) {
          options?.debugLog?.(
            `[intellisense] hover alias=${localAlias.alias} source=statement-expression-local result=present`
          );
          return { contents: `${localAlias.alias}: local loop alias` };
        }

        return getHoverDetailsForPath(variablePath);
      }

      options?.debugLog?.('[intellisense] hover miss: no statement variable/filter metadata');
      return null;
    }

    if (!expression) {
      return null;
    }

    const expressionText = text.slice(expression.start, expression.end);
    const content = normalizeExpression(expressionText, delimiters);
    const contentStart = expressionText.indexOf(content);
    const relativeOffset = offset - expression.start - contentStart;

    const filterName = getFilterNameAtOffset(content, Math.max(0, relativeOffset));
    if (filterName) {
      const signature = resolveFilterSignature(filters, filterName);
      options?.debugLog?.(
        `[intellisense] hover filter=${filterName} result=${signature ? 'present' : 'none'}`
      );
      return signature ? { contents: `${signature.name}: ${signature.description}` } : null;
    }

    const variablePath = getVariablePathAtOffset(content, Math.max(0, relativeOffset));
    if (variablePath) {
      const localAlias = resolveLocalAliasReference(
        this.semanticReadAdapter,
        text,
        variablePath,
        offset
      );
      if (localAlias?.isAliasTokenOnly) {
        return { contents: `${localAlias.alias}: local loop alias` };
      }

      return getHoverDetailsForPath(variablePath);
    }

    options?.debugLog?.(
      '[intellisense] hover miss: no active filter or variable metadata',
      'messages'
    );
    return null;
  }

  getDefinition(
    text: string,
    offset: number,
    options?: IntellisenseOptions
  ): DefinitionLocation | null {
    const delimiters = getDelimiters(options);
    const expression = findEnclosingRangeNearOffset(
      text,
      offset,
      delimiters.expressionStart,
      delimiters.expressionEnd,
      false
    );
    const statement = expression
      ? null
      : findEnclosingRangeNearOffset(
          text,
          offset,
          delimiters.statementStart,
          delimiters.statementEnd,
          false
        );

    const semanticZone = resolveSemanticQueryZone(text, offset, options?.documentUri);
    const contextBlock = semanticZone.legacyContextBlock;

    const definitionContext = buildSemanticQueryContext(
      text,
      offset,
      'definition',
      semanticZone,
      options?.documentUri
    );

    const resolveDefinitionPath = createScopedPathResolver(
      this.semanticReadAdapter,
      text,
      offset,
      delimiters
    );

    const resolveSchemaDefinition = (
      path: string,
      pathKind: 'property' | 'value' = 'property',
      valueToken?: string
    ): DefinitionLocation | null => {
      const resolved = this.semanticReadAdapter.resolvePathDefinition(
        definitionContext,
        path,
        {
          schemaUri: options?.schemaUri,
          contentSchemaUri: options?.contentSchemaUri,
        },
        pathKind,
        valueToken
      );
      if (!resolved) {
        return null;
      }

      return {
        uri: resolved.uri,
        path,
        pathKind,
        valueToken,
        range: resolved.range,
      };
    };

    if (!expression && !statement) {
      const documentDefinition = this.semanticReadAdapter.resolveDocumentDefinition(
        definitionContext,
        text,
        offset,
        {
          schema: options?.schema,
          contentSchema: options?.contentSchema,
          documentUri: options?.documentUri,
          workspaceRoot: options?.workspaceRoot,
        }
      );
      if (documentDefinition) {
        options?.debugLog?.(
          `[intellisense] definition source=document-reference uri=${documentDefinition.uri}`
        );
        return documentDefinition;
      }

      if (contextBlock !== 'frontmatter') {
        options?.debugLog?.(
          '[intellisense] definition miss: outside expression/statement/frontmatter',
          'messages'
        );
        return null;
      }

      const context = getFrontmatterContext(text, offset);
      if (!context.path) {
        options?.debugLog?.(
          '[intellisense] definition miss: frontmatter path unresolved',
          'messages'
        );
        return null;
      }

      options?.debugLog?.(
        `[intellisense] definition source=frontmatter path=${context.path} kind=${context.inValue ? 'value' : 'property'}`
      );

      return resolveSchemaDefinition(
        context.path,
        context.inValue ? 'value' : 'property',
        context.inValue ? context.valueToken : undefined
      );
    }

    if (expression) {
      const content = normalizeExpression(text.slice(expression.start, expression.end), delimiters);
      const contentStart = text.slice(expression.start, expression.end).indexOf(content);
      const relativeOffset = offset - expression.start - contentStart;
      const [variableSegment] = content.split('|');
      if (content.indexOf('|') >= 0 && relativeOffset >= content.indexOf('|')) {
        const sourcePath = getVariablePathAtOffset(
          variableSegment,
          Math.max(0, Math.min(relativeOffset, Math.max(0, variableSegment.length - 1)))
        );
        if (!sourcePath) {
          options?.debugLog?.(
            '[intellisense] definition miss: filter-source variable path unresolved',
            'messages'
          );
          return null;
        }

        options?.debugLog?.(
          `[intellisense] definition source=expression-filter path=${sourcePath}`,
          'verbose'
        );

        return resolveSchemaDefinition(sourcePath);
      }
      const variablePath = getVariablePathAtOffset(variableSegment, Math.max(0, relativeOffset));
      if (!variablePath) return null;
      const cursorPrefix = variableSegment.slice(0, Math.max(0, relativeOffset + 1));
      const cursorIsAliasToken = !/[.[]/.test(cursorPrefix);

      const localAlias = resolveLocalAliasReference(
        this.semanticReadAdapter,
        text,
        variablePath,
        offset
      );
      if (localAlias && cursorIsAliasToken && options?.documentUri) {
        options?.debugLog?.(
          `[intellisense] definition source=local-alias variable=${variablePath} uri=${options.documentUri}`
        );
        return {
          uri: options.documentUri,
          range: {
            start: getPositionForOffset(text, localAlias.declaration.start),
            end: getPositionForOffset(text, localAlias.declaration.end),
          },
        };
      }

      const canonicalPath = resolveDefinitionPath(variablePath);
      options?.debugLog?.(
        `[intellisense] definition source=expression-schema variable=${variablePath} canonical=${canonicalPath}`
      );
      return resolveSchemaDefinition(canonicalPath, 'property');
    }

    // expression is falsy in this branch, and earlier control flow already returned
    // when both expression and statement were falsy, so statement! is guaranteed
    // here before computing statementRange/rawInner with delimiters and statementContent.
    const statementRange = statement!;
    const rawInner = text
      .slice(statementRange.start, statementRange.end)
      .slice(delimiters.statementStart.length, -delimiters.statementEnd.length);
    const statementContent = rawInner.trim();
    if (!statementContent) return null;

    const statementOffset =
      statementRange.start +
      delimiters.statementStart.length +
      (rawInner.indexOf(statementContent) >= 0 ? rawInner.indexOf(statementContent) : 0);
    const cursorInStatement = offset - statementOffset;

    const forHeaderMatch = parseForHeader(statementContent);
    if (forHeaderMatch) {
      const { aliasName, aliasStart, aliasEnd, iterableExpression, iterableStart } = forHeaderMatch;
      const cursorInIterable = cursorInStatement - iterableStart;

      if (cursorInStatement >= aliasStart && cursorInStatement <= aliasEnd) {
        if (options?.documentUri) {
          const declarationStart = statementOffset + aliasStart;
          const declarationEnd = declarationStart + aliasName.length;
          options?.debugLog?.(
            `[intellisense] definition source=statement-local-alias variable=${aliasName} uri=${options.documentUri}`
          );
          return {
            uri: options.documentUri,
            range: {
              start: getPositionForOffset(text, declarationStart),
              end: getPositionForOffset(text, declarationEnd),
            },
          };
        }

        return null;
      }

      if (cursorInIterable >= 0) {
        if (
          iterableExpression.indexOf('|') >= 0 &&
          cursorInIterable >= iterableExpression.indexOf('|')
        ) {
          return null;
        }

        const iterablePath = getVariablePathPrefixAtOffset(
          iterableExpression,
          Math.max(0, cursorInIterable)
        );
        if (iterablePath) {
          const cursorPrefix = iterableExpression.slice(0, Math.max(0, cursorInIterable + 1));
          const cursorIsAliasToken = !/[.[]/.test(cursorPrefix);
          const localAlias = resolveLocalAliasReference(
            this.semanticReadAdapter,
            text,
            iterablePath,
            offset
          );
          if (localAlias && cursorIsAliasToken && options?.documentUri) {
            options?.debugLog?.(
              `[intellisense] definition source=statement-local-alias variable=${iterablePath} uri=${options.documentUri}`
            );
            return {
              uri: options.documentUri,
              range: {
                start: getPositionForOffset(text, localAlias.declaration.start),
                end: getPositionForOffset(text, localAlias.declaration.end),
              },
            };
          }

          const canonicalPath = resolveDefinitionPath(iterablePath);
          options?.debugLog?.(
            `[intellisense] definition source=statement-for-iterable variable=${iterablePath} canonical=${canonicalPath}`
          );
          return resolveSchemaDefinition(canonicalPath, 'property');
        }
      }
    }

    const statementExpression = extractTemplateStatementExpression(statementContent);
    if (!statementExpression) return null;

    const expressionPart = statementExpression.expression;
    const expressionPartStart = statementExpression.startOffset;
    const relativeOffset = offset - statementOffset - expressionPartStart;
    const [variableSegment] = expressionPart.split('|');
    if (expressionPart.indexOf('|') >= 0 && relativeOffset >= expressionPart.indexOf('|')) {
      return null;
    }
    const variablePath = getVariablePathAtOffset(variableSegment, Math.max(0, relativeOffset));
    if (!variablePath) return null;
    const cursorPrefix = variableSegment.slice(0, Math.max(0, relativeOffset + 1));
    const cursorIsAliasToken = !/[.[]/.test(cursorPrefix);

    const localAlias = resolveLocalAliasReference(
      this.semanticReadAdapter,
      text,
      variablePath,
      offset
    );
    if (localAlias && cursorIsAliasToken && options?.documentUri) {
      options?.debugLog?.(
        `[intellisense] definition source=statement-local-alias variable=${variablePath} uri=${options.documentUri}`
      );
      return {
        uri: options.documentUri,
        range: {
          start: getPositionForOffset(text, localAlias.declaration.start),
          end: getPositionForOffset(text, localAlias.declaration.end),
        },
      };
    }

    const canonicalPath = resolveDefinitionPath(variablePath);
    options?.debugLog?.(
      `[intellisense] definition source=statement-schema variable=${variablePath} canonical=${canonicalPath}`
    );
    return resolveSchemaDefinition(canonicalPath, 'property');
  }

  getSignatureHelp(
    text: string,
    offset: number,
    options?: IntellisenseOptions
  ): SignatureHelp | null {
    const delimiters = getDelimiters(options);
    const expression = findEnclosingRange(
      text,
      offset,
      delimiters.expressionStart,
      delimiters.expressionEnd,
      false
    );
    if (!expression) return null;

    const content = normalizeExpression(text.slice(expression.start, expression.end), delimiters);
    const match = content.match(/\|\s*([A-Za-z_][\w]*)\s*\(/);
    if (!match) return null;

    const filters = [...getDefaultFilters(), ...(options?.customFilters ?? [])];
    const signature = resolveFilterSignature(filters, match[1]);
    if (!signature) return null;

    return {
      name: signature.name,
      documentation: signature.description,
      parameters: signature.parameters.map((param) => ({
        name: param.name,
        type: param.type,
        documentation: param.description,
      })),
    };
  }
}

export function createIntellisenseProvider(
  semanticReadAdapter?: SemanticReadAdapter
): IntellisenseProvider {
  return new IntellisenseProvider(semanticReadAdapter);
}
