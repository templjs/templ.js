import { describe, it, expect, vi } from 'vitest';
import { URI } from 'vscode-uri';

describe('hover range remapping', () => {
  it('remaps hover range for yaml adapter', async () => {
    const { servicePluginTesting } = await import('../src/index.ts');

    // Create a YAML adapter that returns a hover with a range
    const stubPlugin = {
      name: 'test-yaml-hover',
      create: () => ({
        provideHover: vi.fn(async () => ({
          contents: 'test hover',
          range: {
            start: { line: 0, character: 5 }, // position of 'beta' in cleaned doc
            end: { line: 0, character: 9 },
          },
        })),
      }),
    };

    const sourceText = 'alpha{% set x = 1 -%}beta';
    const sourceUri = URI.parse('file:///test.yaml.templ');
    const embeddedUri = 'embedded-content://yaml';
    const languageIdRemapped = servicePluginTesting.withLanguageIdRemap(
      stubPlugin as never,
      'templjs-yaml',
      'yaml'
    );

    const remapped = servicePluginTesting.withPositionRemap(languageIdRemapped, 'templjs-yaml', {
      log: vi.fn(),
    } as never);

    const sourceFile = {
      id: sourceUri,
      languageId: 'templjs-yaml',
      snapshot: {
        getText: () => sourceText,
        getLength: () => sourceText.length,
      },
    };

    const context = {
      decodeEmbeddedDocumentUri: vi.fn((uri: URI) =>
        uri.toString() === embeddedUri ? ([sourceUri, 'root'] as const) : undefined
      ),
      language: {
        scripts: {
          get: vi.fn((uri: URI) =>
            uri.toString() === sourceUri.toString() ? sourceFile : undefined
          ),
        },
      },
    };

    const instance = remapped.create(context as never);
    const document = servicePluginTesting.createTextDocumentLike(
      embeddedUri,
      'templjs-yaml',
      sourceText
    );

    const result = await instance.provideHover?.(document, { line: 0, character: 1 }, {} as never);
    const sourceOffset = sourceText.indexOf('beta');

    expect(result).toBeDefined();
    expect(result?.range).toEqual({
      start: { line: 0, character: sourceOffset },
      end: { line: 0, character: sourceOffset + 4 },
    });
  });
});
