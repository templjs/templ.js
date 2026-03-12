import { SchemaValidator, type JSONSchema } from '@templjs/core';
import type { IntellisenseDelimiters } from './intellisense-provider.js';
import { LineColumnMapper, RangeMapper, generatePositionMappings } from './position-mapping.js';
import { buildBlockPattern, resolveDelimiters, DEFAULT_DELIMITERS } from './template-delimiters.js';
import { isOffsetInFrontmatter, type FrontmatterRange } from './frontmatter-zone.js';

export enum DiagnosticSeverity {
  Error = 1,
  Warning = 2,
  Information = 3,
}

export interface DiagnosticPosition {
  line: number;
  character: number;
}

export interface DiagnosticRange {
  start: DiagnosticPosition;
  end: DiagnosticPosition;
}

export interface DiagnosticItem {
  message: string;
  range: DiagnosticRange;
  severity: DiagnosticSeverity;
  code?: string;
  source?: string;
  suggestion?: string;
}

export type TemplateDelimiters = IntellisenseDelimiters;

export interface DiagnosticOptions {
  schema?: JSONSchema;
  contentSchema?: JSONSchema;
  frontmatterRange?: FrontmatterRange;
  customFilters?: string[];
  delimiters?: Partial<TemplateDelimiters>;
  baseDiagnostics?: DiagnosticItem[];
}

const DEFAULT_FILTERS = new Set([
  'upper',
  'lower',
  'capitalize',
  'title',
  'trim',
  'length',
  'slice',
  'first',
  'last',
  'reverse',
  'sort',
  'default',
  'escape',
  'safe',
  'json',
  'join',
  'split',
  'replace',
  'round',
  'abs',
  'int',
  'float',
]);

interface BlockMatch {
  start: number;
  end: number;
  content: string;
}

interface BlockStackEntry {
  tag: string;
  start: number;
}

interface VariableReference {
  path: string;
  start: number;
  end: number;
}

interface ForScope {
  alias: string;
  iterablePath: string;
  bodyStart: number;
  bodyEnd: number;
}

function getDelimiters(options?: DiagnosticOptions): TemplateDelimiters {
  return resolveDelimiters(options?.delimiters);
}

function extractBlocks(text: string, start: string, end: string): BlockMatch[] {
  const blocks: BlockMatch[] = [];
  const regex = buildBlockPattern(start, end);
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    blocks.push({
      start: match.index,
      end: match.index + match[0].length,
      content: match[0],
    });
  }

  return blocks;
}

function isInsideBlocks(offset: number, blocks: BlockMatch[]): boolean {
  return blocks.some((block) => offset >= block.start && offset < block.end);
}

function createRangeFromOffsets(
  mapper: LineColumnMapper,
  startOffset: number,
  endOffset: number
): DiagnosticRange {
  const start = mapper.offsetToLineCol(startOffset);
  const end = mapper.offsetToLineCol(endOffset);
  return {
    start: { line: start.line, character: start.column },
    end: { line: end.line, character: end.column },
  };
}

function parseStatementTag(content: string, delimiters: TemplateDelimiters): string {
  const inner = content
    .slice(delimiters.statementStart.length, content.length - delimiters.statementEnd.length)
    .trim();
  return inner.split(/\s+/)[0] ?? '';
}

function maskQuotedStrings(content: string): string {
  let result = '';
  let quote: '"' | "'" | null = null;
  let escaped = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];

    if (quote) {
      result += ' ';
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      result += ' ';
      continue;
    }

    result += char;
  }

  return result;
}

function extractVariableReferences(content: string): VariableReference[] {
  const refs: VariableReference[] = [];
  const maskedContent = maskQuotedStrings(content);
  const regex = /[A-Za-z_][\w]*(?:\[[^\]]+\])*(?:\.[A-Za-z_][\w]*(?:\[[^\]]+\])*)*/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(maskedContent)) !== null) {
    const path = match[0];
    if (['true', 'false', 'null', 'undefined', 'in', 'and', 'or', 'not'].includes(path)) {
      continue;
    }

    refs.push({
      path,
      start: match.index,
      end: match.index + path.length,
    });
  }

  return refs;
}

function extractFilters(content: string): string[] {
  const filters: string[] = [];
  const regex = /\|\s*([A-Za-z_][\w]*)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    filters.push(match[1]);
  }
  return filters;
}

function buildForScopes(
  statementBlocks: BlockMatch[],
  commentBlocks: BlockMatch[],
  delimiters: TemplateDelimiters
): ForScope[] {
  const scopes: ForScope[] = [];
  const activeScopes: Array<Omit<ForScope, 'bodyEnd'>> = [];

  for (const block of statementBlocks) {
    if (isInsideBlocks(block.start, commentBlocks)) {
      continue;
    }

    const rawInner = block.content.slice(
      delimiters.statementStart.length,
      block.content.length - delimiters.statementEnd.length
    );
    const trimmed = rawInner.trim();
    const tag = trimmed.split(/\s+/)[0] ?? '';

    if (tag === 'for') {
      const match = trimmed.match(/^for\s+([A-Za-z_][\w]*)\s+in\s+([^\s%}]+)/);
      if (match) {
        activeScopes.push({
          alias: match[1],
          iterablePath: match[2],
          bodyStart: block.end,
        });
      }
      continue;
    }

    if (tag === 'endfor') {
      const scope = activeScopes.pop();
      if (scope) {
        scopes.push({
          ...scope,
          bodyEnd: block.start,
        });
      }
    }
  }

  for (const scope of activeScopes) {
    scopes.push({
      ...scope,
      bodyEnd: Number.POSITIVE_INFINITY,
    });
  }

  return scopes;
}

function resolveScopedPath(path: string, offset: number, scopes: ForScope[]): string {
  const matchingScopes = scopes.filter(
    (scope) => offset >= scope.bodyStart && offset < scope.bodyEnd
  );
  if (matchingScopes.length === 0) {
    return path;
  }

  // Prefer innermost scope.
  matchingScopes.sort((left, right) => right.bodyStart - left.bodyStart);

  for (const scope of matchingScopes) {
    if (
      path === scope.alias ||
      path.startsWith(`${scope.alias}.`) ||
      path.startsWith(`${scope.alias}[`)
    ) {
      const iterableBase = scope.iterablePath.endsWith(']')
        ? scope.iterablePath
        : `${scope.iterablePath}[0]`;
      return `${iterableBase}${path.slice(scope.alias.length)}`;
    }
  }

  return path;
}

function isPathValidInContext(resolvedPath: string, validator: SchemaValidator): boolean {
  if (validator.validateQueryPath(resolvedPath).valid) {
    return true;
  }

  if (resolvedPath.endsWith('.length')) {
    const basePath = resolvedPath.slice(0, -'.length'.length);
    if (basePath && validator.validateQueryPath(basePath).valid) {
      return true;
    }
  }

  return false;
}

/**
 * Resolve a variable path through any active for-loop scopes in the given template text.
 * Useful in server-side handlers (e.g. go-to-definition) that need the canonical schema
 * path for an alias-based expression like `relationship.target`.
 */
export function resolveScopedPathInText(
  text: string,
  path: string,
  offset: number,
  options?: Pick<DiagnosticOptions, 'delimiters'>
): string {
  const delimiters = getDelimiters(options);
  const commentBlocks = extractBlocks(text, delimiters.commentStart, delimiters.commentEnd);
  const statementBlocks = extractBlocks(text, delimiters.statementStart, delimiters.statementEnd);
  const forScopes = buildForScopes(statementBlocks, commentBlocks, delimiters);
  return resolveScopedPath(path, offset, forScopes);
}

function findUnclosedDelimiters(
  text: string,
  start: string,
  end: string,
  ignoredBlocks: BlockMatch[]
): number[] {
  const unclosed: number[] = [];
  let index = 0;

  while (index < text.length) {
    const startIndex = text.indexOf(start, index);
    if (startIndex === -1) break;
    if (isInsideBlocks(startIndex, ignoredBlocks)) {
      index = startIndex + start.length;
      continue;
    }

    const endIndex = text.indexOf(end, startIndex + start.length);
    if (endIndex === -1) {
      unclosed.push(startIndex);
      index = startIndex + start.length;
      continue;
    }

    index = endIndex + end.length;
  }

  return unclosed;
}

export function collectDiagnostics(text: string, options?: DiagnosticOptions): DiagnosticItem[] {
  const delimiters = getDelimiters(options);
  const diagnostics: DiagnosticItem[] = [];
  const mapper = new LineColumnMapper(text);
  const frontmatterValidator = options?.schema ? new SchemaValidator(options.schema) : null;
  const contentValidator = options?.contentSchema
    ? new SchemaValidator(options.contentSchema)
    : null;
  const filters = new Set([...DEFAULT_FILTERS, ...(options?.customFilters ?? [])]);

  const getValidatorForOffset = (offset: number): SchemaValidator | null => {
    const isFrontmatter = isOffsetInFrontmatter(text, offset, options?.frontmatterRange);
    if (isFrontmatter) {
      return frontmatterValidator;
    }
    return contentValidator ?? frontmatterValidator;
  };

  const commentBlocks = extractBlocks(text, delimiters.commentStart, delimiters.commentEnd);
  const statementBlocks = extractBlocks(text, delimiters.statementStart, delimiters.statementEnd);
  const expressionBlocks = extractBlocks(
    text,
    delimiters.expressionStart,
    delimiters.expressionEnd
  );
  const forScopes = buildForScopes(statementBlocks, commentBlocks, delimiters);

  const statementStack: BlockStackEntry[] = [];

  for (const block of statementBlocks) {
    if (isInsideBlocks(block.start, commentBlocks)) {
      continue;
    }

    const tag = parseStatementTag(block.content, delimiters);
    if (!tag) continue;

    if (tag.startsWith('end')) {
      const expected = tag.replace(/^end/, '');
      const last = statementStack[statementStack.length - 1];
      if (!last || last.tag !== expected) {
        diagnostics.push({
          message: `Unexpected closing tag: ${tag}`,
          range: createRangeFromOffsets(mapper, block.start, block.end),
          severity: DiagnosticSeverity.Error,
          code: 'templjs.unexpectedClosing',
        });
        continue;
      }
      statementStack.pop();
      continue;
    }

    if (['if', 'for', 'block', 'while', 'switch'].includes(tag)) {
      statementStack.push({ tag, start: block.start });
    }

    if (tag === 'for') {
      const rawInner = block.content.slice(
        delimiters.statementStart.length,
        block.content.length - delimiters.statementEnd.length
      );
      const statementContent = rawInner.trim();
      const trimOffset = rawInner.indexOf(statementContent);
      const contentStartOffset =
        block.start + delimiters.statementStart.length + (trimOffset >= 0 ? trimOffset : 0);
      const match = statementContent.match(/\s+in\s+([^\s]+)/);
      const validator = getValidatorForOffset(block.start);
      if (match && validator) {
        const path = match[1].trim();
        const result = validator.validateQueryPath(path);
        if (!result.valid) {
          const inIndex = statementContent.indexOf(path);
          const pathStart = inIndex >= 0 ? contentStartOffset + inIndex : block.start;
          const pathEnd = inIndex >= 0 ? pathStart + path.length : block.end;
          diagnostics.push({
            message: `Variable "${path}" not found in schema`,
            range: createRangeFromOffsets(mapper, pathStart, pathEnd),
            severity: DiagnosticSeverity.Error,
            code: 'templjs.undefinedVariable',
            suggestion: result.errors[0]?.suggestion,
          });
        }
      }
    } else {
      const rawInner = block.content.slice(
        delimiters.statementStart.length,
        block.content.length - delimiters.statementEnd.length
      );
      const statementContent = rawInner.trim();
      const trimOffset = rawInner.indexOf(statementContent);
      const contentStartOffset =
        block.start + delimiters.statementStart.length + (trimOffset >= 0 ? trimOffset : 0);

      const validator = getValidatorForOffset(block.start);
      if (validator && statementContent.length > 0) {
        const expressionPart = statementContent.replace(/^[A-Za-z_][\w]*\b\s*/, '');
        const expressionPartStart = statementContent.length - expressionPart.length;
        const variableSegment = expressionPart.split('|')[0] ?? expressionPart;
        for (const ref of extractVariableReferences(variableSegment)) {
          const scopedPath = resolveScopedPath(ref.path, block.start, forScopes);
          if (!isPathValidInContext(scopedPath, validator)) {
            const result = validator.validateQueryPath(scopedPath);
            diagnostics.push({
              message: `Variable "${ref.path}" not found in schema`,
              range: createRangeFromOffsets(
                mapper,
                contentStartOffset + expressionPartStart + ref.start,
                contentStartOffset + expressionPartStart + ref.end
              ),
              severity: DiagnosticSeverity.Error,
              code: 'templjs.undefinedVariable',
              suggestion: result.errors[0]?.suggestion,
            });
          }
        }

        for (const filter of extractFilters(expressionPart)) {
          if (!filters.has(filter)) {
            const filterIndex = expressionPart.indexOf(filter);
            const filterStart =
              filterIndex >= 0
                ? contentStartOffset + expressionPartStart + filterIndex
                : block.start;
            const filterEnd = filterIndex >= 0 ? filterStart + filter.length : block.end;
            diagnostics.push({
              message: `Filter "${filter}" not recognized`,
              range: createRangeFromOffsets(mapper, filterStart, filterEnd),
              severity: DiagnosticSeverity.Error,
              code: 'templjs.invalidFilter',
              suggestion: 'Check available filters in documentation',
            });
          }
        }
      }
    }
  }

  for (const entry of statementStack) {
    const endTag = `end${entry.tag}`;
    diagnostics.push({
      message: `Missing closing tag: ${endTag}`,
      range: createRangeFromOffsets(
        mapper,
        entry.start,
        entry.start + delimiters.statementStart.length
      ),
      severity: DiagnosticSeverity.Error,
      code: 'templjs.unclosedStatement',
      suggestion: `Insert ${delimiters.statementStart} ${endTag} ${delimiters.statementEnd}`,
    });
  }

  const unclosedStatements = findUnclosedDelimiters(
    text,
    delimiters.statementStart,
    delimiters.statementEnd,
    commentBlocks
  );
  for (const startOffset of unclosedStatements) {
    diagnostics.push({
      message: `Missing closing ${delimiters.statementEnd}`,
      range: createRangeFromOffsets(
        mapper,
        startOffset,
        startOffset + delimiters.statementStart.length
      ),
      severity: DiagnosticSeverity.Error,
      code: 'templjs.unclosedStatementDelimiter',
    });
  }

  const unclosedExpressions = findUnclosedDelimiters(
    text,
    delimiters.expressionStart,
    delimiters.expressionEnd,
    commentBlocks
  );
  for (const startOffset of unclosedExpressions) {
    diagnostics.push({
      message: `Missing closing ${delimiters.expressionEnd}`,
      range: createRangeFromOffsets(
        mapper,
        startOffset,
        startOffset + delimiters.expressionStart.length
      ),
      severity: DiagnosticSeverity.Error,
      code: 'templjs.unclosedExpressionDelimiter',
    });
  }

  for (const block of expressionBlocks) {
    if (isInsideBlocks(block.start, commentBlocks)) {
      continue;
    }

    const rawInner = block.content.slice(
      delimiters.expressionStart.length,
      block.content.length - delimiters.expressionEnd.length
    );
    const content = rawInner.trim();
    const trimOffset = rawInner.indexOf(content);
    const contentStartOffset =
      block.start + delimiters.expressionStart.length + (trimOffset >= 0 ? trimOffset : 0);

    const validator = getValidatorForOffset(block.start);
    if (validator) {
      const variableSegment = content.split('|')[0] ?? content;
      for (const ref of extractVariableReferences(variableSegment)) {
        const scopedPath = resolveScopedPath(ref.path, block.start, forScopes);
        if (!isPathValidInContext(scopedPath, validator)) {
          const result = validator.validateQueryPath(scopedPath);
          diagnostics.push({
            message: `Variable "${ref.path}" not found in schema`,
            range: createRangeFromOffsets(
              mapper,
              contentStartOffset + ref.start,
              contentStartOffset + ref.end
            ),
            severity: DiagnosticSeverity.Error,
            code: 'templjs.undefinedVariable',
            suggestion: result.errors[0]?.suggestion,
          });
        }
      }
    }

    for (const filter of extractFilters(content)) {
      if (!filters.has(filter)) {
        const filterIndex = content.indexOf(filter);
        const filterStart = filterIndex >= 0 ? contentStartOffset + filterIndex : block.start;
        const filterEnd = filterIndex >= 0 ? filterStart + filter.length : block.end;
        diagnostics.push({
          message: `Filter "${filter}" not recognized`,
          range: createRangeFromOffsets(mapper, filterStart, filterEnd),
          severity: DiagnosticSeverity.Error,
          code: 'templjs.invalidFilter',
          suggestion: 'Check available filters in documentation',
        });
      }
    }
  }

  if (options?.baseDiagnostics?.length) {
    const remapped = remapDiagnosticsToOriginal(text, options.baseDiagnostics, delimiters);
    diagnostics.push(...remapped);
  }

  return diagnostics;
}

export function remapDiagnosticsToOriginal(
  original: string,
  baseDiagnostics: DiagnosticItem[],
  delimiters: TemplateDelimiters = DEFAULT_DELIMITERS
): DiagnosticItem[] {
  if (baseDiagnostics.length === 0) return [];

  const templateRegex = buildBlockPattern(delimiters.statementStart, delimiters.statementEnd);
  const expressionRegex = buildBlockPattern(delimiters.expressionStart, delimiters.expressionEnd);
  const commentRegex = buildBlockPattern(delimiters.commentStart, delimiters.commentEnd);

  const combinedRegex = new RegExp(
    `${templateRegex.source}|${expressionRegex.source}|${commentRegex.source}`,
    'g'
  );

  const { cleaned, mappings } = generatePositionMappings(original, combinedRegex);
  const rangeMapper = new RangeMapper(original, cleaned, mappings);

  return baseDiagnostics.map((diagnostic) => {
    const mapped = rangeMapper.cleanedRangeToOriginal(
      diagnostic.range.start.line,
      diagnostic.range.start.character,
      diagnostic.range.end.line,
      diagnostic.range.end.character
    );

    return {
      ...diagnostic,
      range: {
        start: { line: mapped.startLine, character: mapped.startCol },
        end: { line: mapped.endLine, character: mapped.endCol },
      },
    };
  });
}
