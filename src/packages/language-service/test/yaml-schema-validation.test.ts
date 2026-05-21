import { describe, it, expect, vi } from 'vitest';
import { URI } from 'vscode-uri';

describe('YAML schema validation for unknown properties', () => {
  it('reports diagnostic for unknown property when schema is specified', async () => {
    const { servicePluginTesting } = await import('../src/index.ts');

    // YAML with schema directive and invalid property
    const sourceText = `# yaml-language-server: $schema=./test.schema.json
title: test
id: invalid
`;

    // Create a mock YAML adapter that returns diagnostics
    const stubPlugin = {
      name: 'test-yaml-diagnostics',
      create: () => ({
        provideDiagnostics: vi.fn(async () => [
          {
            range: {
              start: { line: 2, character: 0 },
              end: { line: 2, character: 2 },
            },
            severity: 1, // Error
            message: 'id is not a valid property',
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

    const diagnostics = await instance.provideDiagnostics?.(document, {} as never);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics?.[0]).toMatchObject({
      message: 'id is not a valid property',
      severity: 1,
      range: {
        start: { line: 2, character: 0 },
        end: { line: 2, character: 2 },
      },
    });
  });
});
