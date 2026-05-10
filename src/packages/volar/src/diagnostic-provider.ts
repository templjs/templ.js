import {
  getBuiltinFilterNames,
  resolveSemanticHostLanguage,
  resolveSemanticZoneByHostLanguage,
  resolveSemanticZone,
  SchemaValidator,
  type JSONSchema,
} from '@templjs/core';
import type { IntellisenseDelimiters } from './intellisense-provider.js';
import { LineColumnMapper, RangeMapper, generatePositionMappings } from './position-mapping.js';
import { buildBlockPattern, resolveDelimiters, DEFAULT_DELIMITERS } from './template-delimiters.js';
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

interface FilterReference {
  name: string;
  start: number;
  end: number;
}

interface ParsedStatementContent {
  statementContent: string;
  contentStartOffset: number;
}

interface StatementValidationResult {
  valid: boolean;
  message?: string;
  suggestion?: string;
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
  return tokenize(inner)[0] ?? '';
}

function parseStatementContent(
  block: BlockMatch,
  delimiters: TemplateDelimiters
): ParsedStatementContent {
  const rawInner = block.content.slice(
    delimiters.statementStart.length,
    block.content.length - delimiters.statementEnd.length
  );
  const statementContent = rawInner.trim();
  const trimOffset = rawInner.indexOf(statementContent);
  const contentStartOffset =
    block.start + delimiters.statementStart.length + (trimOffset >= 0 ? trimOffset : 0);

  return { statementContent, contentStartOffset };
}

// ---------------------------------------------------------------------------
// Deterministic token-based statement shape validators
// ---------------------------------------------------------------------------

/**
 * Tokenise statement content, discarding standalone `-` whitespace-control
 * markers that may appear at the boundaries of the inner text after the
 * enclosing delimiters have been sliced off (e.g. `{%- … %}` or `{% … -%}`).
 */
function tokenize(s: string): string[] {
  return s.split(/\s+/).filter((t) => t.length > 0 && t !== '-');
}

function isIdentifier(token: string | undefined): boolean {
  return token !== undefined && /^[A-Za-z_]\w*$/.test(token);
}

function isBlockName(token: string | undefined): boolean {
  return token !== undefined && /^[A-Za-z_][\w-]*$/.test(token);
}

function validateStatementSyntax(tag: string, statementContent: string): StatementValidationResult {
  const tokens = tokenize(statementContent);

  switch (tag) {
    case 'for':
      // for <name> in <expression…>  →  minimum 4 tokens
      if (tokens.length < 4 || !isIdentifier(tokens[1]) || tokens[2] !== 'in') {
        return {
          valid: false,
          message: 'Invalid for statement: expected "for <name> in <expression>"',
          suggestion: 'Use `{% for item in items %}`',
        };
      }
      return { valid: true };

    case 'if':
      // if <expression>  →  at least 2 tokens
      if (tokens.length < 2) {
        return {
          valid: false,
          message: 'Invalid if statement: expected "if <expression>"',
          suggestion: 'Use `{% if condition %}`',
        };
      }
      return { valid: true };

    case 'while':
      if (tokens.length < 2) {
        return {
          valid: false,
          message: 'Invalid while statement: expected "while <expression>"',
          suggestion: 'Use `{% while condition %}`',
        };
      }
      return { valid: true };

    case 'switch':
      if (tokens.length < 2) {
        return {
          valid: false,
          message: 'Invalid switch statement: expected "switch <expression>"',
          suggestion: 'Use `{% switch value %}`',
        };
      }
      return { valid: true };

    case 'block':
      // block <name>  →  exactly 2 tokens, name is a valid identifier (allows hyphens)
      if (tokens.length !== 2 || !isBlockName(tokens[1])) {
        return {
          valid: false,
          message: 'Invalid block statement: expected "block <name>"',
          suggestion: 'Use `{% block content %}`',
        };
      }
      return { valid: true };

    case 'set': {
      // set <name>  or  set <name> = <expression…>
      if (!isIdentifier(tokens[1])) {
        return {
          valid: false,
          message: 'Invalid set statement: expected "set <name>" or "set <name> = <expression>"',
          suggestion: 'Use `{% set var = value %}` or `{% set var %}`',
        };
      }
      // If there are tokens beyond the name they must form  = <expr>
      if (tokens.length > 2 && (tokens[2] !== '=' || tokens.length < 4)) {
        return {
          valid: false,
          message: 'Invalid set statement: expected "set <name>" or "set <name> = <expression>"',
          suggestion: 'Use `{% set var = value %}` or `{% set var %}`',
        };
      }
      return { valid: true };
    }

    case 'case':
      if (tokens.length < 2) {
        return {
          valid: false,
          message: 'Invalid case statement: expected "case <value>"',
          suggestion: 'Use `{% case value %}`',
        };
      }
      return { valid: true };

    case 'default':
      // default takes no arguments
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

function extractVariableReferences(content: string): VariableReference[] {
  return extractExpressionVariableReferences(content).map((ref) => ({
    path: ref.path,
    start: ref.start,
    end: ref.end,
  }));
}

function extractFilters(content: string): FilterReference[] {
  return extractExpressionFilterReferences(content).map((ref) => ({
    name: ref.name,
    start: ref.start,
    end: ref.end,
  }));
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
      hostLanguage === 'unknown'
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

    if (['if', 'for', 'block', 'while', 'switch', 'set', 'case', 'default'].includes(tag)) {
      const { statementContent, contentStartOffset } = parseStatementContent(block, delimiters);
      const syntaxValidation = validateStatementSyntax(tag, statementContent);
      if (!syntaxValidation.valid) {
        diagnostics.push({
          message: syntaxValidation.message ?? `Invalid ${tag} statement`,
          range: createRangeFromOffsets(
            mapper,
            contentStartOffset,
            contentStartOffset + tag.length
          ),
          severity: DiagnosticSeverity.Error,
          code: 'templjs.invalidStatement',
          suggestion: syntaxValidation.suggestion,
        });
        continue;
      }

      if (!['set', 'case', 'default'].includes(tag)) {
        statementStack.push({ tag, start: block.start });
      }
    }

    if (tag === 'for') {
      const { statementContent, contentStartOffset } = parseStatementContent(block, delimiters);
      const match = statementContent.match(/^for\s+[A-Za-z_][\w]*\s+in\s+([\s\S]+)$/);
      const validator = getValidatorForOffset(block.start);
      if (match && validator) {
        const iterableExpression = match[1].trim();
        const iterableStart = statementContent.indexOf(iterableExpression);
        const filterRefs = extractFilters(iterableExpression);
        for (const ref of extractVariableReferences(iterableExpression)) {
          const overlapsFilter = filterRefs.some(
            (filterRef) => ref.start >= filterRef.start && ref.end <= filterRef.end
          );
          if (overlapsFilter) {
            continue;
          }

          const scopedPath = resolveScopedPath(ref.path, block.start, forScopes);
          const result = validator.validateQueryPath(scopedPath);
          if (!result.valid) {
            const offsetBase = contentStartOffset + (iterableStart >= 0 ? iterableStart : 0);
            diagnostics.push({
              message: `Variable "${ref.path}" not found in schema`,
              range: createRangeFromOffsets(mapper, offsetBase + ref.start, offsetBase + ref.end),
              severity: DiagnosticSeverity.Error,
              code: 'templjs.undefinedVariable',
              suggestion: result.errors[0]?.suggestion,
            });
          }
        }
      }
    } else {
      const { statementContent, contentStartOffset } = parseStatementContent(block, delimiters);

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

        for (const ref of extractFilters(expressionPart)) {
          if (!filters.has(ref.name)) {
            diagnostics.push({
              message: `Filter "${ref.name}" not recognized`,
              range: createRangeFromOffsets(
                mapper,
                contentStartOffset + expressionPartStart + ref.start,
                contentStartOffset + expressionPartStart + ref.end
              ),
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

    for (const ref of extractFilters(content)) {
      if (!filters.has(ref.name)) {
        diagnostics.push({
          message: `Filter "${ref.name}" not recognized`,
          range: createRangeFromOffsets(
            mapper,
            contentStartOffset + ref.start,
            contentStartOffset + ref.end
          ),
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
