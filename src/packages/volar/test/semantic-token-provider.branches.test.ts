import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('SemanticTokenProvider branch coverage', () => {
  it('ignores parser filter refs whose names are not valid identifiers', async () => {
    vi.doMock('@templjs/core', async () => {
      const actual = await vi.importActual<typeof import('@templjs/core')>('@templjs/core');
      return {
        ...actual,
        extractExpressionFilterReferences: vi.fn(() => [
          {
            name: '-invalid-filter',
            start: 8,
            end: 23,
          },
        ]),
      };
    });

    const { extractSemanticTokens, SemanticTokenTypes } =
      await import('../src/semantic-token-provider.js');
    const tokens = extractSemanticTokens('{{ value | upper }}');
    const filterTokens = tokens.filter((token) => token.type === SemanticTokenTypes.Function);

    expect(filterTokens).toHaveLength(0);
  });
});
