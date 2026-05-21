import { describe, expect, it, vi } from 'vitest';
import {
  createRangeMapperFromOriginal,
  remapCompletionItem,
  remapCompletionResponse,
  remapDefinitionResponse,
  remapDiagnostic,
  remapDiagnosticsResponse,
  remapHover,
  remapHoverResponse,
  remapLocation,
  remapLocationLink,
  remapRange,
} from '../src/position-remapping-utility.ts';

describe('position-remapping-utility', () => {
  it('remaps ranges and repairs reversed end bounds when crossing suppressed spans', () => {
    const mapper = {
      cleanedRangeToOriginal: vi
        .fn()
        .mockReturnValueOnce({
          startLine: 0,
          startCol: 7,
          endLine: 0,
          endCol: 4,
        })
        .mockReturnValueOnce({
          startLine: 0,
          startCol: 8,
          endLine: 0,
          endCol: 8,
        }),
    } as never;

    const remapped = remapRange(mapper, {
      start: { line: 0, character: 1 },
      end: { line: 0, character: 3 },
    });

    expect(remapped).toEqual({
      start: { line: 0, character: 7 },
      end: { line: 0, character: 9 },
    });
  });

  it('keeps zero-length remapped ranges stable when mapper end falls before start', () => {
    const mapper = {
      cleanedRangeToOriginal: vi.fn(() => ({
        startLine: 2,
        startCol: 5,
        endLine: 1,
        endCol: 3,
      })),
    } as never;

    const remapped = remapRange(mapper, {
      start: { line: 2, character: 0 },
      end: { line: 2, character: 0 },
    });

    expect(remapped).toEqual({
      start: { line: 2, character: 5 },
      end: { line: 1, character: 3 },
    });
  });

  it('remaps diagnostics, hover, locations, and completion payload shapes', () => {
    const mapper = {
      cleanedRangeToOriginal: vi.fn(
        (startLine: number, startCol: number, endLine: number, endCol: number) => ({
          startLine,
          startCol: startCol + 10,
          endLine,
          endCol: endCol + 10,
        })
      ),
    } as never;

    const diagnostic = remapDiagnostic(mapper, {
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 2 },
      },
      message: 'boom',
      relatedInformation: [
        {
          location: {
            uri: 'file:///a',
            range: {
              start: { line: 1, character: 0 },
              end: { line: 1, character: 1 },
            },
          },
          message: 'related',
        },
      ],
    });
    expect(diagnostic.range.start.character).toBe(10);
    expect(diagnostic.relatedInformation?.[0]?.location.range.end.character).toBe(11);

    expect(remapDiagnosticsResponse(mapper, [diagnostic]).length).toBe(1);

    const hover = remapHover(mapper, {
      contents: 'h',
      range: {
        start: { line: 0, character: 1 },
        end: { line: 0, character: 2 },
      },
    });
    expect(hover.range?.start.character).toBe(11);
    expect(remapHover(mapper, { contents: 'h' })).toEqual({ contents: 'h' });
    expect(remapHoverResponse(mapper, hover).range?.end.character).toBe(22);

    const location = remapLocation(mapper, {
      uri: 'file:///b',
      range: {
        start: { line: 0, character: 1 },
        end: { line: 0, character: 2 },
      },
    });
    expect(location.range.start.character).toBe(11);

    const link = remapLocationLink(mapper, {
      targetUri: 'file:///c',
      targetRange: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 1 },
      },
      targetSelectionRange: {
        start: { line: 0, character: 1 },
        end: { line: 0, character: 2 },
      },
    });
    expect(link.originSelectionRange).toBeUndefined();
    expect(link.targetSelectionRange.end.character).toBe(12);

    const completionItem = remapCompletionItem(mapper, {
      label: 'x',
      additionalTextEdits: [
        {
          newText: 'y',
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 1 },
          },
        },
      ],
    });
    expect(completionItem.additionalTextEdits?.[0]?.range.start.character).toBe(10);
    expect(remapCompletionItem(mapper, { label: 'plain' })).toEqual({ label: 'plain' });

    const completionArray = remapCompletionResponse(mapper, [{ label: 'a' }]);
    expect(Array.isArray(completionArray)).toBe(true);

    const completionList = remapCompletionResponse(mapper, {
      isIncomplete: false,
      items: [{ label: 'b' }],
    });
    expect(Array.isArray(completionList)).toBe(false);
  });

  it('remaps definition responses across empty, location, and location-link arrays', () => {
    const mapper = {
      cleanedRangeToOriginal: vi.fn(
        (startLine: number, startCol: number, endLine: number, endCol: number) => ({
          startLine,
          startCol,
          endLine,
          endCol,
        })
      ),
    } as never;

    expect(remapDefinitionResponse(mapper, [])).toEqual([]);

    const locations = remapDefinitionResponse(mapper, [
      {
        uri: 'file:///loc',
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 1 },
        },
      },
    ]);
    expect(Array.isArray(locations)).toBe(true);
    expect((locations as Array<{ uri: string }>)[0]?.uri).toBe('file:///loc');

    const links = remapDefinitionResponse(mapper, [
      {
        targetUri: 'file:///target',
        targetRange: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 1 },
        },
        targetSelectionRange: {
          start: { line: 0, character: 1 },
          end: { line: 0, character: 2 },
        },
      },
    ]);
    expect((links as Array<{ targetUri: string }>)[0]?.targetUri).toBe('file:///target');
  });

  it('creates range mappers for both template-free and template-heavy content', () => {
    const identityMapper = createRangeMapperFromOriginal('plain text');
    const identityRemap = identityMapper.cleanedRangeToOriginal(0, 0, 0, 5);
    expect(identityRemap.startCol).toBeGreaterThanOrEqual(0);

    const templateMapper = createRangeMapperFromOriginal('alpha{% set x = 1 %}beta');
    const templateRemap = templateMapper.cleanedRangeToOriginal(0, 5, 0, 9);
    expect(templateRemap.startCol).toBeGreaterThanOrEqual(0);
    expect(templateRemap.endCol).toBeGreaterThanOrEqual(0);

    const emptyMapper = createRangeMapperFromOriginal('');
    const emptyRemap = emptyMapper.cleanedRangeToOriginal(0, 0, 0, 0);
    expect(emptyRemap).toEqual({ startLine: 0, startCol: 0, endLine: 0, endCol: 0 });
  });

  it('handles reversed zero-column ranges and remaps originSelectionRange links', () => {
    const fallbackMapper = {
      cleanedRangeToOriginal: vi
        .fn()
        .mockReturnValueOnce({ startLine: 0, startCol: 10, endLine: 0, endCol: 2 })
        .mockReturnValueOnce({ startLine: 0, startCol: 10, endLine: 0, endCol: 2 }),
    } as never;

    const reversed = remapRange(fallbackMapper, {
      start: { line: 0, character: 0 },
      end: { line: 1, character: 0 },
    });
    expect(reversed.end).toEqual(reversed.start);

    const mapper = {
      cleanedRangeToOriginal: vi.fn(
        (startLine: number, startCol: number, endLine: number, endCol: number) => ({
          startLine,
          startCol,
          endLine,
          endCol,
        })
      ),
    } as never;

    const link = remapLocationLink(mapper, {
      targetUri: 'file:///with-origin',
      originSelectionRange: {
        start: { line: 0, character: 1 },
        end: { line: 0, character: 2 },
      },
      targetRange: {
        start: { line: 0, character: 2 },
        end: { line: 0, character: 3 },
      },
      targetSelectionRange: {
        start: { line: 0, character: 3 },
        end: { line: 0, character: 4 },
      },
    });

    expect(link.originSelectionRange?.start.character).toBe(1);
  });

  it('skips remapping Location.range when uri does not match sourceUri', () => {
    const mapper = {
      cleanedRangeToOriginal: vi.fn(
        (startLine: number, startCol: number, endLine: number, endCol: number) => ({
          startLine,
          startCol: startCol + 10,
          endLine,
          endCol: endCol + 10,
        })
      ),
    } as never;

    const sourceUri = 'file:///source.templ';

    const locSame = remapLocation(
      mapper,
      {
        uri: sourceUri,
        range: { start: { line: 0, character: 1 }, end: { line: 0, character: 2 } },
      },
      sourceUri
    );
    expect(locSame.range.start.character).toBe(11);

    const locOther = remapLocation(
      mapper,
      {
        uri: 'file:///other.json',
        range: { start: { line: 0, character: 1 }, end: { line: 0, character: 2 } },
      },
      sourceUri
    );
    expect(locOther.range.start.character).toBe(1);
  });

  it('remaps only originSelectionRange for LocationLink when targetUri differs from sourceUri', () => {
    const mapper = {
      cleanedRangeToOriginal: vi.fn(
        (startLine: number, startCol: number, endLine: number, endCol: number) => ({
          startLine,
          startCol: startCol + 10,
          endLine,
          endCol: endCol + 10,
        })
      ),
    } as never;

    const sourceUri = 'file:///source.templ';

    const linkOtherTarget = remapLocationLink(
      mapper,
      {
        targetUri: 'file:///schema.json',
        originSelectionRange: { start: { line: 0, character: 1 }, end: { line: 0, character: 2 } },
        targetRange: { start: { line: 5, character: 0 }, end: { line: 5, character: 4 } },
        targetSelectionRange: { start: { line: 5, character: 1 }, end: { line: 5, character: 3 } },
      },
      sourceUri
    );
    expect(linkOtherTarget.originSelectionRange?.start.character).toBe(11);
    expect(linkOtherTarget.targetRange.start.character).toBe(0);
    expect(linkOtherTarget.targetSelectionRange.start.character).toBe(1);

    const linkSameTarget = remapLocationLink(
      mapper,
      {
        targetUri: sourceUri,
        targetRange: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
        targetSelectionRange: { start: { line: 0, character: 1 }, end: { line: 0, character: 2 } },
      },
      sourceUri
    );
    expect(linkSameTarget.targetRange.start.character).toBe(10);
    expect(linkSameTarget.targetSelectionRange.start.character).toBe(11);
  });

  it('passes sourceUri through remapDefinitionResponse for conditional remapping', () => {
    const mapper = {
      cleanedRangeToOriginal: vi.fn(
        (startLine: number, startCol: number, endLine: number, endCol: number) => ({
          startLine,
          startCol: startCol + 10,
          endLine,
          endCol: endCol + 10,
        })
      ),
    } as never;

    const sourceUri = 'file:///source.templ';

    const locations = remapDefinitionResponse(
      mapper,
      [
        {
          uri: sourceUri,
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
        },
        {
          uri: 'file:///other.json',
          range: { start: { line: 2, character: 5 }, end: { line: 2, character: 8 } },
        },
      ],
      sourceUri
    ) as Array<{ uri: string; range: { start: { character: number } } }>;
    expect(locations[0]?.range.start.character).toBe(10);
    expect(locations[1]?.range.start.character).toBe(5);

    const links = remapDefinitionResponse(
      mapper,
      [
        {
          targetUri: 'file:///schema.json',
          targetRange: { start: { line: 1, character: 2 }, end: { line: 1, character: 4 } },
          targetSelectionRange: {
            start: { line: 1, character: 2 },
            end: { line: 1, character: 4 },
          },
          originSelectionRange: {
            start: { line: 0, character: 3 },
            end: { line: 0, character: 5 },
          },
        },
        {
          targetUri: sourceUri,
          targetRange: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
          targetSelectionRange: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 1 },
          },
        },
      ],
      sourceUri
    ) as Array<{
      targetUri: string;
      targetRange: { start: { character: number } };
      originSelectionRange?: { start: { character: number } };
    }>;
    expect(links[0]?.targetRange.start.character).toBe(2);
    expect(links[0]?.originSelectionRange?.start.character).toBe(13);
    expect(links[1]?.targetRange.start.character).toBe(10);
  });
});
