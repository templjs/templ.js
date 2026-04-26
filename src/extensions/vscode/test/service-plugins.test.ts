import { describe, expect, it, vi } from 'vitest';
import { createServicePlugins } from '../src/service-plugins';
describe('createServicePlugins', () => {
  it('returns templjs intellisense, diagnostics, and yaml service plugins', () => {
    const plugins = createServicePlugins({
      getIntellisenseOptions: () => ({}),
      getDiagnosticOptions: () => ({}),
    });

    expect(plugins).toHaveLength(4);
    expect(plugins[0]?.name).toBe('templjs-intellisense');
    expect(plugins[1]?.name).toBe('templjs-diagnostics');
    expect(plugins[2]?.name).toBe('templjs-markdown-diagnostics');
    expect(plugins[3]?.name).toBe('templjs-yaml');
  });

  it('delegates diagnostics for templjs-yaml documents', async () => {
    const plugins = createServicePlugins({
      getIntellisenseOptions: () => ({}),
      getDiagnosticOptions: () => ({}),
    });
    const yamlPlugin = plugins.find((plugin) => plugin.name === 'templjs-yaml');

    expect(yamlPlugin).toBeDefined();

    const getVirtualCodeByUri = vi.fn(() => [undefined, undefined] as const);
    const getLanguageFile = vi.fn(() => undefined);

    const pluginInstance = yamlPlugin!.create({
      documents: {
        getVirtualCodeByUri,
      },
      language: {
        files: {
          get: getLanguageFile,
        },
      },
    } as never);

    const diagnostics = await pluginInstance.provideDiagnostics?.({
      uri: 'file:///workspace/test.yaml.templ',
      languageId: 'templjs-yaml',
      getText: () => 'foo: bar: [{% for item in items %}{{ item }},',
      offsetAt: () => 0,
      positionAt: () => ({ line: 0, character: 0 }),
    } as never);

    expect(Array.isArray(diagnostics)).toBe(true);
    expect(diagnostics).toBeDefined();
  });

  it('delegates diagnostics for yaml template URI even when languageId is generic', async () => {
    const plugins = createServicePlugins({
      getIntellisenseOptions: () => ({}),
      getDiagnosticOptions: () => ({}),
    });
    const yamlPlugin = plugins.find((plugin) => plugin.name === 'templjs-yaml');

    expect(yamlPlugin).toBeDefined();

    const getVirtualCodeByUri = vi.fn(() => [undefined, undefined] as const);
    const getLanguageFile = vi.fn(() => undefined);

    const pluginInstance = yamlPlugin!.create({
      documents: {
        getVirtualCodeByUri,
      },
      language: {
        files: {
          get: getLanguageFile,
        },
      },
    } as never);

    const diagnostics = await pluginInstance.provideDiagnostics?.({
      uri: 'file:///workspace/Untitled-1.yaml.templ',
      languageId: 'plaintext',
      getText: () => 'foo: bar: [{% for item in items %}{{ item }},',
      offsetAt: () => 0,
      positionAt: () => ({ line: 0, character: 0 }),
    } as never);

    expect(Array.isArray(diagnostics)).toBe(true);
    expect(diagnostics).toBeDefined();
  });

  it('delegates diagnostics for templjs template source documents', async () => {
    const plugins = createServicePlugins({
      getIntellisenseOptions: () => ({}),
      getDiagnosticOptions: () => ({}),
    });
    const diagPlugin = plugins.find((plugin) => plugin.name === 'templjs-diagnostics');

    expect(diagPlugin).toBeDefined();

    const pluginInstance = diagPlugin!.create({
      documents: { getVirtualCodeByUri: vi.fn(() => [undefined, undefined] as const) },
      language: { files: { get: vi.fn(() => undefined) } },
    } as never);

    const diagnostics = await pluginInstance.provideDiagnostics?.(
      {
        uri: 'file:///workspace/test.yaml.templ',
        languageId: 'templjs-yaml',
        getText: () => '{{ undefined_var }}',
        offsetAt: () => 0,
        positionAt: () => ({ line: 0, character: 0 }),
      } as never,
      undefined as never
    );

    expect(Array.isArray(diagnostics)).toBe(true);
  });

  it('delegates diagnostics for source templjs docs even when languageId is generic', async () => {
    const plugins = createServicePlugins({
      getIntellisenseOptions: () => ({}),
      getDiagnosticOptions: () => ({}),
    });
    const diagPlugin = plugins.find((plugin) => plugin.name === 'templjs-diagnostics');

    expect(diagPlugin).toBeDefined();

    const pluginInstance = diagPlugin!.create({
      documents: { getVirtualCodeByUri: vi.fn(() => [undefined, undefined] as const) },
      language: {
        files: {
          get: vi.fn((uri: string) => ({ id: uri, languageId: 'templjs-yaml' })),
        },
      },
    } as never);

    const diagnostics = await pluginInstance.provideDiagnostics?.(
      {
        uri: 'file:///workspace/test.yaml.templ',
        languageId: 'yaml',
        getText: () => '{{ undefined_var }}',
        offsetAt: () => 0,
        positionAt: () => ({ line: 0, character: 0 }),
      } as never,
      undefined as never
    );

    expect(Array.isArray(diagnostics)).toBe(true);
    expect(diagnostics).toBeDefined();
  });

  it('skips diagnostics for templjs virtual documents', async () => {
    const plugins = createServicePlugins({
      getIntellisenseOptions: () => ({}),
      getDiagnosticOptions: () => ({}),
    });
    const diagPlugin = plugins.find((plugin) => plugin.name === 'templjs-diagnostics');

    expect(diagPlugin).toBeDefined();

    const pluginInstance = diagPlugin!.create({
      documents: {
        getVirtualCodeByUri: vi.fn(() => [
          { id: 'virtual-code-id' },
          { id: 'file:///workspace/test.yaml.templ', languageId: 'templjs-yaml' },
        ]),
      },
      language: { files: { get: vi.fn(() => undefined) } },
    } as never);

    const diagnostics = await pluginInstance.provideDiagnostics?.(
      {
        uri: 'file:///workspace/test.yaml.templ.__virtual__.yaml',
        languageId: 'yaml',
        getText: () => '{{ undefined_var }}',
        offsetAt: () => 0,
        positionAt: () => ({ line: 0, character: 0 }),
      } as never,
      undefined as never
    );

    expect(diagnostics).toBeUndefined();
  });

  it('delegates diagnostics for templjs root virtual documents', async () => {
    const plugins = createServicePlugins({
      getIntellisenseOptions: () => ({}),
      getDiagnosticOptions: () => ({}),
    });
    const diagPlugin = plugins.find((plugin) => plugin.name === 'templjs-diagnostics');

    expect(diagPlugin).toBeDefined();

    const pluginInstance = diagPlugin!.create({
      documents: {
        getVirtualCodeByUri: vi.fn(() => [
          { id: 'root' },
          { id: 'file:///workspace/test.yaml.templ', languageId: 'templjs-yaml' },
        ]),
      },
      language: { files: { get: vi.fn(() => undefined) } },
    } as never);

    const diagnostics = await pluginInstance.provideDiagnostics?.(
      {
        uri: 'file:///workspace/test.yaml.templ?virtualCodeId=root',
        languageId: 'yaml',
        getText: () => '{{ undefined_var }}',
        offsetAt: () => 0,
        positionAt: () => ({ line: 0, character: 0 }),
      } as never,
      undefined as never
    );

    expect(Array.isArray(diagnostics)).toBe(true);
    expect(diagnostics).toBeDefined();
  });

  it('delegates diagnostics when source id differs from document uri', async () => {
    const plugins = createServicePlugins({
      getIntellisenseOptions: () => ({}),
      getDiagnosticOptions: () => ({}),
    });
    const diagPlugin = plugins.find((plugin) => plugin.name === 'templjs-diagnostics');

    expect(diagPlugin).toBeDefined();

    const pluginInstance = diagPlugin!.create({
      documents: {
        getVirtualCodeByUri: vi.fn(
          () =>
            [
              undefined,
              { id: 'file:///workspace/test.yaml.templ?x=1', languageId: 'templjs-yaml' },
            ] as const
        ),
      },
      language: { files: { get: vi.fn(() => undefined) } },
    } as never);

    const diagnostics = await pluginInstance.provideDiagnostics?.(
      {
        uri: 'file:///workspace/test.yaml.templ',
        languageId: 'yaml',
        getText: () => '{{ undefined_var }}',
        offsetAt: () => 0,
        positionAt: () => ({ line: 0, character: 0 }),
      } as never,
      undefined as never
    );

    expect(Array.isArray(diagnostics)).toBe(true);
    expect(diagnostics).toBeDefined();
  });

  it('uses source snapshot text for root virtual templjs diagnostics', async () => {
    const plugins = createServicePlugins({
      getIntellisenseOptions: () => ({}),
      getDiagnosticOptions: () => ({}),
      log: vi.fn(),
    });
    const diagPlugin = plugins.find((plugin) => plugin.name === 'templjs-diagnostics');

    expect(diagPlugin).toBeDefined();

    const sourceText = '{{ undefined_var }}';
    const pluginInstance = diagPlugin!.create({
      documents: {
        getVirtualCodeByUri: vi.fn(() => [
          { id: 'root' },
          {
            id: 'file:///workspace/test.yaml.templ',
            languageId: 'templjs-yaml',
            snapshot: {
              getText: () => sourceText,
              getLength: () => sourceText.length,
            },
          },
        ]),
      },
      language: { files: { get: vi.fn(() => undefined) } },
    } as never);

    const diagnostics = await pluginInstance.provideDiagnostics?.(
      {
        uri: 'file:///workspace/test.yaml.templ?virtualCodeId=root',
        languageId: 'yaml',
        getText: () => 'title: static',
        offsetAt: () => 0,
        positionAt: () => ({ line: 0, character: 0 }),
      } as never,
      undefined as never
    );

    expect(Array.isArray(diagnostics)).toBe(true);
    expect(diagnostics).toBeDefined();
  });

  it('routes markdown templjs diagnostics to the markdown-specific plugin', async () => {
    const plugins = createServicePlugins({
      getIntellisenseOptions: () => ({}),
      getDiagnosticOptions: () => ({}),
      log: vi.fn(),
    });
    const diagPlugin = plugins.find((plugin) => plugin.name === 'templjs-diagnostics');
    const markdownDiagPlugin = plugins.find(
      (plugin) => plugin.name === 'templjs-markdown-diagnostics'
    );

    expect(diagPlugin).toBeDefined();
    expect(markdownDiagPlugin).toBeDefined();

    const context = {
      documents: {
        getVirtualCodeByUri: vi.fn(() => [
          { id: 'root' },
          {
            id: 'file:///workspace/test.md.templ',
            languageId: 'templjs-markdown',
            snapshot: {
              getText: () => '---\ntitle: "{{ front.title }}"\n---\n{{ content.heading }}',
              getLength: () => '---\ntitle: "{{ front.title }}"\n---\n{{ content.heading }}'.length,
            },
          },
        ]),
      },
      language: { files: { get: vi.fn(() => undefined) } },
    } as never;

    const genericDiagnostics = await diagPlugin!.create(context).provideDiagnostics?.(
      {
        uri: 'file:///workspace/test.md.templ?virtualCodeId=root',
        languageId: 'markdown',
        getText: () => 'body only',
        offsetAt: () => 0,
        positionAt: () => ({ line: 0, character: 0 }),
      } as never,
      undefined as never
    );

    const markdownDiagnostics = await markdownDiagPlugin!.create(context).provideDiagnostics?.(
      {
        uri: 'file:///workspace/test.md.templ?virtualCodeId=root',
        languageId: 'markdown',
        getText: () => 'body only',
        offsetAt: () => 0,
        positionAt: () => ({ line: 0, character: 0 }),
      } as never,
      undefined as never
    );

    expect(genericDiagnostics).toBeUndefined();
    expect(Array.isArray(markdownDiagnostics)).toBe(true);
    expect(markdownDiagnostics).toBeDefined();
  });

  it('surfaces yaml diagnostics for malformed markdown frontmatter templates', async () => {
    const plugins = createServicePlugins({
      getIntellisenseOptions: () => ({}),
      getDiagnosticOptions: () => ({}),
      log: vi.fn(),
    });
    const markdownDiagPlugin = plugins.find(
      (plugin) => plugin.name === 'templjs-markdown-diagnostics'
    );

    expect(markdownDiagPlugin).toBeDefined();

    const rawSourceText = [
      '---',
      'foo: bar: [{% for item in items %}{{ item }},',
      '---',
      '#Bad Heading',
      '{% if false %}',
    ].join('\n');
    const cleanedText = [
      '---',
      'foo: bar: [                            ,',
      '---',
      '#Bad Heading',
      '              ',
    ].join('\n');

    const pluginInstance = markdownDiagPlugin!.create({
      documents: {
        getVirtualCodeByUri: vi.fn(() => [
          { id: 'root' },
          {
            id: 'file:///workspace/test.md.templ',
            languageId: 'templjs-markdown',
            snapshot: {
              getText: () => rawSourceText,
              getLength: () => rawSourceText.length,
            },
          },
        ]),
      },
      language: { files: { get: vi.fn(() => undefined) } },
    } as never);

    const diagnostics = await pluginInstance.provideDiagnostics?.(
      {
        uri: 'file:///workspace/test.md.templ?virtualCodeId=root',
        languageId: 'markdown',
        getText: () => cleanedText,
        offsetAt: () => 0,
        positionAt: () => ({ line: 0, character: 0 }),
      } as never,
      undefined as never
    );

    expect(diagnostics?.some((diag) => diag.source?.toLowerCase() === 'yaml')).toBe(true);
  });
});
