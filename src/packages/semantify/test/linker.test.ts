import { describe, expect, it } from 'vitest';
import { linkReferences, type SymbolRef } from '../src/index.js';

describe('linkReferences', () => {
  it('returns symbols unchanged', () => {
    const symbols: SymbolRef[] = [
      {
        kind: 'localBinding',
        rawPath: 'item',
        range: {
          startOffset: 4,
          endOffset: 8,
        },
      },
    ];

    expect(linkReferences({ symbols })).toEqual({ symbols });
  });
});
