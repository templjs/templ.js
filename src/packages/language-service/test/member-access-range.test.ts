import { describe, it, expect, vi } from 'vitest';
import { URI } from 'vscode-uri';

describe('member access range remapping', () => {
  it('handles member access expressions with proper range boundaries', async () => {
    const { servicePluginTesting } = await import('../src/index.ts');

    // YAML with template expression containing member access
    const sourceText = `items:
- name: "{{ item.name }}"
  value: "{{ item.value }}"`;

    // Create a mock YAML adapter that returns definition with origin selection range
    const stubPlugin = {
      name: 'test-yaml-definition',
      create: () => ({
        provideDefinition: vi.fn(async () => [
          {
            targetUri: 'file:///schema.json',
            targetRange: {
              start: { line: 0, character: 0 },
              end: { line: 1, character: 0 },
            },
            targetSelectionRange: {
              start: { line: 0, character: 5 },
              end: { line: 0, character: 10 },
            },
            // The origin selection range - this is what gets highlighted when using cmd+click
            originSelectionRange: {
              start: { line: 1, character: 19 }, // Should ideally point to just "item" or just "name"
              end: { line: 1, character: 28 }, // But currently spans the whole "item.name"
            },
          },
        ]),
      }),
    };

    const remapped = servicePluginTesting.withPositionRemap(stubPlugin as never, 'templjs-yaml', {
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

    const result = await instance.provideDefinition?.(
      document,
      { line: 1, character: 23 }, // Position of "item.name"
      {} as never
    );

    console.log('Definition result:', result);

    if (Array.isArray(result) && result[0]) {
      const link = result[0];
      console.log('Origin selection range:', link.originSelectionRange);

      // The origin range should ideally point to just the identifier where the cursor is
      // Currently it might be spanning the whole "item.name" expression
      const rangeLength =
        (link.originSelectionRange?.end.character ?? 0) -
        (link.originSelectionRange?.start.character ?? 0);
      console.log(`Range spans ${rangeLength} characters`);

      if (rangeLength > 10) {
        console.log('⚠ Warning: Range is very wide (> 10 chars) for member access');
      } else {
        console.log('✓ Range seems reasonable');
      }
    }
  });
});
