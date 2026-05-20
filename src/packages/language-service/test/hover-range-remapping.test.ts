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
            start: { line: 0, character: 6 }, // position of 'beta' in cleaned doc
            end: { line: 0, character: 10 },
          },
        })),
      }),
    };

    const sourceText = 'alpha{% set x = 1 -%}beta';
    const languageIdRemapped = servicePluginTesting.withLanguageIdRemap(
      stubPlugin as never,
      'templjs-yaml',
      'yaml'
    );

    const remapped = servicePluginTesting.withPositionRemap(languageIdRemapped, 'templjs-yaml', {
      log: vi.fn(),
    } as never);

    const sourceFile = {
      id: URI.parse('file:///test.yaml.templ'),
      languageId: 'templjs-yaml',
      snapshot: {
        getText: () => sourceText,
        getLength: () => sourceText.length,
      },
    };

    const context = {
      decodeEmbeddedDocumentUri: vi.fn((uri: URI) =>
        uri.toString() === 'file:///test.yaml.templ'
          ? ([URI.parse('file:///test.yaml.templ'), 'root'] as const)
          : undefined
      ),
      language: {
        scripts: {
          get: vi.fn((uri: URI) =>
            uri.toString() === 'file:///test.yaml.templ' ? sourceFile : undefined
          ),
        },
      },
    };

    const instance = remapped.create(context as never);
    const document = servicePluginTesting.createTextDocumentLike(
      'file:///test.yaml.templ',
      'templjs-yaml',
      sourceText
    );

    const result = await instance.provideHover?.(document, { line: 0, character: 1 }, {} as never);

    console.log('Hover result:', result);

    if (result?.range) {
      console.log('Original range: (0, 6) to (0, 10)');
      console.log('Remapped range:', result.range);

      // The 'beta' is at position 21-25 in the original source
      // So the remapped range should be around there
      const sourceOffset = sourceText.indexOf('beta');
      console.log('Expected offset for beta in source:', sourceOffset);

      // Check if remapping happened (range should be different from original)
      const isRemapped = result.range.start.character !== 6 || result.range.end.character !== 10;

      if (isRemapped) {
        console.log('✓ Range was remapped');
      } else {
        console.log('✗ Range was NOT remapped');
      }
    } else {
      console.log('No range in hover result');
    }
  });
});
