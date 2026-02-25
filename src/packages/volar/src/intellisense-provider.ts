import { SchemaValidator, type SchemaMetadata } from '@templjs/core';

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
  customFilters?: FilterSignature[];
  customKeywords?: string[];
  delimiters?: Partial<TemplateDelimiters>;
}

export interface TemplateDelimiters {
  statementStart: string;
  statementEnd: string;
  expressionStart: string;
  expressionEnd: string;
  commentStart: string;
  commentEnd: string;
}

export interface FilterSignature {
  name: string;
  description: string;
  returnType: string;
  parameters: Array<{ name: string; type: string; description?: string }>;
}

const DEFAULT_DELIMITERS: TemplateDelimiters = {
  statementStart: '{%',
  statementEnd: '%}',
  expressionStart: '{{',
  expressionEnd: '}}',
  commentStart: '{#',
  commentEnd: '#}',
};

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

function getDelimiters(options?: IntellisenseOptions): TemplateDelimiters {
  return { ...DEFAULT_DELIMITERS, ...(options?.delimiters ?? {}) };
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

  return properties.map((prop) => ({
    label: prop,
    kind: 'property',
    detail: entry?.itemType ? `type: ${entry.itemType}` : entry?.type,
  }));
}

function getTopLevelCompletions(metadata: SchemaMetadata): CompletionItem[] {
  return Object.keys(metadata)
    .filter((key) => !key.includes('.'))
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

function resolveFilterSignature(filters: FilterSignature[], name: string): FilterSignature | null {
  return filters.find((filter) => filter.name === name) ?? null;
}

function resolveVariableMetadata(metadata: SchemaMetadata, path: string): string | undefined {
  const entry = metadata[path];
  if (!entry) return undefined;
  return `${path}: ${entry.type}`;
}

function normalizeExpression(text: string, delimiters: TemplateDelimiters): string {
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
    const metadata = getMetadata(options?.schema);
    const filters = [...DEFAULT_FILTERS, ...(options?.customFilters ?? [])];
    const keywords = [...DEFAULT_KEYWORDS, ...(options?.customKeywords ?? [])];

    if (expression) {
      const startOffset = expression.start + delimiters.expressionStart.length;
      const prefix = text.slice(startOffset, offset).trim();
      const lastPipe = prefix.lastIndexOf('|');

      if (lastPipe >= 0) {
        return getFilterCompletions(filters);
      }

      const lastDot = prefix.lastIndexOf('.');
      if (lastDot >= 0) {
        const pathPrefix = prefix.slice(0, lastDot + 1);
        return getPathCompletions(metadata, pathPrefix);
      }

      return getTopLevelCompletions(metadata);
    }

    if (statement) {
      return getKeywordCompletions(keywords);
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
    const metadata = getMetadata(options?.schema);
    const filters = [...DEFAULT_FILTERS, ...(options?.customFilters ?? [])];

    const filterMatch = content.match(/\|\s*([A-Za-z_][\w]*)/);
    if (filterMatch) {
      const signature = resolveFilterSignature(filters, filterMatch[1]);
      if (!signature) return null;
      return { contents: `${signature.name}: ${signature.description}` };
    }

    const variableMatch = content.match(/^[\w.]+/);
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
    if (!expression || !options?.schemaUri) return null;

    const content = normalizeExpression(text.slice(expression.start, expression.end), delimiters);
    const variableMatch = content.match(/^[\w.]+/);
    if (!variableMatch) return null;

    return {
      uri: options.schemaUri,
      path: variableMatch[0],
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
