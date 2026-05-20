import { describe, it, expect, vi } from 'vitest';
import { URI } from 'vscode-uri';

describe('member access range remapping', () => {
  it('handles member access expressions with proper range boundaries', async () => {
    const { servicePluginTesting } = await import('../src/index.ts');
    const sourceUri = URI.parse('file:///test.yaml.templ');
    const embeddedUri = 'embedded-content://yaml';

    // YAML with template expression containing member access
    const sourceText = 'alpha{% set x = 1 %}item.name';

    // Create a mock YAML adapter that returns definition with origin selection range
    const stubPlugin = {
      name: 'test-yaml-definition',
      create: () => ({
        provideDefinition: vi.fn(async () => ({
          targetUri: 'file:///schema.json',
          targetRange: {
            start: { line: 0, character: 0 },
            end: { line: 1, character: 0 },
          },
          targetSelectionRange: {
            start: { line: 0, character: 5 },
            end: { line: 0, character: 10 },
          },
          originSelectionRange: {
            start: { line: 0, character: 5 },
            end: { line: 0, character: 12 },
          },
        })),
      }),
    };

    const remapped = servicePluginTesting.withPositionRemap(stubPlugin as never, 'templjs-yaml', {
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

    const result = await instance.provideDefinition?.(
      document,
      { line: 0, character: 7 }, // Position of "item.name"
      {} as never
    );

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(false);
    expect(result).toMatchObject({
      targetUri: 'file:///schema.json',
      originSelectionRange: {
        start: { line: 0, character: 20 },
        end: { line: 0, character: 27 },
      },
    });
  });
});
