/**
 * @templjs/volar - Volar language server plugin for templjs
 *
 * This package provides Volar integration for IDE support including:
 * - Syntax highlighting
 * - Diagnostics and error reporting
 * - IntelliSense and autocompletion
 * - Virtual code mapping for base format delegation
 */

import { createRequire } from 'node:module';
import type {
  CodeInformation,
  CodegenContext,
  LanguagePlugin,
  VirtualCode,
} from '@volar/language-core';
import type * as ts from 'typescript';
import { URI } from 'vscode-uri';
import {
  tokenize,
  TokenType,
  type DelimiterConfig as CoreDelimiterConfig,
  type Token,
} from '@templjs/core';
import {
  buildDelimiterPairPattern,
  buildTemplateBlockPattern,
  resolveDelimiters,
  type DelimiterConfig as TemplateDelimiterConfig,
} from './template-delimiters.js';
// Export semantic token provider
export {
  extractSemanticTokens,
  SEMANTIC_TOKEN_LEGEND,
  SemanticTokenModifiers,
  SemanticTokenTypes,
  DEFAULT_DELIMITERS,
  type TokenInfo,
  type DelimiterConfig,
} from './semantic-token-provider.js';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version: string };

/**
 * Base format types that templates can embed
 */
type BaseFormat = 'markdown' | 'json' | 'yaml' | 'html' | 'plain';

/**
 * Mapping between file extension and base format language ID
 */
const EXTENSION_TO_BASE_FORMAT: Record<string, BaseFormat> = {
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.html': 'html',
  '.htm': 'html',
};

interface CompiledDelimiterPatterns {
  delimiters: TemplateDelimiterConfig;
  delimiterPairPattern: RegExp;
  templateBlockPattern: RegExp;
}

export interface TempljsLanguagePluginOptions {
  delimiters?: Partial<TemplateDelimiterConfig>;
  schema?: object;
  schemaUri?: string;
  contentSchema?: object;
  contentSchemaUri?: string;
}

function compileDelimiterPatterns(
  delimiters: Partial<TemplateDelimiterConfig> = {}
): CompiledDelimiterPatterns {
  const resolvedDelimiters = resolveDelimiters(delimiters);
  const delimiterPairPattern = buildDelimiterPairPattern(resolvedDelimiters);
  const templateBlockPattern = buildTemplateBlockPattern(resolvedDelimiters);

  return {
    delimiters: resolvedDelimiters,
    delimiterPairPattern,
    templateBlockPattern,
  };
}

const DEFAULT_CODE_INFORMATION: CodeInformation = {
  verification: true,
  completion: true,
  semantic: true,
  navigation: true,
  structure: true,
  format: true,
};

/**
 * Map base format to VS Code language ID
 */
function getBaseFormatLanguageId(baseFormat: BaseFormat): string {
  switch (baseFormat) {
    case 'markdown':
      return 'markdown';
    case 'json':
      return 'json';
    case 'yaml':
      return 'yaml';
    case 'html':
      return 'html';
    case 'plain':
    default:
      return 'plaintext';
  }
}

/**
 * Create a TypeScript snapshot from cleaned code content
 * Used to provide cleaned code to language services via Volar's virtual code
 */
function createCleanedSnapshot(text: string): ts.IScriptSnapshot {
  return {
    getText: (start: number, end?: number) =>
      text.substring(start, end === undefined ? text.length : end),
    getLength: () => text.length,
    getChangeRange: () => undefined,
  };
}

/**
 * Detect base format from file extension
 */
function detectBaseFormat(fileUriString: string): BaseFormat {
  try {
    // Extract filename from URI (handle both file:// and regular paths)
    const filePath = fileUriString.replace(/^file:\/\//, '').replace(/^.*\//, '');

    const hostFirstMatch = filePath.match(/\.(md|markdown|json|ya?ml|html?)\.(templ|tmpl|tpl)$/i);
    const templFirstMatch = filePath.match(/\.(templ|tmpl|tpl)\.(md|markdown|json|ya?ml|html?)$/i);
    const hostExtension = hostFirstMatch?.[1] ?? templFirstMatch?.[2];

    if (hostExtension) {
      const format = EXTENSION_TO_BASE_FORMAT[`.${hostExtension.toLowerCase()}`];
      if (format) return format;
    }

    if (/\.(templ|tmpl|tpl)$/i.test(filePath)) {
      // Bare template files default to markdown delegation for richer authoring support.
      return 'markdown';
    }
  } catch {
    // Fallback to plain text
  }

  return 'plain';
}

/**
 * Embedded host virtual code used for base language delegation.
 */
class TempljsHostEmbeddedVirtualCode implements VirtualCode {
  id: string;
  languageId: string;
  snapshot: ts.IScriptSnapshot;
  mappings: VirtualCode['mappings'];
  embeddedCodes: VirtualCode[] = [];

  constructor(baseFormat: BaseFormat, cleaned: string, mappings: VirtualCode['mappings']) {
    this.id = `host.${getBaseFormatLanguageId(baseFormat)}`;
    this.languageId = getBaseFormatLanguageId(baseFormat);
    this.snapshot = createCleanedSnapshot(cleaned);
    this.mappings = mappings;
  }
}

class TempljsEmbeddedVirtualCode implements VirtualCode {
  id: string;
  languageId: string;
  snapshot: ts.IScriptSnapshot;
  mappings: VirtualCode['mappings'];
  embeddedCodes: VirtualCode[] = [];

  constructor(id: string, languageId: string, content: string, mappings: VirtualCode['mappings']) {
    this.id = id;
    this.languageId = languageId;
    this.snapshot = createCleanedSnapshot(content);
    this.mappings = mappings;
  }
}

/**
 * Root virtual code representation for templjs source.
 */
class TempljsVirtualCode implements VirtualCode {
  id = 'root';
  languageId: string;
  snapshot: ts.IScriptSnapshot;
  private sourceSnapshot: ts.IScriptSnapshot;
  private baseFormat: BaseFormat;
  private original: string;
  private cleaned: string;
  private readonly delimiterPairPattern: RegExp;
  private readonly templateBlockPattern: RegExp;
  private originalToCleanedOffsets: number[] = [0];
  private hostMappings: VirtualCode['mappings'] = [];
  metadata: {
    hostLanguage: string;
    sourceFileKind: string;
  };
  mappings: Array<{
    sourceOffsets: number[];
    generatedOffsets: number[];
    lengths: number[];
    data: CodeInformation;
  }> = [];
  embeddedCodes: VirtualCode[] = [];

  constructor(
    original: string,
    baseFormat: BaseFormat,
    snapshot: ts.IScriptSnapshot,
    patterns: CompiledDelimiterPatterns
  ) {
    this.baseFormat = baseFormat;
    this.languageId = getBaseFormatLanguageId(baseFormat);
    this.sourceSnapshot = snapshot;
    this.original = original;
    this.delimiterPairPattern = patterns.delimiterPairPattern;
    this.templateBlockPattern = patterns.templateBlockPattern;

    // Generate cleaned host code and mappings
    const { cleaned, originalToCleanedOffsets } = this.stripTemplateSyntax(original);
    this.cleaned = cleaned;
    this.originalToCleanedOffsets = originalToCleanedOffsets;
    this.hostMappings = this.createMappings(original, cleaned, originalToCleanedOffsets);
    this.snapshot = createCleanedSnapshot(cleaned);
    this.mappings = this.hostMappings;
    this.metadata = {
      hostLanguage: getBaseFormatLanguageId(baseFormat),
      sourceFileKind: 'template',
    };
    this.syncEmbeddedCodes();
  }

  updateFromChange(
    snapshot: ts.IScriptSnapshot,
    baseFormat: BaseFormat,
    changeRange?: ts.TextChangeRange
  ): TempljsVirtualCode {
    if (baseFormat !== this.baseFormat || !changeRange) {
      this.rebuildFromSnapshot(snapshot, baseFormat);
      return this;
    }

    const start = changeRange.span.start;
    const oldLength = changeRange.span.length;
    const newLength = changeRange.newLength;
    const insertedText = snapshot.getText(start, start + newLength);
    const removedText = this.original.slice(start, start + oldLength);
    const simpleEdit = this.isSimpleEdit(removedText, insertedText);

    if (!this.applyEdit(start, oldLength, insertedText)) {
      this.rebuildFromSnapshot(snapshot, baseFormat);
      return this;
    }

    // For template-marker edits, recompute exact offsets and mappings from full source.
    // For simple edits, applyEdit already updates offsets/mappings incrementally.
    if (!simpleEdit) {
      const { cleaned, originalToCleanedOffsets } = this.stripTemplateSyntax(this.original);
      this.cleaned = cleaned;
      this.originalToCleanedOffsets = originalToCleanedOffsets;
      this.hostMappings = this.createMappings(this.original, cleaned, originalToCleanedOffsets);
    }

    this.sourceSnapshot = snapshot;
    this.hostMappings = this.createMappings(
      this.original,
      this.cleaned,
      this.originalToCleanedOffsets
    );
    this.mappings = this.hostMappings;
    this.snapshot = createCleanedSnapshot(this.cleaned);
    this.syncEmbeddedCodes();

    return this;
  }

  private rebuildFromSnapshot(snapshot: ts.IScriptSnapshot, baseFormat: BaseFormat): void {
    const source = snapshot.getText(0, snapshot.getLength());
    const { cleaned, originalToCleanedOffsets } = this.stripTemplateSyntax(source);

    this.baseFormat = baseFormat;
    this.languageId = getBaseFormatLanguageId(baseFormat);
    this.sourceSnapshot = snapshot;
    this.original = source;
    this.cleaned = cleaned;
    this.originalToCleanedOffsets = originalToCleanedOffsets;
    this.hostMappings = this.createMappings(source, cleaned, originalToCleanedOffsets);
    this.mappings = this.hostMappings;
    this.snapshot = createCleanedSnapshot(cleaned);
    this.metadata = {
      hostLanguage: getBaseFormatLanguageId(baseFormat),
      sourceFileKind: 'template',
    };
    this.syncEmbeddedCodes();
  }

  getSourceSnapshot(): ts.IScriptSnapshot {
    return this.sourceSnapshot;
  }

  private buildTemplateDslSnapshot(): string {
    const maskedChars: string[] = [...this.original].map((char) =>
      char === '\n' || char === '\r' ? char : ' '
    );
    const templatePattern = new RegExp(this.templateBlockPattern.source, 'g');
    let match;

    while ((match = templatePattern.exec(this.original)) !== null) {
      const templateBlock = match[0];
      for (let i = 0; i < templateBlock.length; i++) {
        maskedChars[match.index + i] = templateBlock[i] ?? ' ';
      }
    }

    return maskedChars.join('');
  }

  private syncEmbeddedCodes(): void {
    const embedded: VirtualCode[] = [
      new TempljsHostEmbeddedVirtualCode(this.baseFormat, this.cleaned, this.hostMappings),
      new TempljsEmbeddedVirtualCode('templjs.dsl', 'templjs', this.buildTemplateDslSnapshot(), [
        {
          sourceOffsets: [0],
          generatedOffsets: [0],
          lengths: [this.original.length],
          data: DEFAULT_CODE_INFORMATION,
        },
      ]),
    ];

    this.embeddedCodes = embedded;
  }

  private applyEdit(start: number, deleteLength: number, insertedText: string): boolean {
    const removedText = this.original.slice(start, start + deleteLength);

    // Simple case: no template markers involved, apply edit directly
    if (this.isSimpleEdit(removedText, insertedText)) {
      // Map original offsets to cleaned offsets (they may have diverged after bounded edits)
      const mappedStart = this.mapOriginalOffsetToCleaned(start);
      const mappedEnd = this.mapOriginalOffsetToCleaned(start + deleteLength);

      if (mappedStart === null || mappedEnd === null || mappedEnd < mappedStart) {
        // Mapping failed, fall back to bounded edit
        return this.applyBoundedEdit(start, deleteLength, insertedText);
      }

      // Apply edit to original (using original offsets)
      this.original =
        this.original.slice(0, start) + insertedText + this.original.slice(start + deleteLength);

      // Apply edit to cleaned (using mapped offsets)
      this.cleaned =
        this.cleaned.slice(0, mappedStart) + insertedText + this.cleaned.slice(mappedEnd);

      // Update offset map + mappings incrementally for simple edits
      this.originalToCleanedOffsets = this.patchOffsetsForSimpleEdit(
        this.originalToCleanedOffsets,
        start,
        deleteLength,
        insertedText.length,
        mappedStart,
        mappedEnd
      );
      this.hostMappings = this.createMappings(
        this.original,
        this.cleaned,
        this.originalToCleanedOffsets
      );

      return true;
    }

    // Template markers detected: use bounded window reprocessing
    return this.applyBoundedEdit(start, deleteLength, insertedText);
  }

  private patchOffsetsForSimpleEdit(
    previousOffsets: number[],
    start: number,
    deleteLength: number,
    insertLength: number,
    mappedStart: number,
    mappedEnd: number
  ): number[] {
    const previousOriginalLength = previousOffsets.length - 1;
    const nextOriginalLength = previousOriginalLength - deleteLength + insertLength;
    const nextOffsets = new Array<number>(nextOriginalLength + 1);

    for (let i = 0; i <= start; i++) {
      nextOffsets[i] = previousOffsets[i] ?? 0;
    }

    for (let i = 1; i <= insertLength; i++) {
      nextOffsets[start + i] = mappedStart + i;
    }

    const cleanedDelta = insertLength - (mappedEnd - mappedStart);
    for (let i = start + deleteLength; i <= previousOriginalLength; i++) {
      const shiftedIndex = i - deleteLength + insertLength;
      nextOffsets[shiftedIndex] = (previousOffsets[i] ?? mappedEnd) + cleanedDelta;
    }

    return nextOffsets;
  }

  private isSimpleEdit(removedText: string, insertedText: string): boolean {
    return (
      !this.delimiterPairPattern.test(removedText) && !this.delimiterPairPattern.test(insertedText)
    );
  }

  /**
   * Apply edit using bounded window reprocessing when template markers are involved.
   * Expands change to nearby line boundaries and reprocesses only that region.
   */
  private applyBoundedEdit(start: number, deleteLength: number, insertedText: string): boolean {
    const MAX_WINDOW_SIZE = 5000; // Characters
    const window = this.findEditWindow(start, deleteLength, MAX_WINDOW_SIZE);

    if (!window) {
      // Window too large or couldn't find safe boundaries
      return false;
    }

    // Determine cleaned positions for window boundaries BEFORE updating original
    const cleanedWindowStart = this.mapOriginalToCleaned(window.start);
    const cleanedWindowEnd = this.mapOriginalToCleaned(window.end);

    // Apply the edit to original text
    const before = this.original.slice(0, start);
    const after = this.original.slice(start + deleteLength);
    this.original = before + insertedText + after;

    // Reprocess the bounded window in the updated original
    const windowStart = window.start;
    const windowEnd = window.end - deleteLength + insertedText.length; // Adjust for length change
    const windowText = this.original.slice(windowStart, windowEnd);

    // Re-strip template syntax for this window
    const { cleaned: windowCleaned } = this.stripTemplateSyntax(windowText);

    // Reconstruct cleaned text with the reprocessed window
    const cleanedBefore = this.cleaned.slice(0, cleanedWindowStart);
    const cleanedAfter = this.cleaned.slice(cleanedWindowEnd);
    this.cleaned = cleanedBefore + windowCleaned + cleanedAfter;

    return true;
  }

  /**
   * Find a bounded window around the edit region, expanding to line boundaries.
   * Returns null if window would exceed max size.
   */
  private findEditWindow(
    start: number,
    deleteLength: number,
    maxSize: number
  ): { start: number; end: number } | null {
    const end = start + deleteLength;

    // Expand to previous line boundary
    let windowStart = start;
    while (windowStart > 0 && windowStart > start - maxSize / 2) {
      windowStart--;
      if (this.original[windowStart] === '\n') {
        windowStart++; // Include from start of line
        break;
      }
    }

    // Expand to next line boundary
    let windowEnd = end;
    while (windowEnd < this.original.length && windowEnd < end + maxSize / 2) {
      if (this.original[windowEnd] === '\n') {
        windowEnd++; // Include newline
        break;
      }
      windowEnd++;
    }

    // Verify window size is reasonable
    if (windowEnd - windowStart > maxSize) {
      return null;
    }

    return { start: windowStart, end: windowEnd };
  }

  /**
   * Map position in original text to exact position in cleaned text.
   */
  private mapOriginalToCleaned(originalPos: number): number {
    if (this.originalToCleanedOffsets.length === 0) {
      return 0;
    }

    const clamped = Math.max(0, Math.min(originalPos, this.original.length));
    const mapped = this.originalToCleanedOffsets[clamped];

    if (mapped === undefined) {
      return this.originalToCleanedOffsets[this.originalToCleanedOffsets.length - 1] ?? 0;
    }

    return mapped;
  }

  /**
   * Map position in original text to exact position in cleaned text.
   * Returns null if accurate mapping cannot be determined.
   */
  private mapOriginalOffsetToCleaned(originalPos: number): number | null {
    const clamped = Math.max(0, Math.min(originalPos, this.original.length));
    const mapped = this.originalToCleanedOffsets[clamped];
    if (mapped === undefined) {
      return null;
    }
    return mapped;
  }

  /**
   * Strip template syntax while preserving line structure for accurate error reporting
   */
  private stripTemplateSyntax(source: string): {
    cleaned: string;
    mappings: Array<{ src: number; dst: number }>;
    originalToCleanedOffsets: number[];
  } {
    const mappings: Array<{ src: number; dst: number }> = [];
    const originalToCleanedOffsets = new Array<number>(source.length + 1);
    let cleaned = '';
    let dstPos = 0;
    let srcPos = 0;

    originalToCleanedOffsets[0] = 0;

    const templatePattern = new RegExp(this.templateBlockPattern.source, 'g');
    let lastIndex = 0;
    let match;

    while ((match = templatePattern.exec(source)) !== null) {
      // Add content before template block
      const beforeBlock = source.substring(lastIndex, match.index);
      cleaned += beforeBlock;
      for (let i = 0; i < beforeBlock.length; i++) {
        srcPos++;
        dstPos++;
        originalToCleanedOffsets[srcPos] = dstPos;
      }

      // Replace template block with whitespace (preserve line structure)
      const templateBlock = match[0];
      let placeholder = '';
      const firstNewline = templateBlock.indexOf('\n');
      for (let i = 0; i < templateBlock.length; i++) {
        const ch = templateBlock[i] ?? '';
        if (ch === '\n' || ch === '\r') {
          placeholder += ch;
        } else if (firstNewline === -1 || i < firstNewline) {
          placeholder += ' ';
        }
      }

      cleaned += placeholder;
      for (let i = 0; i < templateBlock.length; i++) {
        const ch = templateBlock[i];
        const isLineBreak = ch === '\n' || ch === '\r';
        const advance = firstNewline === -1 || i < firstNewline || isLineBreak ? 1 : 0;
        srcPos++;
        dstPos += advance;
        originalToCleanedOffsets[srcPos] = dstPos;
      }

      mappings.push({
        src: lastIndex,
        dst: dstPos - placeholder.length,
      });

      lastIndex = templatePattern.lastIndex;
    }

    // Add remaining content
    const remaining = source.substring(lastIndex);
    cleaned += remaining;
    for (let i = 0; i < remaining.length; i++) {
      srcPos++;
      dstPos++;
      originalToCleanedOffsets[srcPos] = dstPos;
    }

    return { cleaned, mappings, originalToCleanedOffsets };
  }

  /**
   * Create Volar-compatible position mappings
   */
  private createMappings(
    original: string,
    cleaned: string,
    originalToCleanedOffsets: number[]
  ): VirtualCode['mappings'] {
    if (original === cleaned) {
      // No changes needed, create identity mapping
      return [
        {
          sourceOffsets: [0],
          generatedOffsets: [0],
          lengths: [original.length],
          data: DEFAULT_CODE_INFORMATION,
        },
      ];
    }

    const mappings: VirtualCode['mappings'] = [];
    let runStart = -1;

    for (let src = 0; src < original.length; src++) {
      const current = originalToCleanedOffsets[src];
      const next = originalToCleanedOffsets[src + 1];
      const preserved =
        current !== undefined &&
        next !== undefined &&
        next === current + 1 &&
        current < cleaned.length;

      if (preserved) {
        if (runStart === -1) {
          runStart = src;
        }
        continue;
      }

      if (runStart !== -1) {
        const runLength = src - runStart;
        const generatedStart = originalToCleanedOffsets[runStart] ?? 0;
        if (runLength > 0) {
          mappings.push({
            sourceOffsets: [runStart],
            generatedOffsets: [generatedStart],
            lengths: [runLength],
            data: DEFAULT_CODE_INFORMATION,
          });
        }
        runStart = -1;
      }
    }

    if (runStart !== -1) {
      const runLength = original.length - runStart;
      const generatedStart = originalToCleanedOffsets[runStart] ?? 0;
      if (runLength > 0) {
        mappings.push({
          sourceOffsets: [runStart],
          generatedOffsets: [generatedStart],
          lengths: [runLength],
          data: DEFAULT_CODE_INFORMATION,
        });
      }
    }

    if (mappings.length === 0) {
      return [
        {
          sourceOffsets: [0],
          generatedOffsets: [0],
          lengths: [Math.min(original.length, cleaned.length)],
          data: DEFAULT_CODE_INFORMATION,
        },
      ];
    }

    return mappings;
  }
}

export const version = packageJson.version;

/**
 * Result of cleaning template syntax from a source file.
 */
export interface CleanedTemplateResult {
  /** Source text with all template blocks (`{{ }}`, `{%- %}`, etc.) replaced by whitespace */
  cleaned: string;
  /**
   * For each character offset in the source text, the corresponding offset in the cleaned text.
   * Length = source.length + 1 (includes end-of-file position).
   */
  originalToCleanedOffsets: number[];
}

export interface CleanTemplateOptions {
  mode?: 'preserve-width' | 'text-only';
  /**
   * Optional single-character override used when masking expression tokens (for example `{{ value }}`).
   * Defaults to a space in `preserve-width` mode and is optional in `text-only` mode.
   */
  expressionPaddingCharacter?: string;
}

function resolveExpressionPaddingCharacter(options?: CleanTemplateOptions): string {
  const candidate = options?.expressionPaddingCharacter;
  if (
    typeof candidate !== 'string' ||
    candidate.length !== 1 ||
    candidate === '\n' ||
    candidate === '\r'
  ) {
    return ' ';
  }

  return candidate;
}

function resolveOptionalExpressionPaddingCharacter(
  options?: CleanTemplateOptions
): string | undefined {
  const candidate = options?.expressionPaddingCharacter;
  if (
    typeof candidate !== 'string' ||
    candidate.length !== 1 ||
    candidate === '\n' ||
    candidate === '\r'
  ) {
    return undefined;
  }

  return candidate;
}

function toCoreDelimiterConfig(
  delimiters?: Partial<TemplateDelimiterConfig>
): CoreDelimiterConfig | undefined {
  if (!delimiters) {
    return undefined;
  }

  return {
    statement_start: delimiters.statementStart,
    statement_end: delimiters.statementEnd,
    expression_start: delimiters.expressionStart,
    expression_end: delimiters.expressionEnd,
    comment_start: delimiters.commentStart,
    comment_end: delimiters.commentEnd,
  };
}

function buildIdentityOffsets(length: number): number[] {
  const offsets = new Array<number>(length + 1);
  for (let i = 0; i <= length; i++) {
    offsets[i] = i;
  }
  return offsets;
}

function buildLineOffsets(text: string): number[] {
  const offsets = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') {
      offsets.push(i + 1);
    }
  }
  return offsets;
}

function positionToOffset(lineOffsets: number[], line: number, column: number): number {
  const lineStart = lineOffsets[Math.max(0, line - 1)] ?? 0;
  return lineStart + Math.max(0, column);
}

function cleanWithCoreTokenizer(
  source: string,
  delimiters?: Partial<TemplateDelimiterConfig>,
  expressionPaddingCharacter = ' '
): CleanedTemplateResult {
  const lineOffsets = buildLineOffsets(source);
  const chars = [...source];
  let tokens: Token[];
  try {
    tokens = tokenize(source, {
      delimiters: toCoreDelimiterConfig(delimiters),
      recoverUnclosedDelimiters: true,
    });
  } catch {
    // If tokenization fails, return source unchanged to avoid crashing callers
    // (e.g., VS Code virtual document providers). This graceful fallback ensures the
    // extension remains stable even with malformed template syntax.
    return {
      cleaned: source,
      originalToCleanedOffsets: buildIdentityOffsets(source.length),
    };
  }

  function maskAdjacentTrimWhitespace(
    start: number,
    end: number,
    trimLeft: boolean,
    trimRight: boolean
  ) {
    if (trimLeft) {
      for (let i = start - 1; i >= 0; i--) {
        if (!/[\t\n\r ]/.test(chars[i])) {
          break;
        }
        const ch = chars[i];
        if (ch !== '\n' && ch !== '\r') {
          chars[i] = ' ';
        }
      }
    }

    if (trimRight) {
      for (let i = end; i < chars.length; i++) {
        if (!/[\t\n\r ]/.test(chars[i])) {
          break;
        }
        const ch = chars[i];
        if (ch !== '\n' && ch !== '\r') {
          chars[i] = ' ';
        }
      }
    }
  }

  for (const token of tokens) {
    if (token.type === TokenType.TEXT) {
      continue;
    }

    const paddingCharacter = token.type === TokenType.EXPRESSION ? expressionPaddingCharacter : ' ';

    const start = positionToOffset(lineOffsets, token.start.line, token.start.column);
    const end = positionToOffset(lineOffsets, token.end.line, token.end.column);
    for (let i = start; i < end && i < chars.length; i++) {
      const ch = chars[i];
      if (ch !== '\n' && ch !== '\r') {
        chars[i] = paddingCharacter;
      }
    }

    maskAdjacentTrimWhitespace(start, end, !!token.trimLeft, !!token.trimRight);
  }

  return {
    cleaned: chars.join(''),
    originalToCleanedOffsets: buildIdentityOffsets(source.length),
  };
}

function cleanWithCoreTokenizerTextOnly(
  source: string,
  delimiters?: Partial<TemplateDelimiterConfig>,
  expressionPaddingCharacter?: string
): CleanedTemplateResult {
  const lineOffsets = buildLineOffsets(source);
  const includeChars = new Array<boolean>(source.length).fill(false);
  // Only the first char of each expression token is padded; the rest are silent.
  const expressionPaddingPositions = new Array<boolean>(source.length).fill(false);
  // Chars trimmed by -%} / {%- markers are suppressed entirely (including newlines).
  const suppressedChars = new Array<boolean>(source.length).fill(false);
  let tokens: Token[];
  try {
    tokens = tokenize(source, {
      delimiters: toCoreDelimiterConfig(delimiters),
      recoverUnclosedDelimiters: true,
    });
  } catch {
    // If tokenization fails, return source unchanged to avoid crashing callers.
    // This graceful fallback ensures the extension remains stable even with malformed
    // template syntax.
    return {
      cleaned: source,
      originalToCleanedOffsets: buildIdentityOffsets(source.length),
    };
  }

  for (const token of tokens) {
    const start = positionToOffset(lineOffsets, token.start.line, token.start.column);
    const end = positionToOffset(lineOffsets, token.end.line, token.end.column);
    if (token.type === TokenType.TEXT) {
      for (let i = start; i < end && i < includeChars.length; i++) {
        includeChars[i] = true;
      }
      continue;
    }

    // Suppress whitespace that a trim marker would consume in the rendered output.
    if (token.trimLeft) {
      for (let i = start - 1; i >= 0; i--) {
        if (!/[\t\n\r ]/.test(source[i] ?? '')) break;
        suppressedChars[i] = true;
      }
    }
    if (token.trimRight) {
      for (let i = end; i < source.length; i++) {
        if (!/[\t\n\r ]/.test(source[i] ?? '')) break;
        suppressedChars[i] = true;
      }
    }

    // Represent the whole expression with a single padding char so expression-only
    // lines are non-empty without producing false width-related diagnostics.
    if (
      token.type === TokenType.EXPRESSION &&
      expressionPaddingCharacter &&
      start < source.length
    ) {
      expressionPaddingPositions[start] = true;
    }
  }

  const originalToCleanedOffsets = new Array<number>(source.length + 1);
  originalToCleanedOffsets[0] = 0;

  let cleaned = '';
  let dstPos = 0;
  for (let srcPos = 0; srcPos < source.length; srcPos++) {
    const sourceChar = source[srcPos] ?? '';
    if (suppressedChars[srcPos]) {
      // consumed by trim marker — emit nothing
    } else if (includeChars[srcPos]) {
      cleaned += sourceChar;
      dstPos++;
    } else if (expressionPaddingPositions[srcPos]) {
      cleaned += expressionPaddingCharacter;
      dstPos++;
    } else if (sourceChar === '\n' || sourceChar === '\r') {
      cleaned += sourceChar;
      dstPos++;
    }
    originalToCleanedOffsets[srcPos + 1] = dstPos;
  }

  return {
    cleaned,
    originalToCleanedOffsets,
  };
}

/**
 * Strip template syntax from source text and return the cleaned content with offset mapping.
 *
 * This is the Extension Host-safe equivalent of `TempljsVirtualCode`'s internal stripping
 * logic, intended for use in virtual document content providers and similar client-side tools
 * that need cleaned content without the full Volar virtual code infrastructure.
 */
export function cleanTemplateContent(
  source: string,
  delimiters?: Partial<TemplateDelimiterConfig>,
  options?: CleanTemplateOptions
): CleanedTemplateResult {
  if (options?.mode === 'text-only') {
    return cleanWithCoreTokenizerTextOnly(
      source,
      delimiters,
      resolveOptionalExpressionPaddingCharacter(options)
    );
  }

  return cleanWithCoreTokenizer(source, delimiters, resolveExpressionPaddingCharacter(options));
}

class TempljsLanguagePlugin implements LanguagePlugin<URI> {
  private readonly virtualCodeByUri = new Map<string, TempljsVirtualCode>();
  private readonly patterns: CompiledDelimiterPatterns;

  constructor(options: TempljsLanguagePluginOptions = {}) {
    this.patterns = compileDelimiterPatterns(options.delimiters);
  }

  getLanguageId = (scriptId: URI): string | undefined => {
    const uri = scriptId.toString();
    if (/\.(templ|tmpl|tpl)\.(md|markdown)$/i.test(uri)) return 'templjs-markdown';
    if (/\.(templ|tmpl|tpl)\.(json)$/i.test(uri)) return 'templjs-json';
    if (/\.(templ|tmpl|tpl)\.(ya?ml)$/i.test(uri)) return 'templjs-yaml';
    if (/\.(templ|tmpl|tpl)\.(html?)$/i.test(uri)) return 'templjs-html';
    if (/\.ya?ml\.(templ|tmpl|tpl)($|\?)/i.test(uri)) return 'templjs-yaml';
    if (/\.json\.(templ|tmpl|tpl)($|\?)/i.test(uri)) return 'templjs-json';
    if (/\.(md|markdown)\.(templ|tmpl|tpl)($|\?)/i.test(uri)) return 'templjs-markdown';
    if (/\.html?\.(templ|tmpl|tpl)($|\?)/i.test(uri)) return 'templjs-html';
    if (/\.(templ|tmpl|tpl)($|\?)/i.test(uri)) return 'templjs-markdown';
    return undefined;
  };

  createVirtualCode = (
    scriptId: URI,
    _languageId: string,
    snapshot: ts.IScriptSnapshot,
    _ctx: CodegenContext<URI>
  ): VirtualCode => {
    const baseFormat = detectBaseFormat(scriptId.toString());
    const source = snapshot.getText(0, snapshot.getLength());
    const virtualCode = new TempljsVirtualCode(source, baseFormat, snapshot, this.patterns);
    this.virtualCodeByUri.set(scriptId.toString(), virtualCode);
    return virtualCode;
  };

  updateVirtualCode = (
    scriptId: URI,
    _virtualCode: TempljsVirtualCode,
    snapshot: ts.IScriptSnapshot,
    _ctx: CodegenContext<URI>
  ): TempljsVirtualCode => {
    const baseFormat = detectBaseFormat(scriptId.toString());
    const cachedVirtualCode = this.virtualCodeByUri.get(scriptId.toString()) ?? _virtualCode;

    if (!(cachedVirtualCode instanceof TempljsVirtualCode)) {
      const source = snapshot.getText(0, snapshot.getLength());
      const rebuilt = new TempljsVirtualCode(source, baseFormat, snapshot, this.patterns);
      this.virtualCodeByUri.set(scriptId.toString(), rebuilt);
      return rebuilt;
    }

    const changeRange = snapshot.getChangeRange(cachedVirtualCode.getSourceSnapshot());
    const updated = cachedVirtualCode.updateFromChange(
      snapshot,
      baseFormat,
      changeRange ?? undefined
    );
    this.virtualCodeByUri.set(scriptId.toString(), updated);
    return updated;
  };
}

/**
 * Create the templjs language plugin for Volar
 *
 * This plugin:
 * 1. Detects file format from extension
 * 2. Generates cleaned code without template syntax
 * 3. Delegates to base format language servers (markdown, JSON, etc.)
 * 4. Maintains position mappings for accurate error reporting
 */
export function createTempljsLanguagePlugin(
  options: TempljsLanguagePluginOptions = {}
): LanguagePlugin<URI> {
  return new TempljsLanguagePlugin(options);
}

export default {
  version,
  createTempljsLanguagePlugin,
};

export * from './schema-utils.js';
export * from './diagnostic-provider.js';
export * from './context-graph-adapter.js';
export * from './intellisense-provider.js';
export * from './service-plugin.js';
