import { SchemaValidator, type JSONSchema } from '@templjs/core';
import type { IntellisenseDelimiters } from './intellisense-provider';
import { LineColumnMapper, RangeMapper, generatePositionMappings } from './position-mapping';

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
  customFilters?: string[];
  delimiters?: Partial<TemplateDelimiters>;
  baseDiagnostics?: DiagnosticItem[];
}

const DEFAULT_DELIMITERS: TemplateDelimiters = {
  statementStart: '{%',
  statementEnd: '%}',
  expressionStart: '{{',
  expressionEnd: '}}',
  commentStart: '{#',
  commentEnd: '#}',
};

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

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getDelimiters(options?: DiagnosticOptions): TemplateDelimiters {
  return { ...DEFAULT_DELIMITERS, ...(options?.delimiters ?? {}) };
}

function buildBlockRegex(start: string, end: string): RegExp {
  return new RegExp(`${escapeRegex(start)}[\\s\\S]*?${escapeRegex(end)}`, 'g');
}

function extractBlocks(text: string, start: string, end: string): BlockMatch[] {
  const blocks: BlockMatch[] = [];
  const regex = buildBlockRegex(start, end);
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

function extractExpressionVariables(content: string): string[] {
  const vars: string[] = [];
  const match = content.match(/^[\w.]+(?:\[[^\]]+\])*/);
  if (match) {
    vars.push(match[0]);
  }
  return vars;
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
  const validator = options?.schema ? new SchemaValidator(options.schema) : null;
  const filters = new Set([...DEFAULT_FILTERS, ...(options?.customFilters ?? [])]);

  const commentBlocks = extractBlocks(text, delimiters.commentStart, delimiters.commentEnd);
  const statementBlocks = extractBlocks(text, delimiters.statementStart, delimiters.statementEnd);
  const expressionBlocks = extractBlocks(
    text,
    delimiters.expressionStart,
    delimiters.expressionEnd
  );

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
      const statementContent = block.content
        .slice(
          delimiters.statementStart.length,
          block.content.length - delimiters.statementEnd.length
        )
        .trim();
      const match = statementContent.match(/\s+in\s+([^\s]+)/);
      if (match && validator) {
        const path = match[1].trim();
        const result = validator.validateQueryPath(path);
        if (!result.valid) {
          diagnostics.push({
            message: `Variable "${path}" not found in schema`,
            range: createRangeFromOffsets(mapper, block.start, block.end),
            severity: DiagnosticSeverity.Error,
            code: 'templjs.undefinedVariable',
            suggestion: result.errors[0]?.suggestion,
          });
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

    const content = block.content
      .slice(
        delimiters.expressionStart.length,
        block.content.length - delimiters.expressionEnd.length
      )
      .trim();

    if (validator) {
      for (const variablePath of extractExpressionVariables(content)) {
        const result = validator.validateQueryPath(variablePath);
        if (!result.valid) {
          diagnostics.push({
            message: `Variable "${variablePath}" not found in schema`,
            range: createRangeFromOffsets(mapper, block.start, block.end),
            severity: DiagnosticSeverity.Error,
            code: 'templjs.undefinedVariable',
            suggestion: result.errors[0]?.suggestion,
          });
        }
      }
    }

    for (const filter of extractFilters(content)) {
      if (!filters.has(filter)) {
        diagnostics.push({
          message: `Filter "${filter}" not recognized`,
          range: createRangeFromOffsets(mapper, block.start, block.end),
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

  const templateRegex = buildBlockRegex(delimiters.statementStart, delimiters.statementEnd);
  const expressionRegex = buildBlockRegex(delimiters.expressionStart, delimiters.expressionEnd);
  const commentRegex = buildBlockRegex(delimiters.commentStart, delimiters.commentEnd);

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
