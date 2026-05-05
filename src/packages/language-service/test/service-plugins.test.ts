import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../../extensions/vscode/src/service-plugins', async () => {
  const actual = await import('../src/index.ts');
  return {
    createServicePlugins: actual.createTempljsServicePlugins,
    servicePluginTesting: actual.servicePluginTesting,
  };
});

import { URI } from 'vscode-uri';

beforeAll(async () => {
  const extensionTestUrl = pathToFileURL(
    path.resolve(import.meta.dirname, '../../../extensions/vscode/test/service-plugins.test.ts')
  ).href;
  await import(extensionTestUrl);
});

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
  it('normalizes prettier host languages and omits unsupported entries', async () => {
    const { servicePluginTesting } = await import('../src/index.ts');
    expect(
      servicePluginTesting.getConfiguredPrettierHostLanguages({
        initializationOptions: {
          prettierHostLanguages: [' markdown ', 'yaml', 'yaml', 'bogus'],
        },
      } as never)
    ).toEqual(['markdown', 'yaml']);
    expect(
      servicePluginTesting.createPrettierHostServicePlugin({
        initializationOptions: {},
      } as never)
    ).toBeUndefined();
  });

  it('skips yaml diagnostics for templjs source documents and keeps unclosed fenced ranges', async () => {
    const { servicePluginTesting } = await import('../src/index.ts');
    const yamlPlugin = servicePluginTesting.createYamlDiagnosticsPlugin({} as never);
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

    expect(servicePluginTesting.createMarkdownHostDiagnosticsPlugin({} as never).name).toBe(
      'templjs-markdown-host'
    );
    expect(servicePluginTesting.createTempljsMarkdownDiagnosticsPlugin({} as never).name).toBe(
      'templjs-markdown-diagnostics'
    );
    expect(servicePluginTesting.createHtmlHostServicePlugin().name).toBe('templjs-html-host');
    expect(servicePluginTesting.createJsonHostServicePlugin().name).toBe('templjs-json-host');
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

  it('passes default markdown diagnostic options into the markdown host service factory', async () => {
    vi.resetModules();
    const markdownFactory = vi.fn(
      (options: { getDiagnosticOptions: () => Promise<Record<string, unknown>> }) => ({
        create: () => ({}),
        options,
      })
    );
    vi.doMock('volar-service-markdown', () => ({ create: markdownFactory }));

    const { servicePluginTesting } = await import('../src/index.ts');
    servicePluginTesting.createMarkdownHostDiagnosticsPlugin({} as never);

    const diagnosticOptions = await markdownFactory.mock.calls[0][0].getDiagnosticOptions();
    expect(diagnosticOptions).toMatchObject({
      validateReferences: 'warning',
      validateFragmentLinks: 'warning',
      validateFileLinks: 'warning',
    });
    vi.doUnmock('volar-service-markdown');
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
  });
});
