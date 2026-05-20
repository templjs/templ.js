import { describe, expect, it, vi } from 'vitest';
import { URI } from 'vscode-uri';

import { servicePluginTesting } from '../src/index.ts';

function createContext(sourceText: string, sourceLanguageId = 'templjs-yaml') {
  const sourceFile = {
    id: URI.parse('file:///test.yaml.templ'),
    languageId: sourceLanguageId,
    snapshot: {
      getText: () => sourceText,
      getLength: () => sourceText.length,
    },
  };

  return {
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
}

function createMappedContext(sourceText: string, sourceLanguageId = 'templjs-yaml') {
  const sourceUri = URI.parse('file:///source.yaml.templ');
  const embeddedUri = 'embedded-content://yaml';
  const embeddedId = 'root';
  const sourceDoc = servicePluginTesting.createTextDocumentLike(
    sourceUri.toString(),
    sourceLanguageId,
    sourceText
  );
  const generatedDoc = servicePluginTesting.createTextDocumentLike(
    embeddedUri,
    sourceLanguageId,
    sourceText
  );

  return {
    decodeEmbeddedDocumentUri: vi.fn((uri: URI) =>
      uri.toString() === embeddedUri ? ([sourceUri, embeddedId] as const) : undefined
    ),
    language: {
      scripts: {
        get: vi.fn((uri: URI) =>
          uri.toString() === sourceUri.toString()
            ? {
                id: sourceUri,
                languageId: sourceLanguageId,
                snapshot: {
                  getText: () => sourceText,
                  getLength: () => sourceText.length,
                },
                generated: {
                  root: { id: embeddedId },
                },
              }
            : undefined
        ),
      },
      maps: {
        get: vi.fn(() => ({
          toSourceRange: (start: number, end: number) =>
            (function* () {
              const mappedStart = sourceDoc.offsetAt(generatedDoc.positionAt(start));
              const mappedEnd = sourceDoc.offsetAt(generatedDoc.positionAt(end));
              yield [mappedStart, mappedEnd] as const;
            })(),
        })),
      },
    },
  };
}

describe('service-plugins position-remap branches', () => {
  it('returns original instance when remap wrappers have no provider hooks', () => {
    const barePlugin = {
      name: 'bare-plugin',
      create: () => ({
        other: true,
      }),
    };

    const languageRemapped = servicePluginTesting.withLanguageIdRemap(
      barePlugin as never,
      'templjs-yaml',
      'yaml'
    );
    const positionRemapped = servicePluginTesting.withPositionRemap(
      barePlugin as never,
      'templjs-yaml',
      { log: vi.fn() } as never
    );

    expect(languageRemapped.create(createContext('plain') as never)).toEqual({ other: true });
    expect(positionRemapped.create(createContext('plain') as never)).toEqual({ other: true });
  });

  it('handles sync completion responses for truthy and falsy payloads', () => {
    const plugin = {
      name: 'sync-completion-plugin',
      create: () => ({
        provideCompletionItems: vi
          .fn()
          .mockReturnValueOnce(undefined)
          .mockReturnValueOnce({
            isIncomplete: false,
            items: [
              {
                label: 'item',
                additionalTextEdits: [
                  {
                    newText: 'x',
                    range: {
                      start: { line: 0, character: 0 },
                      end: { line: 0, character: 1 },
                    },
                  },
                ],
              },
            ],
          }),
      }),
    };

    const remapped = servicePluginTesting.withPositionRemap(plugin as never, 'templjs-yaml', {
      log: vi.fn(),
    } as never);
    const instance = remapped.create(createContext('alpha{% set x = 1 %}beta') as never);
    const document = servicePluginTesting.createTextDocumentLike(
      'file:///test.yaml.templ',
      'templjs-yaml',
      'alpha{% set x = 1 %}beta'
    );

    expect(
      instance.provideCompletionItems?.(
        document,
        { line: 0, character: 1 },
        { triggerKind: 1 } as never,
        {} as never
      )
    ).toBeUndefined();

    const response = instance.provideCompletionItems?.(
      document,
      { line: 0, character: 1 },
      { triggerKind: 1 } as never,
      {} as never
    ) as {
      items: Array<{ additionalTextEdits?: Array<{ range: { start: { character: number } } }> }>;
    };

    expect(
      response.items[0]?.additionalTextEdits?.[0]?.range.start.character
    ).toBeGreaterThanOrEqual(0);
  });

  it('handles sync hover branches and passthrough when source language does not match', () => {
    const provideHover = vi
      .fn()
      .mockReturnValue({
        contents: 'hover',
        range: {
          start: { line: 0, character: 1 },
          end: { line: 0, character: 4 },
        },
      })
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce({
        contents: 'hover',
        range: {
          start: { line: 0, character: 1 },
          end: { line: 0, character: 4 },
        },
      });

    const plugin = {
      name: 'sync-hover-plugin',
      create: () => ({
        provideHover,
      }),
    };

    const remapped = servicePluginTesting.withPositionRemap(plugin as never, 'templjs-yaml', {
      log: vi.fn(),
    } as never);

    const instance = remapped.create(createContext('alpha{% set x = 1 %}beta') as never);
    const document = servicePluginTesting.createTextDocumentLike(
      'file:///test.yaml.templ',
      'templjs-yaml',
      'alpha{% set x = 1 %}beta'
    );

    expect(
      instance.provideHover?.(document, { line: 0, character: 1 }, {} as never)
    ).toBeUndefined();

    const hover = instance.provideHover?.(document, { line: 0, character: 1 }, {} as never) as {
      range: { start: { character: number }; end: { character: number } };
    };
    expect(hover.range.end.character).toBeGreaterThanOrEqual(hover.range.start.character);

    const passthrough = remapped.create(createContext('plain text', 'yaml') as never);
    const plain = servicePluginTesting.createTextDocumentLike(
      'file:///test.yaml.templ',
      'yaml',
      'plain text'
    );
    const rawHover = passthrough.provideHover?.(plain, { line: 0, character: 0 }, {} as never) as {
      contents: string;
    };
    expect(rawHover.contents).toBe('hover');
  });

  it('handles definition remap branches for promise/sync and non-array payloads', async () => {
    const plugin = {
      name: 'definition-plugin',
      create: () => ({
        provideDefinition: vi
          .fn()
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce({ uri: 'file:///single' })
          .mockResolvedValueOnce([
            {
              targetUri: 'file:///target',
              targetRange: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 1 },
              },
              targetSelectionRange: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 1 },
              },
            },
          ])
          .mockReturnValueOnce(undefined)
          .mockReturnValueOnce({ uri: 'file:///single-sync' })
          .mockReturnValueOnce([
            {
              uri: 'file:///location',
              range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 1 },
              },
            },
          ]),
      }),
    };

    const remapped = servicePluginTesting.withPositionRemap(plugin as never, 'templjs-yaml', {
      log: vi.fn(),
    } as never);
    const instance = remapped.create(createContext('alpha{% set x = 1 %}beta') as never);
    const document = servicePluginTesting.createTextDocumentLike(
      'file:///test.yaml.templ',
      'templjs-yaml',
      'alpha{% set x = 1 %}beta'
    );

    await expect(
      instance.provideDefinition?.(document, { line: 0, character: 1 }, {} as never)
    ).resolves.toBeUndefined();
    await expect(
      instance.provideDefinition?.(document, { line: 0, character: 1 }, {} as never)
    ).resolves.toEqual({ uri: 'file:///single' });

    const promisedArray = await instance.provideDefinition?.(
      document,
      { line: 0, character: 1 },
      {} as never
    );
    expect(Array.isArray(promisedArray)).toBe(true);

    expect(
      instance.provideDefinition?.(document, { line: 0, character: 1 }, {} as never)
    ).toBeUndefined();
    expect(instance.provideDefinition?.(document, { line: 0, character: 1 }, {} as never)).toEqual({
      uri: 'file:///single-sync',
    });

    const syncArray = instance.provideDefinition?.(
      document,
      { line: 0, character: 1 },
      {} as never
    );
    expect(Array.isArray(syncArray)).toBe(true);
  });

  it('covers async remap branches for diagnostics, completion, hover, and definition', async () => {
    const plugin = {
      name: 'async-remap-plugin',
      create: () => ({
        provideDiagnostics: vi
          .fn()
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce([
            {
              range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 1 },
              },
              message: 'diag',
            },
          ])
          .mockReturnValueOnce(undefined),
        provideCompletionItems: vi
          .fn()
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce({
            isIncomplete: false,
            items: [{ label: 'async-item' }],
          })
          .mockReturnValueOnce(undefined),
        provideHover: vi
          .fn()
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce({
            contents: 'async-hover',
            range: {
              start: { line: 0, character: 1 },
              end: { line: 0, character: 3 },
            },
          })
          .mockReturnValueOnce(undefined),
        provideDefinition: vi
          .fn()
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce({ uri: 'file:///single-async' })
          .mockResolvedValueOnce([
            {
              uri: 'file:///loc-async',
              range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 1 },
              },
            },
          ])
          .mockReturnValueOnce(undefined)
          .mockReturnValueOnce({ uri: 'file:///single-sync-plain' })
          .mockReturnValueOnce([
            {
              targetUri: 'file:///target-sync',
              targetRange: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 1 },
              },
              targetSelectionRange: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 1 },
              },
            },
          ]),
      }),
    };

    const remapped = servicePluginTesting.withPositionRemap(plugin as never, 'templjs-yaml', {
      log: vi.fn(),
    } as never);

    const instance = remapped.create(createContext('alpha{% set x = 1 %}beta') as never);
    const document = servicePluginTesting.createTextDocumentLike(
      'file:///test.yaml.templ',
      'templjs-yaml',
      'alpha{% set x = 1 %}beta'
    );

    await expect(instance.provideDiagnostics?.(document, {} as never)).resolves.toBeUndefined();
    await expect(instance.provideDiagnostics?.(document, {} as never)).resolves.toHaveLength(1);
    expect(instance.provideDiagnostics?.(document, {} as never)).toBeUndefined();

    await expect(
      instance.provideCompletionItems?.(
        document,
        { line: 0, character: 0 },
        { triggerKind: 1 } as never,
        {} as never
      )
    ).resolves.toBeUndefined();
    await expect(
      instance.provideCompletionItems?.(
        document,
        { line: 0, character: 0 },
        { triggerKind: 1 } as never,
        {} as never
      )
    ).resolves.toMatchObject({ isIncomplete: false });
    expect(
      instance.provideCompletionItems?.(
        document,
        { line: 0, character: 0 },
        { triggerKind: 1 } as never,
        {} as never
      )
    ).toBeUndefined();

    await expect(
      instance.provideHover?.(document, { line: 0, character: 0 }, {} as never)
    ).resolves.toBeUndefined();
    await expect(
      instance.provideHover?.(document, { line: 0, character: 0 }, {} as never)
    ).resolves.toMatchObject({ contents: 'async-hover' });
    expect(
      instance.provideHover?.(document, { line: 0, character: 0 }, {} as never)
    ).toBeUndefined();

    await expect(
      instance.provideDefinition?.(document, { line: 0, character: 0 }, {} as never)
    ).resolves.toBeUndefined();
    await expect(
      instance.provideDefinition?.(document, { line: 0, character: 0 }, {} as never)
    ).resolves.toEqual({ uri: 'file:///single-async' });
    await expect(
      instance.provideDefinition?.(document, { line: 0, character: 0 }, {} as never)
    ).resolves.toSatisfy((value) => Array.isArray(value));

    expect(
      instance.provideDefinition?.(document, { line: 0, character: 0 }, {} as never)
    ).toBeUndefined();
    expect(instance.provideDefinition?.(document, { line: 0, character: 0 }, {} as never)).toEqual({
      uri: 'file:///single-sync-plain',
    });
    expect(
      instance.provideDefinition?.(document, { line: 0, character: 0 }, {} as never)
    ).toSatisfy((value) => Array.isArray(value));
  });

  it('executes async remap callback branches when range mapping comes from source maps', async () => {
    const plugin = {
      name: 'mapped-async-plugin',
      create: () => ({
        provideDiagnostics: vi.fn().mockResolvedValue([
          {
            message: 'd',
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
          },
        ]),
        provideCompletionItems: vi
          .fn()
          .mockResolvedValue({ isIncomplete: false, items: [{ label: 'a' }] }),
        provideHover: vi.fn().mockResolvedValue({
          contents: 'hover',
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
        }),
        provideDefinition: vi.fn().mockResolvedValue([
          {
            uri: 'file:///loc',
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
          },
        ]),
      }),
    };

    const remapped = servicePluginTesting.withPositionRemap(plugin as never, 'templjs-yaml', {
      log: vi.fn(),
    } as never);
    const instance = remapped.create(createMappedContext('alpha{% set x = 1 %}beta') as never);
    const document = servicePluginTesting.createTextDocumentLike(
      'embedded-content://yaml',
      'templjs-yaml',
      'alpha{% set x = 1 %}beta'
    );

    await expect(instance.provideDiagnostics?.(document, {} as never)).resolves.toHaveLength(1);
    await expect(
      instance.provideCompletionItems?.(
        document,
        { line: 0, character: 0 },
        { triggerKind: 1 } as never,
        {} as never
      )
    ).resolves.toMatchObject({ isIncomplete: false });
    await expect(
      instance.provideHover?.(document, { line: 0, character: 0 }, {} as never)
    ).resolves.toMatchObject({
      contents: 'hover',
    });
    await expect(
      instance.provideDefinition?.(document, { line: 0, character: 0 }, {} as never)
    ).resolves.toSatisfy((value) => Array.isArray(value));
  });

  it('covers async guard returns for falsy and non-array remap payloads', async () => {
    const plugin = {
      name: 'mapped-async-guards-plugin',
      create: () => ({
        provideDiagnostics: vi.fn().mockResolvedValue(undefined),
        provideCompletionItems: vi
          .fn()
          .mockResolvedValueOnce(undefined)
          .mockReturnValueOnce(undefined),
        provideHover: vi.fn().mockResolvedValue(undefined),
        provideDefinition: vi
          .fn()
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce({ uri: 'file:///single-async' }),
      }),
    };

    const remapped = servicePluginTesting.withPositionRemap(plugin as never, 'templjs-yaml', {
      log: vi.fn(),
    } as never);
    const instance = remapped.create(createMappedContext('alpha{% set x = 1 %}beta') as never);
    const document = servicePluginTesting.createTextDocumentLike(
      'embedded-content://yaml',
      'templjs-yaml',
      'alpha{% set x = 1 %}beta'
    );

    await expect(instance.provideDiagnostics?.(document, {} as never)).resolves.toBeUndefined();

    await expect(
      instance.provideCompletionItems?.(
        document,
        { line: 0, character: 0 },
        { triggerKind: 1 } as never,
        {} as never
      )
    ).resolves.toBeUndefined();
    expect(
      instance.provideCompletionItems?.(
        document,
        { line: 0, character: 0 },
        { triggerKind: 1 } as never,
        {} as never
      )
    ).toBeUndefined();

    await expect(
      instance.provideHover?.(document, { line: 0, character: 0 }, {} as never)
    ).resolves.toBeUndefined();

    await expect(
      instance.provideDefinition?.(document, { line: 0, character: 0 }, {} as never)
    ).resolves.toBeUndefined();
    await expect(
      instance.provideDefinition?.(document, { line: 0, character: 0 }, {} as never)
    ).resolves.toEqual({ uri: 'file:///single-async' });
  });

  it('covers sync diagnostics/completion remap branches with mapped contexts', () => {
    const plugin = {
      name: 'mapped-sync-branches-plugin',
      create: () => ({
        provideDiagnostics: vi
          .fn()
          .mockReturnValueOnce(undefined)
          .mockReturnValueOnce([
            {
              message: 'diag',
              range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 1 },
              },
            },
          ]),
        provideCompletionItems: vi
          .fn()
          .mockReturnValueOnce(undefined)
          .mockReturnValueOnce({
            isIncomplete: false,
            items: [{ label: 'sync' }],
          }),
      }),
    };

    const remapped = servicePluginTesting.withPositionRemap(plugin as never, 'templjs-yaml', {
      log: vi.fn(),
    } as never);
    const instance = remapped.create(createMappedContext('alpha{% set x = 1 %}beta') as never);
    const document = servicePluginTesting.createTextDocumentLike(
      'embedded-content://yaml',
      'templjs-yaml',
      'alpha{% set x = 1 %}beta'
    );

    expect(instance.provideDiagnostics?.(document, {} as never)).toBeUndefined();
    expect(instance.provideDiagnostics?.(document, {} as never)).toHaveLength(1);

    expect(
      instance.provideCompletionItems?.(
        document,
        { line: 0, character: 0 },
        { triggerKind: 1 } as never,
        {} as never
      )
    ).toBeUndefined();
    expect(
      instance.provideCompletionItems?.(
        document,
        { line: 0, character: 0 },
        { triggerKind: 1 } as never,
        {} as never
      )
    ).toMatchObject({ isIncomplete: false });
  });
});
