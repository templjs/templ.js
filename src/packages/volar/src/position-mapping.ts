/**
 * Position Mapping Utilities for Virtual Code
 *
 * Maps positions between original (with template syntax) and cleaned (base format only)
 * code. Handles line/column coordinate conversions and roundtrip accuracy.
 */

/**
 * Represents a single position mapping between original and cleaned code
 */
export interface PositionMapping {
  /** Offset in original code (bytes) */
  originalOffset: number;
  /** Offset in cleaned code (bytes) */
  cleanedOffset: number;
  /** Length of this mapping segment */
  length: number;
}

/**
 * Bidirectional position mapper
 */
export class PositionMapper {
  private mappings: PositionMapping[] = [];
  private originalToCleanedCache = new Map<number, number>();
  private cleanedToOriginalCache = new Map<number, number>();

  constructor(mappings: PositionMapping[]) {
    this.mappings = mappings.sort((a, b) => a.originalOffset - b.originalOffset);
  }

  /**
   * Convert position from original code to cleaned code
   */
  originalToCleaned(originalOffset: number): number {
    const cached = this.originalToCleanedCache.get(originalOffset);
    if (cached !== undefined) return cached;

    let cleanedOffset = 0;
    for (const mapping of this.mappings) {
      if (mapping.originalOffset > originalOffset) break;
      if (
        originalOffset >= mapping.originalOffset &&
        originalOffset < mapping.originalOffset + mapping.length
      ) {
        cleanedOffset += originalOffset - mapping.originalOffset;
        this.originalToCleanedCache.set(originalOffset, cleanedOffset);
        return cleanedOffset;
      }
      cleanedOffset += mapping.length;
    }
    return cleanedOffset;
  }

  /**
   * Convert position from cleaned code to original code
   */
  cleanedToOriginal(cleanedOffset: number): number {
    const cached = this.cleanedToOriginalCache.get(cleanedOffset);
    if (cached !== undefined) return cached;

    let cleanedPos = 0;
    for (const mapping of this.mappings) {
      const mappingLength = mapping.length;
      if (cleanedPos + mappingLength > cleanedOffset) {
        const originalOffset = mapping.originalOffset + (cleanedOffset - cleanedPos);
        this.cleanedToOriginalCache.set(cleanedOffset, originalOffset);
        return originalOffset;
      }
      cleanedPos += mappingLength;
    }
    return cleanedOffset;
  }
}

/**
 * Line and column position tracker
 */
export class LineColumnMapper {
  private lineOffsets: number[] = [0]; // Start of each line

  constructor(code: string) {
    for (let i = 0; i < code.length; i++) {
      if (code[i] === '\n') {
        this.lineOffsets.push(i + 1);
      }
    }
  }

  /**
   * Convert byte offset to (line, column)
   */
  offsetToLineCol(offset: number): { line: number; column: number } {
    let line = 0;
    for (let i = 0; i < this.lineOffsets.length; i++) {
      if (this.lineOffsets[i] > offset) break;
      line = i;
    }
    const column = offset - this.lineOffsets[line];
    return { line, column };
  }

  /**
   * Convert (line, column) to byte offset
   */
  lineColToOffset(line: number, column: number): number {
    if (line >= this.lineOffsets.length) {
      return this.lineOffsets[this.lineOffsets.length - 1];
    }
    return this.lineOffsets[line] + column;
  }

  /**
   * Get total number of lines
   */
  getLineCount(): number {
    return this.lineOffsets.length;
  }
}

/**
 * Range mapping between original and cleaned code
 */
export interface RangeMapping {
  original: { start: number; end: number };
  cleaned: { start: number; end: number };
}

/**
 * Bidirectional range mapper
 */
export class RangeMapper {
  private originalMapper: LineColumnMapper;
  private cleanedMapper: LineColumnMapper;
  private positionMapper: PositionMapper;

  constructor(original: string, cleaned: string, mappings: PositionMapping[]) {
    this.originalMapper = new LineColumnMapper(original);
    this.cleanedMapper = new LineColumnMapper(cleaned);
    this.positionMapper = new PositionMapper(mappings);
  }

  /**
   * Map a range from original code to cleaned code
   */
  originalRangeToCleaned(
    startLine: number,
    startCol: number,
    endLine: number,
    endCol: number
  ): { startLine: number; startCol: number; endLine: number; endCol: number } {
    const startOffset = this.originalMapper.lineColToOffset(startLine, startCol);
    const endOffset = this.originalMapper.lineColToOffset(endLine, endCol);

    const cleanedStartOffset = this.positionMapper.originalToCleaned(startOffset);
    const cleanedEndOffset = this.positionMapper.originalToCleaned(endOffset);

    const cleanedStart = this.cleanedMapper.offsetToLineCol(cleanedStartOffset);
    const cleanedEnd = this.cleanedMapper.offsetToLineCol(cleanedEndOffset);

    return {
      startLine: cleanedStart.line,
      startCol: cleanedStart.column,
      endLine: cleanedEnd.line,
      endCol: cleanedEnd.column,
    };
  }

  /**
   * Map a range from cleaned code to original code
   */
  cleanedRangeToOriginal(
    startLine: number,
    startCol: number,
    endLine: number,
    endCol: number
  ): { startLine: number; startCol: number; endLine: number; endCol: number } {
    const startOffset = this.cleanedMapper.lineColToOffset(startLine, startCol);
    const endOffset = this.cleanedMapper.lineColToOffset(endLine, endCol);

    const originalStartOffset = this.positionMapper.cleanedToOriginal(startOffset);
    const originalEndOffset = this.positionMapper.cleanedToOriginal(endOffset);

    const originalStart = this.originalMapper.offsetToLineCol(originalStartOffset);
    const originalEnd = this.originalMapper.offsetToLineCol(originalEndOffset);

    return {
      startLine: originalStart.line,
      startCol: originalStart.column,
      endLine: originalEnd.line,
      endCol: originalEnd.column,
    };
  }
}

/**
 * Generate position mappings by tracking template syntax removal
 * Replaces all template directives with whitespace to preserve line count
 */
export function generatePositionMappings(
  original: string,
  templateRegex: RegExp
): { cleaned: string; mappings: PositionMapping[] } {
  const mappings: PositionMapping[] = [];
  let cleaned = '';
  let lastIndex = 0;

  let execResult;
  const regexWithGlobal = new RegExp(templateRegex.source, 'g');

  while ((execResult = regexWithGlobal.exec(original))) {
    const matchStart = execResult.index;
    const preMatch = original.slice(lastIndex, matchStart);

    if (preMatch.length > 0) {
      mappings.push({
        originalOffset: lastIndex,
        cleanedOffset: cleaned.length,
        length: preMatch.length,
      });
    }
    cleaned += preMatch;

    // Add mapping for the template block itself
    // This ensures positions within template spaces map back to the template start
    const directive = execResult[0];
    const whitespace = directive.replace(/[^\n]/g, ' ');
    mappings.push({
      originalOffset: matchStart,
      cleanedOffset: cleaned.length,
      length: whitespace.length,
    });
    cleaned += whitespace;
    lastIndex = execResult.index + directive.length;
  }

  // Add final segment
  if (lastIndex < original.length) {
    const finalSegment = original.slice(lastIndex);
    mappings.push({
      originalOffset: lastIndex,
      cleanedOffset: cleaned.length,
      length: finalSegment.length,
    });
    cleaned += finalSegment;
  } else if (lastIndex === original.length && mappings.length === 0) {
    // Handle case where entire text is templates
    mappings.push({
      originalOffset: 0,
      cleanedOffset: 0,
      length: 0,
    });
  }

  return { cleaned, mappings };
}
