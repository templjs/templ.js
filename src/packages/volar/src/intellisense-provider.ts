import { SchemaValidator, type SchemaMetadata } from '@templjs/core';
import {
  resolveDelimiters,
  type DelimiterConfig as IntellisenseDelimiters,
} from './template-delimiters.js';
import { isOffsetInFrontmatter, type FrontmatterRange } from './frontmatter-zone.js';

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
  path: string;
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

const DEFAULT_FILTERS: FilterSignature[] = [
  {
    name: 'upper',
    description: 'Uppercase a string.',
    returnType: 'string',
    parameters: [],
  },
  {
    name: 'lower',
    description: 'Lowercase a string.',
    returnType: 'string',
    parameters: [],
  },
  {
    name: 'default',
    description: 'Provide a default value if undefined.',
    returnType: 'any',
    parameters: [{ name: 'value', type: 'any' }],
  },
  {
    name: 'replace',
    description: 'Replace a substring.',
    returnType: 'string',
    parameters: [
      { name: 'search', type: 'string' },
      { name: 'replacement', type: 'string' },
    ],
  },
];

// Matches variable paths including chained bracket access (e.g., matrix[0][0], obj["a"]["b"])
const VARIABLE_PATH_REGEX = /^[A-Za-z_][\w]*(?:\[[^\]]+\])*(?:\.[A-Za-z_][\w]*(?:\[[^\]]+\])*)*/;

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
  if (endIndex === -1 || endIndex < offset) {
    return allowOpen ? { start: startIndex, end: text.length } : null;
  }
  return { start: startIndex, end: endIndex + end.length };
}
function getMetadata(schema?: object): SchemaMetadata {
  if (!schema) return {};
  const validator = new SchemaValidator(schema);
  return validator.getMetadata();
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
  return `${path}: ${entry.type}`;
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
  const regex = /[A-Za-z_][\w]*(?:\[[^\]]+\])*(?:\.[A-Za-z_][\w]*(?:\[[^\]]+\])*)*/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (offsetInContent >= start && offsetInContent <= end) {
      return match[0];
    }
  }

  const fallback = content.match(VARIABLE_PATH_REGEX);
  return fallback ? fallback[0] : null;
}

function getCompletionPrefix(text: string): string {
  const trimmed = text.replace(/[}\])\s]+$/g, '').trim();

  // Normalize array index notation for top-level prefixes so that
  // `users[` / `users[0` still match a completion label `users`.
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

export class IntellisenseProvider {
  getCompletions(text: string, offset: number, options?: IntellisenseOptions): CompletionItem[] {
    const delimiters = getDelimiters(options);
    const expression = findEnclosingRange(
      text,
      offset,
      delimiters.expressionStart,
      delimiters.expressionEnd,
      true
    );
    const statement = findEnclosingRange(
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
    const metadata = getMetadata(activeSchema);
    const filters = [...DEFAULT_FILTERS, ...(options?.customFilters ?? [])];
    const keywords = [...DEFAULT_KEYWORDS, ...(options?.customKeywords ?? [])];

    if (expression) {
      const startOffset = expression.start + delimiters.expressionStart.length;
      const prefix = getCompletionPrefix(text.slice(startOffset, offset));
      const lastPipe = prefix.lastIndexOf('|');

      if (lastPipe >= 0) {
        const filterPrefix = prefix.slice(lastPipe + 1).replace(/[^A-Za-z_\d]+$/g, '');
        return filterAndSortCompletions(getFilterCompletions(filters), filterPrefix);
      }

      const lastDot = prefix.lastIndexOf('.');
      if (lastDot >= 0) {
        const pathPrefix = prefix.slice(0, lastDot + 1);
        const propertyPrefix = prefix.slice(lastDot + 1);
        return filterAndSortCompletions(getPathCompletions(metadata, pathPrefix), propertyPrefix);
      }

      return filterAndSortCompletions(getTopLevelCompletions(metadata), prefix);
    }

    if (statement) {
      const startOffset = statement.start + delimiters.statementStart.length;
      const statementPrefix = text.slice(startOffset, offset).trim();
      return filterAndSortCompletions(getKeywordCompletions(keywords), statementPrefix);
    }

    return [];
  }

  getHover(text: string, offset: number, options?: IntellisenseOptions): HoverInfo | null {
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
    const useFrontmatterSchema = isOffsetInFrontmatter(text, offset, options?.frontmatterRange);
    const activeSchema = useFrontmatterSchema
      ? options?.schema
      : (options?.contentSchema ?? options?.schema);
    const metadata = getMetadata(activeSchema);
    const filters = [...DEFAULT_FILTERS, ...(options?.customFilters ?? [])];

    const filterMatch = content.match(/\|\s*([A-Za-z_][\w]*)/);
    if (filterMatch) {
      const signature = resolveFilterSignature(filters, filterMatch[1]);
      if (!signature) return null;
      return { contents: `${signature.name}: ${signature.description}` };
    }

    const variableMatch = content.match(VARIABLE_PATH_REGEX);
    if (variableMatch) {
      const details = resolveVariableMetadata(metadata, variableMatch[0]);
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
    const expression = findEnclosingRange(
      text,
      offset,
      delimiters.expressionStart,
      delimiters.expressionEnd,
      false
    );
    const statement = expression
      ? null
      : findEnclosingRange(text, offset, delimiters.statementStart, delimiters.statementEnd, false);
    if (!expression && !statement) return null;

    const useFrontmatterSchema = isOffsetInFrontmatter(text, offset, options?.frontmatterRange);
    const schemaUri = useFrontmatterSchema
      ? options?.schemaUri
      : (options?.contentSchemaUri ?? options?.schemaUri);
    if (!schemaUri) return null;

    if (expression) {
      const content = normalizeExpression(text.slice(expression.start, expression.end), delimiters);
      const contentStart = text.slice(expression.start, expression.end).indexOf(content);
      const relativeOffset =
        offset -
        expression.start -
        (contentStart >= 0 ? contentStart : delimiters.expressionStart.length);
      const variableSegment = content.split('|')[0] ?? content;
      if (content.indexOf('|') >= 0 && relativeOffset >= content.indexOf('|')) {
        return null;
      }
      const variablePath = getVariablePathAtOffset(variableSegment, Math.max(0, relativeOffset));
      if (!variablePath) return null;

      return {
        uri: schemaUri,
        path: variablePath,
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

    return {
      uri: schemaUri,
      path: variablePath,
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

    const filters = [...DEFAULT_FILTERS, ...(options?.customFilters ?? [])];
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
