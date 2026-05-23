import {
  extractTemplateStatementExpression,
  getBuiltinFilterNames,
  parseTemplateForHeader,
  resolveSemanticHostLanguage,
  resolveSemanticZoneByHostLanguage,
  resolveSemanticZone,
  SchemaValidator,
  tokenize,
  TokenType,
  validateTemplateStatementSyntax,
} from '@templjs/core';
import { LineColumnMapper } from './position-mapping.js';
import { resolveDelimiters } from './template-delimiters.js';
import {
  buildForScopesInText,
  resolveScopedPath,
  resolveScopedPathInText as resolveScopedPathInTemplate,
  getInScopeTemplateBindings,
} from './scope-resolution.js';
import {
  extractExpressionFilterReferences,
  extractExpressionVariableReferences,
} from './expression-analysis.js';
import {
  DiagnosticSeverity,
  type DiagnosticOptions,
  type DiagnosticRange,
  type SemanticDiagnosticRecord,
  type TemplateDelimiters,
} from './diagnostic-types.js';

let cachedDefaultFilters: ReadonlySet<string> | undefined;

function getDefaultFilters(): ReadonlySet<string> {
  if (!cachedDefaultFilters) {
    cachedDefaultFilters = new Set(getBuiltinFilterNames());
  }

  return cachedDefaultFilters;
}

interface BlockMatch {
  type: TokenType.COMMENT | TokenType.STATEMENT | TokenType.EXPRESSION;
  start: number;
  end: number;
  content: string;
}

interface BlockStackEntry {
  tag: string;
  start: number;
  tagStart: number;
  tagEnd: number;
  /** False when the opening statement was syntactically invalid. */
  syntacticallyValid: boolean;
  /**
   * Some invalid openers (notably `if`) should still emit unclosedStatement
   * when their matching closing tag is missing.
   */
  reportUnclosedWhenInvalid: boolean;
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

function getDelimiters(options?: DiagnosticOptions): TemplateDelimiters {
  return resolveDelimiters(options?.delimiters);
}

function tokenPositionToOffset(mapper: LineColumnMapper, line: number, column: number): number {
  return mapper.lineColCodePointToOffset(Math.max(0, line - 1), column);
}

function extractBlocks(text: string, delimiters: TemplateDelimiters): BlockMatch[] {
  const blocks: BlockMatch[] = [];
  const mapper = new LineColumnMapper(text);
  const tokens = tokenize(text, {
    recoverUnclosedDelimiters: true,
    delimiters: {
      statement_start: delimiters.statementStart,
      statement_end: delimiters.statementEnd,
      expression_start: delimiters.expressionStart,
      expression_end: delimiters.expressionEnd,
      comment_start: delimiters.commentStart,
      comment_end: delimiters.commentEnd,
    },
  });

  for (const token of tokens) {
    if (token.type === TokenType.TEXT) {
      continue;
    }
    if (token.delimiterEnd && !token.content.endsWith(token.delimiterEnd)) {
      continue;
    }

    const start = tokenPositionToOffset(mapper, token.start.line, token.start.column);
    blocks.push({
      type: token.type,
      start,
      end: start + token.content.length,
      content: token.content,
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
  return inner.split(/\s+/).find((token) => token.length > 0 && token !== '-') ?? '';
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
 * Returns true if the root segment of `resolvedPath` matches a locally
 * declared template binding (for-alias, set-variable, etc.) in scope at
 * `offset`.  When true, schema validation should be skipped because the path
 * points into a runtime-only variable that is not described by the schema.
 */
function isDirectLocalTemplateReference(
  text: string,
  rawPath: string,
  offset: number,
  delimiters?: Partial<TemplateDelimiters>
): boolean {
  const resolvedDelimiters = resolveDelimiters(delimiters);
  const rawRootSegment = rawPath.split('.')[0];
  const rawRoot = rawRootSegment.replace(/\[.*$/, '');
  const isDirectReference = rawPath === rawRoot && rawRoot.length > 0;
  if (!isDirectReference) {
    return false;
  }

  const bindings = getInScopeTemplateBindings(text, offset, resolvedDelimiters);
  return bindings.some((b) => b.name === rawRoot);
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

export function collectTemplateDiagnostics(
  text: string,
  options?: DiagnosticOptions
): SemanticDiagnosticRecord[] {
  const delimiters = getDelimiters(options);
  const diagnostics: SemanticDiagnosticRecord[] = [];
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

  const templateBlocks = extractBlocks(text, delimiters);
  const commentBlocks = templateBlocks.filter((block) => block.type === TokenType.COMMENT);
  const statementBlocks = templateBlocks.filter((block) => block.type === TokenType.STATEMENT);
  const expressionBlocks = templateBlocks.filter((block) => block.type === TokenType.EXPRESSION);
  const forScopes = buildForScopesInText(text, delimiters);

  const statementStack: BlockStackEntry[] = [];

  for (const block of statementBlocks) {
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
      const tagRelativeOffset = statementContent.search(/[A-Za-z_]/);
      const tagStartOffset = contentStartOffset + (tagRelativeOffset >= 0 ? tagRelativeOffset : 0);
      const tagEndOffset = tagStartOffset + tag.length;
      const syntaxValidation = validateTemplateStatementSyntax(tag, statementContent);
      if (!syntaxValidation.valid) {
        diagnostics.push({
          message: syntaxValidation.message ?? `Invalid ${tag} statement`,
          range: createRangeFromOffsets(mapper, tagStartOffset, tagEndOffset),
          severity: DiagnosticSeverity.Error,
          code: 'templjs.invalidStatement',
          suggestion: syntaxValidation.suggestion,
        });
        // Push block-opener tags even when syntactically invalid so that
        // matching end-tags (endif, endfor, etc.) are still correctly paired
        // and not falsely flagged as unexpected.
        if (!['set', 'case', 'default'].includes(tag)) {
          statementStack.push({
            tag,
            start: block.start,
            tagStart: tagStartOffset,
            tagEnd: tagEndOffset,
            syntacticallyValid: false,
            reportUnclosedWhenInvalid: tag === 'if',
          });
        }
        continue;
      }

      if (!['set', 'case', 'default'].includes(tag)) {
        statementStack.push({
          tag,
          start: block.start,
          tagStart: tagStartOffset,
          tagEnd: tagEndOffset,
          syntacticallyValid: true,
          reportUnclosedWhenInvalid: false,
        });
      }
    }

    if (tag === 'for') {
      const { statementContent, contentStartOffset } = parseStatementContent(block, delimiters);
      // Use the core-backed ForScope data to avoid multi-token regex re-parsing.
      // ForScope.iterableExpression is the authoritative expression extracted by
      // parseFallbackForStatement in @templjs/core — handles complex iterables such
      // as users[activeIndex + 1] and users["full name"] correctly.
      const matchingScope = forScopes.find(
        (s) => s.bodyStart >= block.start && s.bodyStart <= block.end + 1
      );
      const iterableExpression = matchingScope?.iterableExpression;
      const validator = getValidatorForOffset(block.start);
      if (iterableExpression && validator) {
        const parsedForHeader = parseTemplateForHeader(statementContent);
        const iterableStart = parsedForHeader !== null ? parsedForHeader.iterableStart : 0;
        const filterRefs = extractFilters(iterableExpression);
        for (const ref of extractVariableReferences(iterableExpression)) {
          if (isDirectLocalTemplateReference(text, ref.path, block.start, options?.delimiters)) {
            continue;
          }

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
        const statementExpression = extractTemplateStatementExpression(statementContent);
        if (!statementExpression) {
          continue;
        }

        const expressionPart = statementExpression.expression;
        const expressionPartStart = statementExpression.startOffset;
        for (const ref of extractVariableReferences(expressionPart)) {
          if (isDirectLocalTemplateReference(text, ref.path, block.start, options?.delimiters)) {
            continue;
          }

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
    if (!entry.syntacticallyValid && !entry.reportUnclosedWhenInvalid) {
      continue;
    }
    const endTag = `end${entry.tag}`;
    diagnostics.push({
      message: `Missing closing tag: ${endTag}`,
      range: createRangeFromOffsets(mapper, entry.tagStart, entry.tagEnd),
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
        if (isDirectLocalTemplateReference(text, ref.path, block.start, options?.delimiters)) {
          continue;
        }

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

  return diagnostics;
}
