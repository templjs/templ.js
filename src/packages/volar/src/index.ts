/**
 * @templjs/volar - Volar language server plugin for templjs
 *
 * This package provides Volar integration for IDE support including:
 * - Syntax highlighting
 * - Diagnostics and error reporting
 * - IntelliSense and autocompletion
 * - Virtual code mapping for base format delegation
 */

import type { CodeInformation, LanguagePlugin, VirtualCode } from '@volar/language-core';
import type * as ts from 'typescript';
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

const TEMPLATE_MARKERS = ['.templ.', '.tmpl.'] as const;

interface CompiledDelimiterPatterns {
  delimiters: TemplateDelimiterConfig;
  delimiterPairPattern: RegExp;
  templateBlockPattern: RegExp;
}

export interface TempljsLanguagePluginOptions {
  delimiters?: Partial<TemplateDelimiterConfig>;
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
 * Detect base format from file extension
 */
function detectBaseFormat(fileUriString: string): BaseFormat {
  try {
    // Extract filename from URI (handle both file:// and regular paths)
    const filePath = fileUriString.replace(/^file:\/\//, '').replace(/^.*\//, '');

    for (const marker of TEMPLATE_MARKERS) {
      if (!filePath.includes(marker)) continue;
      const ext = '.' + filePath.split(marker)[1];
      const format = EXTENSION_TO_BASE_FORMAT[ext];
      if (format) return format;
    }

    if (filePath.endsWith('.tmpl') || filePath.endsWith('.templ')) {
      const suffixLength = filePath.endsWith('.tmpl') ? 5 : 6;
      const baseName = filePath.slice(0, -suffixLength);
      const lastDot = baseName.lastIndexOf('.');
      if (lastDot > -1) {
        const ext = baseName.slice(lastDot);
        const format = EXTENSION_TO_BASE_FORMAT[ext];
        if (format) return format;
      }
    }
  } catch {
    // Fallback to plain text
  }

  return 'plain';
}

/**
 * Virtual code representation with stripped template syntax
 */
class TempljsVirtualCode implements VirtualCode {
  id = 'root';
  languageId: string;
  snapshot: ts.IScriptSnapshot;
  private baseFormat: BaseFormat;
  private original: string;
  private cleaned: string;
  private readonly delimiterPairPattern: RegExp;
  private readonly templateBlockPattern: RegExp;
  private originalToCleanedOffsets: number[] = [0];
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
    this.snapshot = snapshot;
    this.original = original;
    this.delimiterPairPattern = patterns.delimiterPairPattern;
    this.templateBlockPattern = patterns.templateBlockPattern;

    // Generate cleaned code (strip template syntax)
    const { cleaned, originalToCleanedOffsets } = this.stripTemplateSyntax(original);
    this.cleaned = cleaned;
    this.originalToCleanedOffsets = originalToCleanedOffsets;

    // Create position mappings for accurate error reporting
    this.mappings = this.createMappings(original, cleaned, originalToCleanedOffsets);
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

    if (!this.applyEdit(start, oldLength, insertedText)) {
      this.rebuildFromSnapshot(snapshot, baseFormat);
      return this;
    }

    this.snapshot = snapshot;

    // Regenerate accurate cleaned text + position mappings after the edit
    const { cleaned, originalToCleanedOffsets } = this.stripTemplateSyntax(this.original);
    this.cleaned = cleaned;
    this.originalToCleanedOffsets = originalToCleanedOffsets;
    this.mappings = this.createMappings(this.original, this.cleaned, originalToCleanedOffsets);

    return this;
  }

  private rebuildFromSnapshot(snapshot: ts.IScriptSnapshot, baseFormat: BaseFormat): void {
    const source = snapshot.getText(0, snapshot.getLength());
    const { cleaned, originalToCleanedOffsets } = this.stripTemplateSyntax(source);

    this.baseFormat = baseFormat;
    this.languageId = getBaseFormatLanguageId(baseFormat);
    this.snapshot = snapshot;
    this.original = source;
    this.cleaned = cleaned;
    this.originalToCleanedOffsets = originalToCleanedOffsets;
    this.mappings = this.createMappings(source, cleaned, originalToCleanedOffsets);
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

      return true;
    }

    // Template markers detected: use bounded window reprocessing
    return this.applyBoundedEdit(start, deleteLength, insertedText);
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
      const placeholder = templateBlock
        .split('\n')
        .map((line, idx) => (idx === 0 ? ' '.repeat(line.length) : '\n'))
        .join('');

      cleaned += placeholder;
      const firstNewline = templateBlock.indexOf('\n');
      for (let i = 0; i < templateBlock.length; i++) {
        const ch = templateBlock[i];
        const advance = firstNewline === -1 || i < firstNewline ? 1 : ch === '\n' ? 1 : 0;
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

export const version = '0.1.0';

class TempljsLanguagePlugin implements LanguagePlugin {
  private readonly virtualCodeByUri = new Map<string, TempljsVirtualCode>();
  private readonly patterns: CompiledDelimiterPatterns;

  constructor(options: TempljsLanguagePluginOptions = {}) {
    this.patterns = compileDelimiterPatterns(options.delimiters);
  }

  createVirtualCode(uri: string, _languageId: string, snapshot: ts.IScriptSnapshot): VirtualCode {
    const baseFormat = detectBaseFormat(uri);
    const source = snapshot.getText(0, snapshot.getLength());
    const virtualCode = new TempljsVirtualCode(source, baseFormat, snapshot, this.patterns);
    this.virtualCodeByUri.set(uri, virtualCode);
    return virtualCode;
  }

  updateVirtualCode(
    uri: string,
    _virtualCode: TempljsVirtualCode,
    snapshot: ts.IScriptSnapshot
  ): TempljsVirtualCode {
    const baseFormat = detectBaseFormat(uri);
    const cachedVirtualCode = this.virtualCodeByUri.get(uri) ?? _virtualCode;

    if (!(cachedVirtualCode instanceof TempljsVirtualCode)) {
      const source = snapshot.getText(0, snapshot.getLength());
      const rebuilt = new TempljsVirtualCode(source, baseFormat, snapshot, this.patterns);
      this.virtualCodeByUri.set(uri, rebuilt);
      return rebuilt;
    }

    const changeRange = snapshot.getChangeRange(cachedVirtualCode.snapshot);
    const updated = cachedVirtualCode.updateFromChange(
      snapshot,
      baseFormat,
      changeRange ?? undefined
    );
    this.virtualCodeByUri.set(uri, updated);
    return updated;
  }
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
): LanguagePlugin {
  return new TempljsLanguagePlugin(options);
}

export default {
  version,
  createTempljsLanguagePlugin,
};

export * from './diagnostic-provider.js';
export * from './intellisense-provider.js';
