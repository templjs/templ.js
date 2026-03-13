import {
  getBuiltinFilterNames,
  getBuiltinFilterSignatures,
  SchemaValidator,
  extractTemplateScopeBindings,
  type FunctionSignature,
  type SchemaMetadata,
} from '@templjs/core';
import {
  resolveDelimiters,
  type DelimiterConfig as IntellisenseDelimiters,
} from './template-delimiters.js';
import { isOffsetInFrontmatter, type FrontmatterRange } from './frontmatter-zone.js';
import {
  extractExpressionFilterReferences,
  extractExpressionVariableReferences,
} from './expression-analysis.js';
import {
  buildForScopesInText,
  findLocalAliasDefinitionInText,
  resolveScopedPath,
} from './scope-resolution.js';
import {
  createContextGraphSemanticReadAdapter,
  type SemanticQueryContext,
} from './context-graph-adapter.js';

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
  frontmatterRange?: FrontmatterRange;
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

const FILTER_SIGNATURE_OVERRIDES: Readonly<
  Record<
    string,
    {
      description: string;
      returnType: string;
      parameters: Array<{ name: string; type: string; description?: string }>;
    }
  >
> = {
  abs: {
    description: 'Return the absolute value of a number.',
    returnType: 'number',
    parameters: [],
  },
  capitalize: {
    description: 'Capitalize the first character of a string.',
    returnType: 'string',
    parameters: [],
  },
  default: {
    description: 'Provide a default value if undefined or falsy.',
    returnType: 'any',
    parameters: [{ name: 'value', type: 'any' }],
  },
  first: {
    description: 'Return the first item from a collection.',
    returnType: 'any',
    parameters: [],
  },
  join: {
    description: 'Join a list into a string.',
    returnType: 'string',
    parameters: [{ name: 'separator', type: 'string' }],
  },
  json: { description: 'Serialize a value as JSON.', returnType: 'string', parameters: [] },
  last: {
    description: 'Return the last item from a collection.',
    returnType: 'any',
    parameters: [],
  },
  length: { description: 'Return the length of a value.', returnType: 'number', parameters: [] },
  lower: { description: 'Lowercase a string.', returnType: 'string', parameters: [] },
  number: {
    description: 'Convert value to number when possible.',
    returnType: 'number',
    parameters: [],
  },
  replace: {
    description: 'Replace a substring.',
    returnType: 'string',
    parameters: [
      { name: 'search', type: 'string' },
      { name: 'replacement', type: 'string' },
    ],
  },
  reverse: { description: 'Reverse a string or collection.', returnType: 'any', parameters: [] },
  round: {
    description: 'Round a numeric value.',
    returnType: 'number',
    parameters: [{ name: 'precision', type: 'number', description: 'Optional decimal places.' }],
  },
  split: {
    description: 'Split a string into a list.',
    returnType: 'array',
    parameters: [{ name: 'separator', type: 'string' }],
  },
  string: { description: 'Convert value to string.', returnType: 'string', parameters: [] },
  trim: {
    description: 'Trim whitespace from both ends of a string.',
    returnType: 'string',
    parameters: [],
  },
  truncate: {
    description: 'Truncate a string to a maximum length.',
    returnType: 'string',
    parameters: [
      { name: 'length', type: 'number' },
      { name: 'suffix', type: 'string', description: 'Optional suffix.' },
    ],
  },
  upper: { description: 'Uppercase a string.', returnType: 'string', parameters: [] },
  where: {
    description: 'Filter array items by truthy key.',
    returnType: 'array',
    parameters: [{ name: 'key', type: 'string' }],
  },
};

const BUILTIN_FILTER_SIGNATURES = getBuiltinFilterSignatures();

function getDefaultFilters(): FilterSignature[] {
  return getBuiltinFilterNames().map((name) => {
    const signature = BUILTIN_FILTER_SIGNATURES[name] as FunctionSignature | undefined;
    const metadata = FILTER_SIGNATURE_OVERRIDES[name];

    if (signature) {
      return {
        name: signature.name,
        description: signature.description,
        returnType: signature.returnType,
        parameters: signature.parameters.map((param) => ({
          name: param.name,
          type: param.type,
          description: param.description,
        })),
      };
    }

    return {
      name,
      description: metadata?.description ?? `Apply ${name} filter.`,
      returnType: metadata?.returnType ?? 'any',
      parameters: metadata?.parameters ?? [],
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
function getMetadata(schema?: object): SchemaMetadata {
  if (!schema) return {};
  const validator = new SchemaValidator(schema);
  return validator.getMetadata();
}

const semanticReadAdapter = createContextGraphSemanticReadAdapter();

function buildSemanticQueryContext(
  text: string,
  offset: number,
  operation: SemanticQueryContext['operation'],
  usePrimarySchema: boolean,
  documentUri?: string
): SemanticQueryContext {
  const position = getPositionForOffset(text, offset);
  return {
    operation,
    schemaSource: usePrimarySchema ? 'primary' : 'secondary',
    documentUri,
    offset,
    line: position.line,
    character: position.character,
  };
}

function getPathCompletions(metadata: SchemaMetadata, pathPrefix: string): CompletionItem[] {
  const path = pathPrefix.replace(/\.$/, '');
  const entry = metadata[path];
  const properties = entry?.properties ?? [];

  return properties.map((prop: string) => ({
    label: prop,
    kind: 'property',
    detail: entry?.itemType ? `type: ${entry.itemType}` : entry?.type,
  }));
}

function getTopLevelCompletions(metadata: SchemaMetadata): CompletionItem[] {
  return Object.keys(metadata)
    .filter((key) => !key.includes('.') && !key.includes('['))
    .map((key) => ({
      label: key,
      kind: 'variable',
      detail: metadata[key]?.type,
    }));
}

function getFilterCompletions(filters: FilterSignature[]): CompletionItem[] {
  return filters.map((filter) => ({
    label: filter.name,
    kind: 'filter',
    detail: filter.returnType,
    documentation: filter.description,
  }));
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

function resolveFilterSignature(filters: FilterSignature[], name: string): FilterSignature | null {
  return filters.find((filter) => filter.name === name) ?? null;
}

function resolveVariableMetadata(metadata: SchemaMetadata, path: string): string | undefined {
  const entry = metadata[path];
  if (!entry) return undefined;
  const description = typeof entry.description === 'string' ? entry.description.trim() : '';
  return description ? `${path}: ${entry.type}\n\n${description}` : `${path}: ${entry.type}`;
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

function getSchemaNodeForPath(schema: unknown, path: string): Record<string, unknown> | null {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return null;
  }

  const segments = path
    .split('.')
    .map((segment) => segment.replace(/\[[^\]]+\]/g, ''))
    .filter((segment) => segment.length > 0);

  if (segments.length === 0) {
    return null;
  }

  let current = schema as Record<string, unknown>;

  for (const segment of segments) {
    const properties = current.properties;
    if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
      return null;
    }

    const node = (properties as Record<string, unknown>)[segment];
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      return null;
    }

    current = node as Record<string, unknown>;
  }

  return current;
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
    const opensScope = priorRawValue.trim().length === 0;

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
  content: string,
  offsetInContent: number,
  metadata: SchemaMetadata,
  filters: FilterSignature[],
  semanticContext: SemanticQueryContext,
  semanticOptions: { schema?: object; contentSchema?: object },
  /** Optional resolver to translate for-loop alias paths to their schema equivalents. */
  pathResolver?: (basePath: string) => string
): CompletionItem[] {
  const prefix = getCompletionPrefix(content.slice(0, offsetInContent));

  const lastPipe = prefix.lastIndexOf('|');
  if (lastPipe >= 0) {
    const filterPrefix = prefix.slice(lastPipe + 1).replace(/[^A-Za-z_\d]+$/g, '');
    return filterAndSortCompletions(getFilterCompletions(filters), filterPrefix);
  }

  const resolveBase = (basePath: string): string =>
    pathResolver ? pathResolver(basePath) : basePath;

  const variableRefs = extractExpressionVariableReferences(content);
  const activeRef = variableRefs.find(
    (ref) => offsetInContent >= ref.start && offsetInContent <= ref.end + 1
  );
  if (activeRef) {
    const typedPath = content.slice(activeRef.start, offsetInContent).trim();
    const lastDot = typedPath.lastIndexOf('.');
    if (lastDot >= 0) {
      const resolvedBase = resolveBase(typedPath.slice(0, lastDot));
      const propertyPrefix = typedPath.slice(lastDot + 1);
      const graphItems = semanticReadAdapter.getChildCompletions(
        semanticContext,
        resolvedBase,
        semanticOptions
      );
      const items =
        graphItems.length > 0 ? graphItems : getPathCompletions(metadata, resolvedBase + '.');
      return filterAndSortCompletions(items, propertyPrefix);
    }

    const graphItems = semanticReadAdapter.getChildCompletions(
      semanticContext,
      '',
      semanticOptions
    );
    const items = graphItems.length > 0 ? graphItems : getTopLevelCompletions(metadata);
    return filterAndSortCompletions(items, typedPath);
  }

  const lastDot = prefix.lastIndexOf('.');
  if (lastDot >= 0) {
    const resolvedBase = resolveBase(prefix.slice(0, lastDot));
    const propertyPrefix = prefix.slice(lastDot + 1);
    const graphItems = semanticReadAdapter.getChildCompletions(
      semanticContext,
      resolvedBase,
      semanticOptions
    );
    const items =
      graphItems.length > 0 ? graphItems : getPathCompletions(metadata, resolvedBase + '.');
    return filterAndSortCompletions(items, propertyPrefix);
  }

  const graphItems = semanticReadAdapter.getChildCompletions(semanticContext, '', semanticOptions);
  const items = graphItems.length > 0 ? graphItems : getTopLevelCompletions(metadata);
  return filterAndSortCompletions(items, prefix);
}

function getStatementExpressionFragment(
  statementPrefix: string
): { expression: string; offsetInExpression: number } | null {
  const trimmed = statementPrefix.trim();
  if (!trimmed) {
    return null;
  }

  const keywordMatch = trimmed.match(/^([A-Za-z_][\w]*)\b/);
  if (!keywordMatch) {
    return null;
  }

  const keyword = keywordMatch[1];
  if (trimmed === keyword || !trimmed.includes(' ')) {
    return null;
  }

  // Find the expression and where it starts in the TRIMMED string
  let expression: string;

  if (keyword === 'for') {
    // Match: "for IDENT in EXPR" where EXPR can be empty at the end
    const forMatch = trimmed.match(/^for\s+([A-Za-z_][\w]*)\s+in\s*(.*)$/);
    if (!forMatch) {
      return null;
    }
    expression = forMatch[2];
  } else {
    // For if, elif, set, block, include - everything after keyword is the expression
    const match = trimmed.match(/^[A-Za-z_][\w]*\s+(.*)/);
    if (!match) {
      return null;
    }
    expression = match[1];
  }

  // Expression might be empty if cursor is right after keyword/operator
  // The cursor is at the end of statementPrefix
  // Calculate how much of the expression has been typed
  const offsetInExpression = expression.length;

  return {
    expression,
    offsetInExpression,
  };
}

export class IntellisenseProvider {
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
    const useFrontmatterSchema = isOffsetInFrontmatter(text, offset, options?.frontmatterRange);
    const activeSchema = useFrontmatterSchema
      ? options?.schema
      : (options?.contentSchema ?? options?.schema);
    const completionContext = buildSemanticQueryContext(
      text,
      offset,
      'completion',
      useFrontmatterSchema,
      options?.documentUri
    );
    const semanticOptions = {
      schema: options?.schema,
      contentSchema: options?.contentSchema,
    };
    const metadata = getMetadata(activeSchema);
    const filters = [...getDefaultFilters(), ...(options?.customFilters ?? [])];
    const keywords = [...DEFAULT_KEYWORDS, ...(options?.customKeywords ?? [])];

    // Build for-scope mappings to resolve aliases like `relationship` → `relationships[0]`.
    const forScopes = buildForScopesInText(text, delimiters);
    const scopeBindings = extractTemplateScopeBindings(text);
    const scopeResolver = (basePath: string): string => {
      const graphResolved = semanticReadAdapter.resolveScopedPath(text, basePath, offset);
      if (graphResolved !== basePath || scopeBindings.length === 0) {
        return graphResolved;
      }

      return resolveScopedPath(basePath, offset, forScopes);
    };

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

      return getExpressionCompletionsAtOffset(
        content,
        Math.max(0, contentOffset),
        metadata,
        filters,
        completionContext,
        semanticOptions,
        scopeResolver
      );
    }

    if (statement) {
      const startOffset = statement.start + delimiters.statementStart.length;
      const statementPrefix = text.slice(startOffset, offset);
      const trimmed = statementPrefix.trim();

      const keywordMatch = trimmed.match(/^([A-Za-z_][\w]*)\b/);
      if (!keywordMatch || !trimmed.includes(' ')) {
        return filterAndSortCompletions(getKeywordCompletions(keywords), trimmed);
      }

      const expressionFragment = getStatementExpressionFragment(statementPrefix);
      if (!expressionFragment) {
        return filterAndSortCompletions(getKeywordCompletions(keywords), trimmed);
      }

      return getExpressionCompletionsAtOffset(
        expressionFragment.expression,
        expressionFragment.offsetInExpression,
        metadata,
        filters,
        completionContext,
        semanticOptions,
        scopeResolver
      );
    }

    if (useFrontmatterSchema) {
      const context = getFrontmatterContext(text, offset);

      if (context.inValue && context.path) {
        const keyNode = getSchemaNodeForPath(activeSchema, context.path);
        const enumValues = Array.isArray(keyNode?.enum)
          ? keyNode.enum.filter((value): value is string => typeof value === 'string')
          : [];

        if (enumValues.length > 0) {
          const graphEnumValues = semanticReadAdapter.getEnumValueCompletions(
            completionContext,
            context.path,
            semanticOptions
          );
          const normalizedPrefix = context.valuePrefix.replace(/^['"]/, '').toLowerCase();
          const graphItems =
            graphEnumValues.length > 0
              ? graphEnumValues
              : enumValues
                  .sort((left, right) => left.localeCompare(right))
                  .map((value) => ({
                    label: value,
                    kind: 'keyword' as const,
                    detail: `${context.key} enum`,
                  }));
          return graphItems.filter((value) =>
            value.label.toLowerCase().startsWith(normalizedPrefix)
          );
        }
      }

      const graphItems = semanticReadAdapter.getChildCompletions(
        completionContext,
        context.parentPath ?? '',
        semanticOptions
      );
      const keyItems =
        graphItems.length > 0
          ? graphItems
          : context.parentPath
            ? getPathCompletions(metadata, `${context.parentPath}.`)
            : getTopLevelCompletions(metadata);

      return filterAndSortCompletions(keyItems, context.keyPrefix);
    }

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
    const useFrontmatterSchema = isOffsetInFrontmatter(text, offset, options?.frontmatterRange);
    const activeSchema = useFrontmatterSchema
      ? options?.schema
      : (options?.contentSchema ?? options?.schema);
    const hoverContext = buildSemanticQueryContext(
      text,
      offset,
      'hover',
      useFrontmatterSchema,
      options?.documentUri
    );
    const semanticOptions = {
      schema: options?.schema,
      contentSchema: options?.contentSchema,
    };
    const metadata = getMetadata(activeSchema);
    const filters = [...getDefaultFilters(), ...(options?.customFilters ?? [])];

    if (!expression) {
      if (!useFrontmatterSchema) {
        return null;
      }

      const context = getFrontmatterContext(text, offset);
      if (!context.path) {
        return null;
      }

      const graphDetails = semanticReadAdapter.getPathDetails(
        hoverContext,
        context.path,
        semanticOptions
      );
      const keyDetails = graphDetails
        ? graphDetails.description
          ? `${graphDetails.path}: ${graphDetails.type ?? 'unknown'}\n\n${graphDetails.description}`
          : `${graphDetails.path}: ${graphDetails.type ?? 'unknown'}`
        : resolveVariableMetadata(metadata, context.path);
      return keyDetails ? { contents: keyDetails } : null;
    }

    const expressionText = text.slice(expression.start, expression.end);
    const content = normalizeExpression(expressionText, delimiters);
    const contentStart = expressionText.indexOf(content);
    const relativeOffset =
      offset -
      expression.start -
      (contentStart >= 0 ? contentStart : delimiters.expressionStart.length);

    const filterName = getFilterNameAtOffset(content, Math.max(0, relativeOffset));
    if (filterName) {
      const signature = resolveFilterSignature(filters, filterName);
      return signature ? { contents: `${signature.name}: ${signature.description}` } : null;
    }

    const variablePath = getVariablePathAtOffset(content, Math.max(0, relativeOffset));
    if (variablePath) {
      const resolvedPath = semanticReadAdapter.resolveScopedPath(text, variablePath, offset);
      const graphDetails = semanticReadAdapter.getPathDetails(
        hoverContext,
        resolvedPath,
        semanticOptions
      );
      const details = graphDetails
        ? graphDetails.description
          ? `${graphDetails.path}: ${graphDetails.type ?? 'unknown'}\n\n${graphDetails.description}`
          : `${graphDetails.path}: ${graphDetails.type ?? 'unknown'}`
        : resolveVariableMetadata(metadata, variablePath);
      if (details) {
        return { contents: details };
      }
    }

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

    const useFrontmatterSchema = isOffsetInFrontmatter(text, offset, options?.frontmatterRange);
    const schemaUri = useFrontmatterSchema
      ? options?.schemaUri
      : (options?.contentSchemaUri ?? options?.schemaUri);
    if (!schemaUri) return null;

    if (!expression && !statement) {
      if (!useFrontmatterSchema) {
        return null;
      }

      const context = getFrontmatterContext(text, offset);
      if (!context.path) {
        return null;
      }

      return {
        uri: schemaUri,
        path: context.path,
        pathKind: context.inValue ? 'value' : 'property',
        valueToken: context.inValue ? context.valueToken : undefined,
      };
    }

    if (expression) {
      const content = normalizeExpression(text.slice(expression.start, expression.end), delimiters);
      const contentStart = text.slice(expression.start, expression.end).indexOf(content);
      const relativeOffset =
        offset -
        expression.start -
        (contentStart >= 0 ? contentStart : delimiters.expressionStart.length);
      const variableSegment = content.split('|')[0] ?? content;
      if (content.indexOf('|') >= 0 && relativeOffset >= content.indexOf('|')) {
        const sourcePath = getVariablePathAtOffset(
          variableSegment,
          Math.max(0, Math.min(relativeOffset, Math.max(0, variableSegment.length - 1)))
        );
        if (!sourcePath) {
          return null;
        }

        return {
          uri: schemaUri,
          path: sourcePath,
        };
      }
      const variablePath = getVariablePathAtOffset(variableSegment, Math.max(0, relativeOffset));
      if (!variablePath) return null;

      const aliasDefinition = findLocalAliasDefinitionInText(
        text,
        variablePath,
        offset,
        options?.delimiters
      );
      if (aliasDefinition && options?.documentUri) {
        return {
          uri: options.documentUri,
          range: {
            start: getPositionForOffset(text, aliasDefinition.start),
            end: getPositionForOffset(text, aliasDefinition.end),
          },
        };
      }

      const canonicalPath = semanticReadAdapter.resolveScopedPath(text, variablePath, offset);
      return {
        uri: schemaUri,
        path: canonicalPath,
        pathKind: 'property',
      };
    }

    const statementRange = statement!;
    const rawInner = text
      .slice(statementRange.start, statementRange.end)
      .slice(delimiters.statementStart.length, -delimiters.statementEnd.length);
    const statementContent = rawInner.trim();
    if (!statementContent) return null;

    const expressionPart = statementContent.replace(/^[A-Za-z_][\w]*\b\s*/, '');
    if (!expressionPart) return null;

    const expressionPartStart = statementContent.length - expressionPart.length;
    const statementOffset =
      statementRange.start +
      delimiters.statementStart.length +
      (rawInner.indexOf(statementContent) >= 0 ? rawInner.indexOf(statementContent) : 0);
    const relativeOffset = offset - statementOffset - expressionPartStart;
    const variableSegment = expressionPart.split('|')[0] ?? expressionPart;
    if (expressionPart.indexOf('|') >= 0 && relativeOffset >= expressionPart.indexOf('|')) {
      return null;
    }
    const variablePath = getVariablePathAtOffset(variableSegment, Math.max(0, relativeOffset));
    if (!variablePath) return null;

    const aliasDefinition = findLocalAliasDefinitionInText(
      text,
      variablePath,
      offset,
      options?.delimiters
    );
    if (aliasDefinition && options?.documentUri) {
      return {
        uri: options.documentUri,
        range: {
          start: getPositionForOffset(text, aliasDefinition.start),
          end: getPositionForOffset(text, aliasDefinition.end),
        },
      };
    }

    const canonicalPath = semanticReadAdapter.resolveScopedPath(text, variablePath, offset);
    return {
      uri: schemaUri,
      path: canonicalPath,
      pathKind: 'property',
    };
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

export function createIntellisenseProvider(): IntellisenseProvider {
  return new IntellisenseProvider();
}
