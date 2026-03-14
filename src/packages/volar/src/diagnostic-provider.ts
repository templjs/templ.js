import {
  getBuiltinFilterNames,
  resolveSemanticHostLanguage,
  resolveSemanticZoneByHostLanguage,
  resolveSemanticZone,
  toSemanticZone,
  SchemaValidator,
  type JSONSchema,
} from '@templjs/core';
import type { IntellisenseDelimiters } from './intellisense-provider.js';
import { LineColumnMapper, RangeMapper, generatePositionMappings } from './position-mapping.js';
import { buildBlockPattern, resolveDelimiters, DEFAULT_DELIMITERS } from './template-delimiters.js';
import { type FrontmatterRange } from './frontmatter-zone.js';
import {
  buildForScopesInText,
  resolveScopedPath,
  resolveScopedPathInText as resolveScopedPathInTemplate,
} from './scope-resolution.js';
import {
  extractExpressionFilterReferences,
  extractExpressionVariableReferences,
} from './expression-analysis.js';

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
  documentUri?: string;
  schema?: JSONSchema;
  contentSchema?: JSONSchema;
  frontmatterRange?: FrontmatterRange;
  customFilters?: string[];
  delimiters?: Partial<TemplateDelimiters>;
  baseDiagnostics?: DiagnosticItem[];
}

let cachedDefaultFilters: ReadonlySet<string> | undefined;

function getDefaultFilters(): ReadonlySet<string> {
  if (!cachedDefaultFilters) {
    cachedDefaultFilters = new Set(getBuiltinFilterNames());
  }

  return cachedDefaultFilters;
}

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

function extractVariableReferences(content: string): VariableReference[] {
  return extractExpressionVariableReferences(content).map((ref) => ({
    path: ref.path,
    start: ref.start,
    end: ref.end,
  }));
}

function extractFilters(content: string): string[] {
  return extractExpressionFilterReferences(content).map((ref) => ref.name);
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
  return resolveScopedPathInTemplate(text, path, offset, options?.delimiters);
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
  const filters = new Set([...getDefaultFilters(), ...(options?.customFilters ?? [])]);

  const getValidatorForOffset = (offset: number): SchemaValidator | null => {
    const hostLanguage = resolveSemanticHostLanguage(options?.documentUri);
    const semanticZone =
      options?.frontmatterRange &&
      offset >= options.frontmatterRange.start &&
      offset < options.frontmatterRange.end
        ? toSemanticZone('frontmatter')
        : hostLanguage === 'unknown'
          ? resolveSemanticZone(text, offset)
          : resolveSemanticZoneByHostLanguage(text, offset, hostLanguage);
    if (semanticZone.kind === 'metadata') {
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
  const forScopes = buildForScopesInText(text, delimiters);

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
        for (const ref of extractVariableReferences(expressionPart)) {
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
      for (const ref of extractVariableReferences(content)) {
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
