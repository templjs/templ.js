/**
 * Position Remapping Utility
 *
 * Provides generic position remapping for all language service feature responses.
 * Remaps positions from cleaned (virtual) space back to original (source) space.
 */

type Position = { line: number; character: number };
type Range = { start: Position; end: Position };
type TextEdit = { range: Range; newText: string };
type DiagnosticRelatedInformation = {
  location: { uri: string; range: Range };
  message: string;
};
type Diagnostic = {
  range: Range;
  relatedInformation?: DiagnosticRelatedInformation[];
  [key: string]: unknown;
};
type Hover = { range?: Range; [key: string]: unknown };
type Location = { uri: string; range: Range };
type LocationLink = {
  originSelectionRange?: Range;
  targetUri: string;
  targetRange: Range;
  targetSelectionRange: Range;
};
type CompletionItem = {
  additionalTextEdits?: TextEdit[];
  [key: string]: unknown;
};
type CompletionList = { items: CompletionItem[]; [key: string]: unknown };
import { RangeMapper, cleanTemplateContent, type PositionMapping } from '@templjs/volar';
import { DEFAULT_DELIMITERS } from '@templjs/volar';
import type { TemplateDelimiters } from '@templjs/volar';

/**
 * Remaps a range from cleaned to original space
 */
export function remapRange(rangeMapper: RangeMapper, range: Range): Range {
  const mapped = rangeMapper.cleanedRangeToOriginal(
    range.start.line,
    range.start.character,
    range.end.line,
    range.end.character
  );
  const start = { line: mapped.startLine, character: mapped.startCol };
  let end = { line: mapped.endLine, character: mapped.endCol };

  // Some mapper backends treat range-end boundaries as next-segment starts,
  // which can move end before start for ranges that cross suppressed template regions.
  // Probe the last included character and rebuild an exclusive end when needed.
  const hasLength =
    range.start.line !== range.end.line || range.start.character !== range.end.character;
  const endBeforeStart =
    end.line < start.line || (end.line === start.line && end.character < start.character);
  if (hasLength && endBeforeStart) {
    if (range.end.character > 0) {
      const tail = rangeMapper.cleanedRangeToOriginal(
        range.end.line,
        range.end.character - 1,
        range.end.line,
        range.end.character - 1
      );
      end = {
        line: tail.startLine,
        character: tail.startCol + 1,
      };
    } else {
      end = start;
    }
  }

  return { start, end };
}

/**
 * Remaps diagnostic ranges and nested ranges
 */
export function remapDiagnostic(rangeMapper: RangeMapper, diagnostic: Diagnostic): Diagnostic {
  const remapped: Diagnostic = {
    ...diagnostic,
    range: remapRange(rangeMapper, diagnostic.range),
  };

  if (diagnostic.relatedInformation) {
    remapped.relatedInformation = diagnostic.relatedInformation.map(
      (info: DiagnosticRelatedInformation) => ({
        ...info,
        location: {
          uri: info.location.uri,
          range: remapRange(rangeMapper, info.location.range),
        },
      })
    );
  }

  return remapped;
}

/**
 * Remaps hover range if present
 */
export function remapHover(rangeMapper: RangeMapper, hover: Hover): Hover {
  if (!hover.range) {
    return hover;
  }

  return {
    ...hover,
    range: remapRange(rangeMapper, hover.range),
  };
}

/**
 * Remaps location range
 */
export function remapLocation(
  rangeMapper: RangeMapper,
  location: Location,
  sourceUri?: string
): Location {
  return {
    uri: location.uri,
    range:
      sourceUri === undefined || location.uri === sourceUri
        ? remapRange(rangeMapper, location.range)
        : location.range,
  };
}

/**
 * Remaps location link ranges
 */
export function remapLocationLink(
  rangeMapper: RangeMapper,
  link: LocationLink,
  sourceUri?: string
): LocationLink {
  return {
    originSelectionRange: link.originSelectionRange
      ? remapRange(rangeMapper, link.originSelectionRange)
      : undefined,
    targetUri: link.targetUri,
    targetRange:
      sourceUri === undefined || link.targetUri === sourceUri
        ? remapRange(rangeMapper, link.targetRange)
        : link.targetRange,
    targetSelectionRange:
      sourceUri === undefined || link.targetUri === sourceUri
        ? remapRange(rangeMapper, link.targetSelectionRange)
        : link.targetSelectionRange,
  };
}

/**
 * Remaps completion item ranges if present
 */
export function remapCompletionItem(
  rangeMapper: RangeMapper,
  item: CompletionItem
): CompletionItem {
  const remapped: CompletionItem = { ...item };

  if ('additionalTextEdits' in item && item.additionalTextEdits) {
    remapped.additionalTextEdits = item.additionalTextEdits.map((edit: TextEdit) => ({
      ...edit,
      range: remapRange(rangeMapper, edit.range),
    }));
  }

  return remapped;
}

export function remapDiagnosticsResponse(
  rangeMapper: RangeMapper,
  diagnostics: Diagnostic[]
): Diagnostic[] {
  return diagnostics.map((diagnostic) => remapDiagnostic(rangeMapper, diagnostic));
}

export function remapHoverResponse(rangeMapper: RangeMapper, hover: Hover): Hover {
  return remapHover(rangeMapper, hover);
}

export function remapDefinitionResponse(
  rangeMapper: RangeMapper,
  definition: Location[] | LocationLink[],
  sourceUri?: string
): Location[] | LocationLink[] {
  if (definition.length === 0) {
    return definition;
  }

  const first = definition[0];
  if (first && 'targetUri' in first) {
    return (definition as LocationLink[]).map((link) =>
      remapLocationLink(rangeMapper, link, sourceUri)
    );
  }

  return (definition as Location[]).map((location) =>
    remapLocation(rangeMapper, location, sourceUri)
  );
}

export function remapCompletionResponse(
  rangeMapper: RangeMapper,
  completion: CompletionList | CompletionItem[]
): CompletionList | CompletionItem[] {
  if (Array.isArray(completion)) {
    return completion.map((item) => remapCompletionItem(rangeMapper, item));
  }

  return {
    ...completion,
    items: completion.items.map((item: CompletionItem) => remapCompletionItem(rangeMapper, item)),
  };
}

/**
 * Creates a RangeMapper for remapping feature responses
 */
export function createRangeMapperFromOriginal(
  original: string,
  delimiters: TemplateDelimiters = DEFAULT_DELIMITERS
): RangeMapper {
  const { cleaned, originalToCleanedOffsets } = cleanTemplateContent(original, delimiters, {
    mode: 'text-only',
  });

  const mappings: PositionMapping[] = [];
  let runStart = -1;
  let runCleanedStart = -1;

  for (let sourceOffset = 0; sourceOffset < original.length; sourceOffset++) {
    const current = originalToCleanedOffsets[sourceOffset] ?? 0;
    const next = originalToCleanedOffsets[sourceOffset + 1] ?? current;
    const generatedDelta = next - current;

    if (generatedDelta > 0) {
      if (runStart === -1) {
        runStart = sourceOffset;
        runCleanedStart = current;
      }
      continue;
    }

    if (runStart !== -1) {
      mappings.push({
        originalOffset: runStart,
        cleanedOffset: runCleanedStart,
        length: current - runCleanedStart,
      });
      runStart = -1;
      runCleanedStart = -1;
    }
  }

  if (runStart !== -1) {
    const cleanedEnd = originalToCleanedOffsets[original.length] ?? cleaned.length;
    mappings.push({
      originalOffset: runStart,
      cleanedOffset: runCleanedStart,
      length: cleanedEnd - runCleanedStart,
    });
  }

  if (mappings.length === 0) {
    mappings.push({
      originalOffset: 0,
      cleanedOffset: 0,
      length: 0,
    });
  }

  return new RangeMapper(original, cleaned, mappings);
}

/**
 * Generic feature response remapper that handles diagnostics, hover, definitions, and completions
 */
