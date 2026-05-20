import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

vi.mock('../../../extensions/vscode/src/service-plugins', async () => {
  const actual = await import('../src/index.ts');
  return {
    createServicePlugins: actual.createTempljsServicePlugins,
    servicePluginTesting: actual.servicePluginTesting,
  };
});

import { URI } from 'vscode-uri';
import { cleanTemplateContent } from '@templjs/volar';

const extensionServicePluginsTestUrl = new URL(
  '../../../extensions/vscode/test/service-plugins.test.ts',
  import.meta.url
).href;

await import(extensionServicePluginsTestUrl);

function withVolar24Context<T extends Record<string, any>>(context: T): T {
  const getVirtualCodeByUri = context.documents?.getVirtualCodeByUri as
    | ((uri: string) => readonly [any?, any?])
    | undefined;
  const getLegacyFile = context.language?.files?.get as ((uri: string) => any) | undefined;

  const toSourceScript = (entry: any) => {
    if (!entry) {
      return undefined;
    }

    return {
      ...entry,
      id: typeof entry.id === 'string' ? URI.parse(entry.id) : entry.id,
    };
  };

  return {
    ...context,
    decodeEmbeddedDocumentUri:
      context.decodeEmbeddedDocumentUri ??
      vi.fn((uri: URI) => {
        const [virtualCode, sourceFile] = getVirtualCodeByUri?.(uri.toString()) ?? [];
        return virtualCode?.id && sourceFile?.id
          ? ([URI.parse(String(sourceFile.id)), String(virtualCode.id)] as const)
          : undefined;
      }),
    language: {
      ...context.language,
      scripts: context.language?.scripts ?? {
        get: vi.fn((uri: URI) => {
          const uriString = uri.toString();
          const [, sourceFile] = getVirtualCodeByUri?.(uriString) ?? [];
          return toSourceScript(sourceFile ?? getLegacyFile?.(uriString));
        }),
      },
    },
  };
}

describe('language-service service-plugins coverage branches', () => {
  it('exposes schemaLoading through index facade', async () => {
    const languageService = await import('../src/index.ts');
    expect(languageService.schemaLoading).toBeDefined();
    expect(typeof languageService.schemaLoading.loadSchemaSource).toBe('function');
  });

  it('covers adapter registry exports and runtime resolution branches', async () => {
    const languageService = await import('../src/index.ts');

    expect(languageService.getSupportedFormattingHostLanguages()).toEqual([
      'markdown',
      'json',
      'yaml',
      'html',
    ]);
    expect(languageService.getFormattingExtensionIds()).toEqual(['esbenp.prettier-vscode']);
    expect(languageService.getFormattingLanguageConfigurationKeys()).toEqual([
      '[markdown]',
      '[json]',
      '[yaml]',
      '[html]',
    ]);

    expect(
      languageService.getConfiguredFormattingHostLanguages({
        initializationOptions: {
          formattingHostLanguages: [' markdown ', 'json', 'json', 'bogus'],
        },
      } as never)
    ).toEqual(['markdown', 'json']);

    expect(
      languageService.getConfiguredFormattingHostLanguages({
        initializationOptions: {
          prettierHostLanguages: [' yaml ', 'html', 42],
        },
      } as never)
    ).toEqual(['yaml', 'html']);

    expect(languageService.getConfiguredFormattingHostLanguages({} as never)).toEqual([]);

    const prettierEntry = languageService.getAdapterRuntimeEntry('templjs-prettier-host');
    expect(prettierEntry).toBeDefined();
    expect(prettierEntry?.manifest({ initializationOptions: {} } as never)).toBeUndefined();
    expect(
      prettierEntry?.manifest({
        initializationOptions: { formattingHostLanguages: ['markdown', 'yaml'] },
      } as never)
    ).toMatchObject({
      id: 'templjs-prettier-host',
      languageIds: ['markdown', 'yaml'],
      capabilities: ['formatting'],
      resolutionMode: 'deferred',
    });

    const unavailableRuntimeMap = languageService.resolveAdapterRuntimeMapFromRegistry({
      formattingHostLanguages: [],
      isExtensionInstalled: () => false,
    });
    expect(unavailableRuntimeMap['templjs-markdown-host']).toMatchObject({
      state: 'unavailable',
      reason: 'unavailable-vscode-extension-markdown',
    });
    expect(unavailableRuntimeMap['templjs-prettier-host']).toMatchObject({
      state: 'disabled',
      reason: 'disabled-no-prettier-host-languages',
    });

    const missingPrettierRuntimeMap = languageService.resolveAdapterRuntimeMapFromRegistry({
      formattingHostLanguages: ['markdown'],
      isExtensionInstalled: () => false,
    });
    expect(missingPrettierRuntimeMap['templjs-prettier-host']).toMatchObject({
      state: 'unavailable',
      reason: 'unavailable-vscode-extension-prettier',
    });

    const availableRuntimeMap = languageService.resolveAdapterRuntimeMapFromRegistry({
      formattingHostLanguages: ['markdown'],
      isExtensionInstalled: (id) => id !== 'redhat.vscode-yaml',
    });
    expect(availableRuntimeMap['templjs-markdown-host']).toMatchObject({
      state: 'enabled',
      reason: 'resolved-vscode-extension-markdown',
    });
    expect(availableRuntimeMap['templjs-yaml']).toMatchObject({
      state: 'unavailable',
      reason: 'unavailable-vscode-extension-yaml',
    });
    expect(availableRuntimeMap['templjs-prettier-host']).toMatchObject({
      state: 'enabled',
      reason: 'resolved-vscode-formatter-selection',
    });

    const originalJsonEntry = languageService.getAdapterRuntimeEntry('templjs-json-host');
    const overrideJsonEntry = {
      id: 'templjs-json-host',
      manifest: () => ({
        id: 'templjs-json-host',
        languageIds: ['json', 'templjs-json'],
        capabilities: ['diagnostics'],
        resolutionMode: 'immediate',
        requirements: { required: [], optional: [] },
      }),
      resolveRuntime: () => ({
        state: 'enabled',
        reason: 'resolved-vscode-extension-json',
        provider: { kind: 'vscode-extension', id: 'vscode.json-language-features' },
        languageIds: ['json', 'templjs-json'],
      }),
    };

    languageService.registerAdapterRuntimeEntry(overrideJsonEntry as never);
    try {
      expect(languageService.getAdapterRuntimeEntry('templjs-json-host')).toBe(overrideJsonEntry);
      expect(
        languageService
          .listAdapterRuntimeEntries()
          .find((entry) => entry.id === 'templjs-json-host')
      ).toBe(overrideJsonEntry);
    } finally {
      expect(languageService.unregisterAdapterRuntimeEntry('templjs-json-host')).toBe(true);
      if (originalJsonEntry) {
        languageService.registerAdapterRuntimeEntry(originalJsonEntry);
      }
    }
  });

  it('supports host adapter registry overrides through index exports', async () => {
    const languageService = await import('../src/index.ts');
    const key = 'templjs-prettier-host';
    const originalFactory = languageService.getHostAdapterPluginFactory(key);
    const overrideFactory = vi.fn(() => undefined);

    languageService.registerHostAdapterPlugin(key, overrideFactory);

    try {
      expect(languageService.getHostAdapterPluginFactory(key)).toBe(overrideFactory);
      expect(languageService.listHostAdapterPluginKeys()).toContain(key);
      expect(languageService.servicePluginTesting.getHostAdapterPluginFactory(key)).toBe(
        overrideFactory
      );
    } finally {
      expect(languageService.unregisterHostAdapterPlugin(key)).toBe(true);
      if (originalFactory) {
        languageService.registerHostAdapterPlugin(key, originalFactory);
      }
    }
  });

  it('ensures every manifest adapter has a host adapter plugin registration', async () => {
    const { servicePluginTesting } = await import('../src/index.ts');
    const manifest = servicePluginTesting.resolveAdapterRuntimeManifest({
      initializationOptions: {
        formattingHostLanguages: ['markdown', 'json', 'yaml', 'html'],
      },
    } as never);

    for (const adapter of manifest.adapters) {
      expect(servicePluginTesting.getHostAdapterPluginFactory(adapter.id)).toBeDefined();
    }
  });

  it('normalizes prettier host languages and omits unsupported entries', async () => {
    const { servicePluginTesting } = await import('../src/index.ts');
    const manifest = servicePluginTesting.resolveAdapterRuntimeManifest({} as never);

    expect(
      manifest.adapters.find((adapter) => adapter.id === 'templjs-markdown-host')
    ).toMatchObject({
      requirements: {
        required: [{ kind: 'extension-id', id: 'vscode.markdown-language-features' }],
        optional: [{ kind: 'vscode-setting-key', key: '[markdown]' }],
      },
    });

    expect(
      manifest.adapters.find((adapter) => adapter.id === 'templjs-markdownlint-host')
    ).toMatchObject({
      requirements: {
        required: [{ kind: 'binary-name', name: 'markdownlint' }],
        optional: [
          { kind: 'env-var', name: 'PATH' },
          { kind: 'vscode-setting-key', key: '[markdown]' },
        ],
      },
    });
    expect(
      servicePluginTesting.getConfiguredPrettierHostLanguages({
        initializationOptions: {
          prettierHostLanguages: [' markdown ', 'yaml', 'yaml', 'bogus'],
        },
      } as never)
    ).toEqual(['markdown', 'yaml']);
    expect(
      servicePluginTesting.createPrettierHostAdapter({
        initializationOptions: {},
      } as never)
    ).toBeUndefined();
  });

  it('skips yaml diagnostics for templjs source documents and keeps unclosed fenced ranges', async () => {
    const { servicePluginTesting } = await import('../src/index.ts');
    const yamlPlugin = servicePluginTesting.createYamlHostDiagnosticsAdapter({} as never);
    const instance = yamlPlugin.create({} as never);

    expect(
      await instance.provideDiagnostics?.(
        servicePluginTesting.createTextDocumentLike(
          'file:///doc.yaml.templ',
          'templjs-yaml',
          'a: {{ x }}'
        ),
        {} as never
      )
    ).toBeUndefined();

    expect(servicePluginTesting.detectMarkdownFencedCodeRanges('```yaml\nkey: value\n')).toEqual([
      { start: 0, end: '```yaml\nkey: value\n'.length },
    ]);
    expect(servicePluginTesting.isOffsetInRanges(2, [{ start: 0, end: 3 }])).toBe(true);
    expect(servicePluginTesting.isOffsetInRanges(3, [{ start: 0, end: 3 }])).toBe(false);
  });

  it('remaps diagnostics only for matching language ids and exposes host plugin names', async () => {
    const { servicePluginTesting } = await import('../src/index.ts');
    const markdownPlugin = servicePluginTesting.createTempljsMarkdownDiagnosticsPlugin({
      getDiagnosticOptions: () => ({}),
      getIntellisenseOptions: () => ({}),
    } as never);
    const pluginInstance = markdownPlugin.create(
      withVolar24Context({
        documents: {
          getVirtualCodeByUri: vi.fn(() => [
            { id: 'host.markdown', languageId: 'markdown' },
            { id: 'file:///doc.md.templ', languageId: 'templjs-markdown' },
          ]),
        },
        language: {
          files: {
            get: vi.fn((uri: string) => ({ id: uri, languageId: 'templjs-markdown' })),
          },
        },
      })
    );

    await pluginInstance.provideDiagnostics?.(
      servicePluginTesting.createTextDocumentLike('file:///doc.md', 'markdown', '# Title'),
      {} as never
    );

    expect(servicePluginTesting.createMarkdownHostDiagnosticsAdapter({} as never)?.name).toBe(
      'templjs-markdown-host'
    );
    expect(servicePluginTesting.createMarkdownlintHostDiagnosticsAdapter({} as never)?.name).toBe(
      'templjs-markdownlint-host'
    );
    expect(servicePluginTesting.createTempljsMarkdownDiagnosticsPlugin({} as never).name).toBe(
      'templjs-markdown-diagnostics'
    );
    expect(servicePluginTesting.createHtmlHostAdapter({} as never)?.name).toBe('templjs-html-host');
    expect(servicePluginTesting.createJsonHostAdapter({} as never)?.name).toBe('templjs-json-host');
  });

  it('disables markdownlint host adapter when runtime is unavailable', async () => {
    const { servicePluginTesting } = await import('../src/index.ts');

    expect(
      servicePluginTesting.planMarkdownAdapterRuntime({
        initializationOptions: {
          adapterRuntimes: {
            'templjs-markdownlint-host': {
              state: 'unavailable',
              reason: 'unavailable-binary-markdownlint',
            },
          },
        },
      } as never)
    ).toEqual({
      enabled: false,
      reason: 'unavailable-binary-markdownlint',
    });

    expect(
      servicePluginTesting.createMarkdownlintHostDiagnosticsAdapter({
        initializationOptions: {
          adapterRuntimes: {
            'templjs-markdownlint-host': {
              state: 'unavailable',
              reason: 'unavailable-binary-markdownlint',
            },
          },
        },
      } as never)
    ).toBeUndefined();
  });

  it('disables markdown host adapter when markdown language service runtime is unavailable', async () => {
    const { servicePluginTesting } = await import('../src/index.ts');

    expect(
      servicePluginTesting.planMarkdownHostAdapterRuntime({
        initializationOptions: {
          adapterRuntimes: {
            'templjs-markdown-host': {
              state: 'unavailable',
              reason: 'unavailable-vscode-extension-markdown',
            },
          },
        },
      } as never)
    ).toEqual({
      enabled: false,
      reason: 'unavailable-vscode-extension-markdown',
    });

    expect(
      servicePluginTesting.createMarkdownHostDiagnosticsAdapter({
        initializationOptions: {
          adapterRuntimes: {
            'templjs-markdown-host': {
              state: 'unavailable',
              reason: 'unavailable-vscode-extension-markdown',
            },
          },
        },
      } as never)
    ).toBeUndefined();
  });

  it('disables prettier adapter when no languages are configured', async () => {
    const { servicePluginTesting } = await import('../src/index.ts');

    expect(
      servicePluginTesting.planPrettierAdapterRuntime({ initializationOptions: {} } as never)
    ).toEqual({ enabled: false, languages: [], reason: 'disabled-no-languages-configured' });

    expect(
      servicePluginTesting.createPrettierHostAdapter({ initializationOptions: {} } as never)
    ).toBeUndefined();
  });

  it('enables prettier adapter with configured languages', async () => {
    const { servicePluginTesting } = await import('../src/index.ts');

    expect(
      servicePluginTesting.planPrettierAdapterRuntime({
        initializationOptions: { prettierHostLanguages: ['markdown', 'json'] },
      } as never)
    ).toEqual({ enabled: true, languages: ['markdown', 'json'], reason: 'configured-languages' });

    expect(
      servicePluginTesting.createPrettierHostAdapter({
        initializationOptions: { prettierHostLanguages: ['yaml'] },
      } as never)
    ).toBeDefined();
  });

  it('disables prettier adapter when adapter runtime map marks it unavailable', async () => {
    const { servicePluginTesting } = await import('../src/index.ts');

    expect(
      servicePluginTesting.planPrettierAdapterRuntime({
        initializationOptions: {
          adapterRuntimes: {
            'templjs-prettier-host': {
              state: 'unavailable',
              reason: 'unavailable-vscode-formatter-selection',
            },
          },
        },
      } as never)
    ).toEqual({ enabled: false, languages: [], reason: 'unavailable-vscode-formatter-selection' });
  });

  it('uses resolved reason when adapter runtime map marks prettier host as enabled', async () => {
    const { servicePluginTesting } = await import('../src/index.ts');

    expect(
      servicePluginTesting.planPrettierAdapterRuntime({
        initializationOptions: {
          prettierHostLanguages: ['html'],
          adapterRuntimes: {
            'templjs-prettier-host': {
              state: 'enabled',
              reason: 'resolved-vscode-formatter-selection',
            },
          },
        },
      } as never)
    ).toEqual({
      enabled: true,
      languages: ['html'],
      reason: 'resolved-vscode-formatter-selection',
    });
  });

  it('disables yaml adapter when redhat.vscode-yaml is not registered for .yaml', async () => {
    const { servicePluginTesting } = await import('../src/index.ts');

    expect(
      servicePluginTesting.planYamlAdapterRuntime({
        initializationOptions: {
          adapterRuntimes: {
            'templjs-yaml': {
              state: 'unavailable',
              reason: 'unavailable-vscode-extension-yaml',
            },
          },
        },
      } as never)
    ).toEqual({ enabled: false, reason: 'unavailable-vscode-extension-yaml' });

    expect(
      servicePluginTesting.planYamlAdapterRuntime({
        initializationOptions: { redhatYamlRegisteredForYaml: false },
      } as never)
    ).toEqual({ enabled: false, reason: 'disabled-yaml-ls-not-registered-for-yaml' });

    expect(
      servicePluginTesting.createYamlHostDiagnosticsAdapter({
        initializationOptions: { redhatYamlRegisteredForYaml: false },
      } as never)
    ).toBeUndefined();
  });

  it('disables json adapter when vscode.json-language-features is not registered', async () => {
    const { servicePluginTesting } = await import('../src/index.ts');

    expect(
      servicePluginTesting.planJsonAdapterRuntime({
        initializationOptions: {
          adapterRuntimes: {
            'templjs-json-host': {
              state: 'unavailable',
              reason: 'unavailable-vscode-extension-json',
            },
          },
        },
      } as never)
    ).toEqual({ enabled: false, reason: 'unavailable-vscode-extension-json' });

    expect(
      servicePluginTesting.createJsonHostAdapter({
        initializationOptions: {
          adapterRuntimes: {
            'templjs-json-host': {
              state: 'unavailable',
              reason: 'unavailable-vscode-extension-json',
            },
          },
        },
      } as never)
    ).toBeUndefined();
  });

  it('enables yaml adapter by default when redhatYamlRegisteredForYaml is not set', async () => {
    const { servicePluginTesting } = await import('../src/index.ts');

    expect(servicePluginTesting.planYamlAdapterRuntime({} as never)).toEqual({
      enabled: true,
      reason: 'default-enabled',
    });

    expect(servicePluginTesting.createYamlHostDiagnosticsAdapter({} as never)).toBeDefined();
  });

  it('enables json adapter by default when no runtime override is provided', async () => {
    const { servicePluginTesting } = await import('../src/index.ts');

    expect(servicePluginTesting.planJsonAdapterRuntime({} as never)).toEqual({
      enabled: true,
      reason: 'default-enabled',
    });

    expect(servicePluginTesting.createJsonHostAdapter({} as never)).toBeDefined();
  });

  it('disables html adapter when vscode.html-language-features is not registered', async () => {
    const { servicePluginTesting } = await import('../src/index.ts');

    expect(
      servicePluginTesting.planHtmlAdapterRuntime({
        initializationOptions: {
          adapterRuntimes: {
            'templjs-html-host': {
              state: 'unavailable',
              reason: 'unavailable-vscode-extension-html',
            },
          },
        },
      } as never)
    ).toEqual({ enabled: false, reason: 'unavailable-vscode-extension-html' });

    expect(
      servicePluginTesting.createHtmlHostAdapter({
        initializationOptions: {
          adapterRuntimes: {
            'templjs-html-host': {
              state: 'unavailable',
              reason: 'unavailable-vscode-extension-html',
            },
          },
        },
      } as never)
    ).toBeUndefined();
  });

  it('enables html adapter by default when no runtime override is provided', async () => {
    const { servicePluginTesting } = await import('../src/index.ts');

    expect(servicePluginTesting.planHtmlAdapterRuntime({} as never)).toEqual({
      enabled: true,
      reason: 'default-enabled',
    });

    expect(servicePluginTesting.createHtmlHostAdapter({} as never)).toBeDefined();
  });

  it('remaps matching language ids before delegating diagnostics', async () => {
    const { servicePluginTesting } = await import('../src/index.ts');
    const provideDiagnostics = vi.fn(async (document) => [document.languageId]);
    const remapped = servicePluginTesting.withLanguageIdRemap(
      {
        name: 'test-remap',
        create: () => ({ provideDiagnostics }),
      } as never,
      'templjs-yaml',
      'yaml'
    );

    const instance = remapped.create({} as never);
    const result = await instance.provideDiagnostics?.(
      servicePluginTesting.createTextDocumentLike('file:///doc.yaml.templ', 'templjs-yaml', 'a: 1'),
      {} as never
    );

    expect(result).toEqual(['yaml']);
    expect(provideDiagnostics).toHaveBeenCalledWith(
      expect.objectContaining({ languageId: 'yaml', uri: 'file:///doc.yaml.templ' }),
      expect.anything()
    );
  });

  it('passes through diagnostics unchanged when language id does not match remap source', async () => {
    const { servicePluginTesting } = await import('../src/index.ts');
    const provideDiagnostics = vi.fn(async (document) => [document.languageId]);
    const remapped = servicePluginTesting.withLanguageIdRemap(
      {
        name: 'test-remap-non-match',
        create: () => ({ provideDiagnostics }),
      } as never,
      'templjs-yaml',
      'yaml'
    );

    const instance = remapped.create({} as never);
    const result = await instance.provideDiagnostics?.(
      servicePluginTesting.createTextDocumentLike('file:///doc.yaml.templ', 'yaml', 'a: 1'),
      {} as never
    );

    expect(result).toEqual(['yaml']);
    expect(provideDiagnostics).toHaveBeenCalledWith(
      expect.objectContaining({ languageId: 'yaml' }),
      expect.anything()
    );
  });

  it('remaps completion, hover, and definition documents for matching language ids', async () => {
    const { servicePluginTesting } = await import('../src/index.ts');
    const provideCompletionItems = vi.fn(async (document) => [document.languageId]);
    const provideHover = vi.fn(async (document) => ({ contents: [document.languageId] }));
    const provideDefinition = vi.fn(async (document) => [document.languageId]);

    const remapped = servicePluginTesting.withLanguageIdRemap(
      {
        name: 'test-remap-features',
        create: () => ({
          provideCompletionItems,
          provideHover,
          provideDefinition,
        }),
      } as never,
      'templjs-markdown',
      'markdown'
    );

    const instance = remapped.create({} as never);
    const document = servicePluginTesting.createTextDocumentLike(
      'file:///doc.md.templ',
      'templjs-markdown',
      '# Templ'
    );

    await instance.provideCompletionItems?.(
      document,
      { line: 0, character: 1 },
      { triggerKind: 1 },
      {} as never
    );
    await instance.provideHover?.(document, { line: 0, character: 1 }, {} as never);
    await instance.provideDefinition?.(document, { line: 0, character: 1 }, {} as never);

    expect(provideCompletionItems).toHaveBeenCalledWith(
      expect.objectContaining({ languageId: 'markdown' }),
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
    expect(provideHover).toHaveBeenCalledWith(
      expect.objectContaining({ languageId: 'markdown' }),
      expect.anything(),
      expect.anything()
    );
    expect(provideDefinition).toHaveBeenCalledWith(
      expect.objectContaining({ languageId: 'markdown' }),
      expect.anything(),
      expect.anything()
    );
  });

  it.each([
    ['templjs-markdown-host', 'templjs-markdown', 'file:///doc.md.templ', 'markdown'],
    ['templjs-markdownlint-host', 'templjs-markdown', 'file:///doc.md.templ', 'markdown'],
    ['templjs-yaml', 'templjs-yaml', 'file:///doc.yaml.templ', 'yaml'],
  ] as const)('remaps diagnostic positions for %s', async (adapterId, sourceLanguageId, sourceUri, expectedLanguageId) => {
    const { servicePluginTesting } = await import('../src/index.ts');
    const sourceText = 'alpha{% set x = 1 -%}beta';
    const cleanedText = cleanTemplateContent(sourceText, undefined, { mode: 'text-only' }).cleaned;
    const cleanedOffset = cleanedText.indexOf('beta');
    const sourceOffset = sourceText.indexOf('beta');

    expect(cleanedOffset).toBeGreaterThanOrEqual(0);
    expect(cleanedOffset).not.toBe(sourceOffset);

    const stubPlugin = {
      name: `stub-${adapterId}`,
      create: () => ({
        provideDiagnostics(document: { languageId: string; getText(): string }) {
          const localCleanedText = cleanTemplateContent(document.getText(), undefined, {
            mode: 'text-only',
          }).cleaned;
          const localOffset = localCleanedText.indexOf('beta');

          return [
            {
              message: document.languageId,
              range: {
                start: { line: 0, character: localOffset },
                end: { line: 0, character: localOffset + 4 },
              },
            },
          ];
        },
      }),
    };

    const remapped = servicePluginTesting.withPositionRemap(
      servicePluginTesting.withLanguageIdRemap(stubPlugin as never, sourceLanguageId, expectedLanguageId),
      sourceLanguageId,
      { log: vi.fn() } as never
    );

    const sourceFile = {
      id: URI.parse(sourceUri),
      languageId: sourceLanguageId,
      snapshot: {
        getText: () => sourceText,
        getLength: () => sourceText.length,
      },
    };

    const context = {
      decodeEmbeddedDocumentUri: vi.fn((uri: URI) =>
        uri.toString() === `embedded-content://${adapterId}`
          ? ([sourceFile.id, 'root'] as const)
          : undefined
      ),
      language: {
        scripts: {
          get: vi.fn((uri: URI) => (uri.toString() === sourceUri ? sourceFile : undefined)),
        },
      },
    };

    const instance = remapped.create(context as never);
    const result = await instance.provideDiagnostics?.(
      servicePluginTesting.createTextDocumentLike(
        `embedded-content://${adapterId}`,
        sourceLanguageId,
        sourceText
      ),
      {} as never
    );

    expect(result).toHaveLength(1);
    expect(result?.[0]).toMatchObject({
      message: expectedLanguageId,
      range: {
        start: { line: 0, character: sourceOffset },
        end: { line: 0, character: sourceOffset + 4 },
      },
    });
  });

  it('prefers Volar source maps for diagnostic remapping when available', async () => {
    const { servicePluginTesting } = await import('../src/index.ts');

    const remapped = servicePluginTesting.withPositionRemap(
      {
        name: 'test-remap-volar-map',
        create: () => ({
          provideDiagnostics: () => [
            {
              message: 'map-first',
              range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 3 },
              },
            },
          ],
        }),
      } as never,
      'templjs-markdown',
      { log: vi.fn() } as never
    );

    const sourceUri = URI.parse('file:///doc.md.templ');
    const sourceText = 'prefix foo suffix';
    const embeddedCode = { id: 'host.markdown' };
    const sourceScript = {
      languageId: 'templjs-markdown',
      snapshot: {
        getText: () => sourceText,
        getLength: () => sourceText.length,
      },
      generated: {
        root: { id: 'root' },
        embeddedCodes: new Map([['host.markdown', embeddedCode]]),
      },
    };

    const map = {
      *toSourceRange() {
        yield [7, 10] as const;
      },
    };

    const context = {
      decodeEmbeddedDocumentUri: vi.fn((uri: URI) =>
        uri.toString() === 'embedded-content://volar-map'
          ? ([sourceUri, 'host.markdown'] as const)
          : undefined
      ),
      language: {
        scripts: {
          get: vi.fn((uri: URI) => (uri.toString() === sourceUri.toString() ? sourceScript : undefined)),
        },
        maps: {
          get: vi.fn((virtualCode: unknown, source: unknown) =>
            virtualCode === embeddedCode && source === sourceScript ? map : undefined
          ),
        },
      },
    };

    const instance = remapped.create(context as never);
    const diagnostics = await instance.provideDiagnostics?.(
      servicePluginTesting.createTextDocumentLike(
        'embedded-content://volar-map',
        'templjs-markdown',
        'xxx'
      ),
      {} as never
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics?.[0]).toMatchObject({
      range: {
        start: { line: 0, character: 7 },
        end: { line: 0, character: 10 },
      },
    });
  });

  it('returns the plugin instance unchanged when diagnostics are not provided', async () => {
    const { servicePluginTesting } = await import('../src/index.ts');
    const createOnly = vi.fn(() => ({ provideHover: vi.fn() }));
    const remapped = servicePluginTesting.withLanguageIdRemap(
      {
        name: 'test-remap-no-diag',
        create: createOnly,
      } as never,
      'templjs-yaml',
      'yaml'
    );

    const instance = remapped.create({} as never);
    expect(instance.provideDiagnostics).toBeUndefined();
    expect(typeof instance.provideHover).toBe('function');
  });

  it('creates markdown host adapter with diagnostics capability', async () => {
    const { servicePluginTesting } = await import('../src/index.ts');

    const markdownHostPlugin = servicePluginTesting.createMarkdownHostDiagnosticsAdapter(
      {} as never
    );
    expect(markdownHostPlugin).toBeDefined();
    expect(markdownHostPlugin?.name).toBe('templjs-markdown-host');
    expect(markdownHostPlugin?.capabilities).toMatchObject({
      diagnosticProvider: {
        interFileDependencies: false,
        workspaceDiagnostics: false,
      },
    });

    const markdownlintPlugin = servicePluginTesting.createMarkdownlintHostDiagnosticsAdapter(
      {} as never
    );
    expect(markdownlintPlugin).toBeDefined();
    expect(markdownlintPlugin?.name).toBe('templjs-markdownlint-host');
    expect(markdownlintPlugin?.capabilities).toMatchObject({
      diagnosticProvider: {
        interFileDependencies: false,
        workspaceDiagnostics: false,
      },
    });

    const disabledMarkdownlintPlugin =
      servicePluginTesting.createMarkdownlintHostDiagnosticsAdapter({
        initializationOptions: {
          adapterRuntimes: {
            'templjs-markdownlint-host': {
              state: 'unavailable',
              reason: 'unavailable-binary-markdownlint',
            },
          },
        },
      } as never);
    expect(disabledMarkdownlintPlugin).toBeUndefined();
  });

  it('builds default diagnostic and intellisense options and recognizes yaml documents', async () => {
    const { servicePluginTesting } = await import('../src/index.ts');
    const log = vi.fn();

    const intellisense = servicePluginTesting.toIntellisenseOptions(
      { workspaceFolder: '/workspace', log } as never,
      'file:///workspace/doc.md.templ',
      '# Title'
    );
    intellisense.debugLog?.('ready');

    expect(log).toHaveBeenCalledWith('[templjs-trace] file:///workspace/doc.md.templ ready');
    expect(
      servicePluginTesting.toDiagnosticOptions(
        { workspaceFolder: '/workspace' } as never,
        'file:///workspace/doc.md.templ',
        '# Title'
      )
    ).toEqual({
      documentUri: 'file:///workspace/doc.md.templ',
      schema: undefined,
      contentSchema: undefined,
    });

    expect(
      servicePluginTesting.isYamlDocument({} as never, {
        uri: 'file:///workspace/doc.txt',
        languageId: 'yaml',
      })
    ).toBe(true);

    expect(
      servicePluginTesting.isTempljsDocument({} as never, {
        uri: 'file:///workspace/doc.templ',
        languageId: 'plaintext',
      })
    ).toBe(true);

    expect(
      servicePluginTesting.isTempljsDocument({} as never, {
        uri: 'file:///workspace/doc.md.tpl',
        languageId: 'plaintext',
      })
    ).toBe(true);
  });

  it('resolves both schema and content schema from initialization options', async () => {
    const { servicePluginTesting } = await import('../src/index.ts');
    const workspace = mkdtempSync(join(tmpdir(), 'templjs-ls-'));
    const schemaPath = join(workspace, 'templ.schema.json');
    const contentSchemaPath = join(workspace, 'content.schema.json');

    try {
      writeFileSync(schemaPath, JSON.stringify({ type: 'object' }), 'utf8');
      writeFileSync(contentSchemaPath, JSON.stringify({ type: 'string' }), 'utf8');

      const options = servicePluginTesting.toDiagnosticOptions(
        {
          workspaceFolder: workspace,
          initializationOptions: {
            schemaPath,
            contentSchemaPath,
          },
        } as never,
        pathToFileURL(join(workspace, 'doc.md.templ')).toString(),
        '# Title'
      );

      expect(options.schema).toEqual({ type: 'object' });
      expect(options.contentSchema).toEqual({ type: 'string' });
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it('supports core service plugin registry lifecycle operations', async () => {
    const { servicePluginTesting } = await import('../src/index.ts');
    const key = 'core:test-plugin' as const;
    const factory = vi.fn(() => ({
      name: 'test-core-plugin',
      capabilities: {},
      create: () => ({}),
    }));

    expect(servicePluginTesting.listCoreServicePluginKeys()).not.toContain(key);
    servicePluginTesting.registerCoreServicePlugin(key, factory);

    try {
      expect(servicePluginTesting.listCoreServicePluginKeys()).toContain(key);
      const pluginNames = servicePluginTesting
        .listCoreServicePluginFactories()
        .map((entry) => entry({} as never).name);
      expect(pluginNames).toContain('test-core-plugin');
    } finally {
      expect(servicePluginTesting.unregisterCoreServicePlugin(key)).toBe(true);
    }

    expect(servicePluginTesting.listCoreServicePluginKeys()).not.toContain(key);
  });

  it('skips hover resolution for non-root virtual codes in templjs additional plugin', async () => {
    const { servicePluginTesting } = await import('../src/index.ts');
    const plugin = servicePluginTesting.createTempljsAdditionalPlugin({} as never);
    const instance = plugin.create({
      decodeEmbeddedDocumentUri: () => [URI.parse('file:///source.templ'), 'embedded'],
      language: {
        scripts: {
          get: () => undefined,
        },
      },
    } as never);

    const hover = instance.provideHover?.(
      servicePluginTesting.createTextDocumentLike(
        'file:///source.templ',
        'templjs-markdown',
        '{{ value }}'
      ),
      { line: 0, character: 3 },
      {} as never
    );

    expect(hover).toBeUndefined();
  });
});
