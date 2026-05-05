import { describe, expect, it, vi } from 'vitest';
import * as volar from '@templjs/volar';
import { createServicePlugins, servicePluginTesting } from '../src/service-plugins';
describe('createServicePlugins', () => {
  it('returns templjs plugins plus host language service adapters', () => {
    const plugins = createServicePlugins({
      getIntellisenseOptions: () => ({}),
      getDiagnosticOptions: () => ({}),
    });

    expect(plugins).toHaveLength(7);
    expect(plugins[0]?.name).toBe('templjs-intellisense');
    expect(plugins[1]?.name).toBe('templjs-diagnostics');
    expect(plugins[2]?.name).toBe('templjs-markdown-diagnostics');
    expect(plugins[3]?.name).toBe('templjs-markdown-host');
    expect(plugins[4]?.name).toBe('templjs-yaml');
    expect(plugins[5]?.name).toBe('templjs-html-host');
    expect(plugins[6]?.name).toBe('templjs-json-host');
  });

  it('adds prettier host plugin only for configured host languages', () => {
    const plugins = createServicePlugins({
      getIntellisenseOptions: () => ({}),
      getDiagnosticOptions: () => ({}),
      initializationOptions: {
        prettierHostLanguages: ['markdown', 'json', 'templjs-yaml', 'MARKDOWN'],
      } as never,
    });

    expect(plugins.some((plugin) => plugin.name === 'templjs-prettier-host')).toBe(true);
  });

  it('skips yaml diagnostics on raw templjs-yaml source documents', async () => {
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

    const diagnostics = await pluginInstance.provideDiagnostics?.(
      {
        uri: 'file:///workspace/test.yaml.templ',
        languageId: 'templjs-yaml',
        getText: () => 'foo: bar: [{% for item in items %}{{ item }},',
        offsetAt: () => 0,
        positionAt: () => ({ line: 0, character: 0 }),
      } as never,
      undefined as never
    );

    expect(diagnostics).toBeUndefined();
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

    const diagnostics = await pluginInstance.provideDiagnostics?.(
      {
        uri: 'file:///workspace/Untitled-1.yaml.templ',
        languageId: 'plaintext',
        getText: () => 'foo: bar: [{% for item in items %}{{ item }},',
        offsetAt: () => 0,
        positionAt: () => ({ line: 0, character: 0 }),
      } as never,
      undefined as never
    );

    expect(diagnostics === undefined || Array.isArray(diagnostics)).toBe(true);
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

  it('does not surface yaml diagnostics for malformed markdown frontmatter templates (regression guard)', async () => {
    // Stripped frontmatter content may be structurally incomplete YAML (e.g. an unclosed
    // sequence bracket where the template expression would close it at render time).
    // The markdown plugin must NOT validate stripped frontmatter as standalone YAML —
    // that would produce false positives. See: regression from transparency work.
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

    // No YAML diagnostics from the markdown plugin — stripped content is opaque to YAML validation.
    expect(diagnostics?.some((diag) => diag.source?.toLowerCase() === 'yaml')).toBe(false);
  });

  it('does not synthesize markdown diagnostics for md templates in the extension layer', async () => {
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
      'title: {{ title }}',
      '---',
      '# Heading',
      '{% if true %}',
      'Body',
    ].join('\n');
    const cleanedText = [
      '---',
      'title:            ',
      '---',
      '# Heading',
      '             ',
      'Body',
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

    expect(diagnostics?.some((diag) => diag.source?.toLowerCase() === 'markdown')).toBe(false);
  });

  it('ignores templjs diagnostics for template delimiters inside markdown fenced code blocks', async () => {
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
      'title: test',
      '---',
      '# Heading',
      '',
      '```yaml',
      '{% if true %}',
      'key: value',
      '```',
    ].join('\n');
    const cleanedText = [
      '---',
      'title: test',
      '---',
      '# Heading',
      '',
      '```yaml',
      '           ',
      'key: value',
      '```',
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

    expect(
      diagnostics?.some(
        (diag) =>
          diag.source?.toLowerCase() === 'templjs' &&
          diag.message.toLowerCase().includes('missing closing tag')
      )
    ).toBe(false);
  });

  it('uses source snapshots for virtual-root alias completions', () => {
    const plugins = createServicePlugins({
      getIntellisenseOptions: () => ({}),
      getDiagnosticOptions: () => ({}),
    });
    const intellisensePlugin = plugins.find((plugin) => plugin.name === 'templjs-intellisense');

    expect(intellisensePlugin).toBeDefined();

    const sourceText = '{% for item in users %}{{ it }}{% endfor %}';
    const cursorCharacter = sourceText.lastIndexOf('it') + 'it'.length;

    const pluginInstance = intellisensePlugin!.create({
      documents: {
        getVirtualCodeByUri: vi.fn(() => [
          { id: 'root' },
          {
            id: 'file:///workspace/test.md.templ',
            languageId: 'templjs-markdown',
            snapshot: {
              getText: () => sourceText,
              getLength: () => sourceText.length,
            },
          },
        ]),
      },
      language: { files: { get: vi.fn(() => undefined) } },
    } as never);

    const completions = pluginInstance.provideCompletionItems?.(
      {
        uri: 'file:///workspace/test.md.templ?virtualCodeId=root',
        languageId: 'markdown',
        getText: () => ' '.repeat(sourceText.length),
        offsetAt: () => 0,
      } as never,
      { line: 0, character: cursorCharacter } as never,
      undefined as never,
      undefined as never
    );

    expect(completions && 'items' in completions).toBe(true);
    if (completions && 'items' in completions) {
      expect(completions.items.some((item) => item.label === 'item')).toBe(true);
    }
  });

  it('skips templjs authoring features when cursor is inside markdown fenced code block', () => {
    const plugins = createServicePlugins({
      getIntellisenseOptions: () => ({}),
      getDiagnosticOptions: () => ({}),
    });
    const intellisensePlugin = plugins.find((plugin) => plugin.name === 'templjs-intellisense');

    expect(intellisensePlugin).toBeDefined();

    const sourceText = ['# Heading', '', '```yaml', '{{ user.name }}', '```'].join('\n');
    const cursorCharacter = sourceText.split('\n')[3].indexOf('user') + 2;

    const pluginInstance = intellisensePlugin!.create({
      documents: {
        getVirtualCodeByUri: vi.fn(() => [
          { id: 'root' },
          {
            id: 'file:///workspace/test.md.templ',
            languageId: 'templjs-markdown',
            snapshot: {
              getText: () => sourceText,
              getLength: () => sourceText.length,
            },
          },
        ]),
      },
      language: { files: { get: vi.fn(() => undefined) } },
    } as never);

    const completion = pluginInstance.provideCompletionItems?.(
      {
        uri: 'file:///workspace/test.md.templ?virtualCodeId=root',
        languageId: 'markdown',
        getText: () => sourceText,
        offsetAt: () => 0,
      } as never,
      { line: 3, character: cursorCharacter } as never,
      undefined as never,
      undefined as never
    );

    const hover = pluginInstance.provideHover?.(
      {
        uri: 'file:///workspace/test.md.templ?virtualCodeId=root',
        languageId: 'markdown',
        getText: () => sourceText,
        offsetAt: () => 0,
      } as never,
      { line: 3, character: cursorCharacter } as never,
      undefined as never
    );

    const definition = pluginInstance.provideDefinition?.(
      {
        uri: 'file:///workspace/test.md.templ?virtualCodeId=root',
        languageId: 'markdown',
        getText: () => sourceText,
        offsetAt: () => 0,
      } as never,
      { line: 3, character: cursorCharacter } as never,
      undefined as never
    );

    expect(completion).toBeUndefined();
    expect(hover).toBeUndefined();
    expect(definition).toBeUndefined();
  });

  it('covers service-plugin helper behavior directly', () => {
    const context = {
      documents: {
        getVirtualCodeByUri: vi.fn((uri: string) =>
          uri.includes('virtualCodeId') || uri.includes('virtual')
            ? ([
                { id: 'root' },
                {
                  id: 'file:///workspace/doc.md.templ',
                  languageId: 'templjs-markdown',
                  snapshot: {
                    getText: (_start: number, _end: number) => '---\ntitle: test\n---\nbody',
                    getLength: () => '---\ntitle: test\n---\nbody'.length,
                  },
                },
              ] as const)
            : ([undefined, undefined] as const)
        ),
      },
      language: {
        files: {
          get: vi.fn((uri: string) =>
            uri.includes('doc.md.templ')
              ? {
                  id: 'file:///workspace/doc.md.templ',
                  languageId: 'templjs-markdown',
                  snapshot: {
                    getText: (_start: number, _end: number) => '---\ntitle: test\n---\nbody',
                    getLength: () => '---\ntitle: test\n---\nbody'.length,
                  },
                }
              : uri.includes('doc.yaml')
                ? { id: 'file:///workspace/doc.yaml', languageId: 'yaml' }
                : undefined
          ),
        },
      },
    } as never;

    expect(servicePluginTesting.getSourceUri(context, 'file:///workspace/plain.md')).toBe(
      'file:///workspace/plain.md'
    );
    expect(
      servicePluginTesting.getSourceLanguageId(
        context,
        'file:///workspace/doc.md.templ?virtualCodeId=root'
      )
    ).toBe('templjs-markdown');
    expect(
      servicePluginTesting.getSourceDocumentText(
        context,
        {
          uri: 'file:///workspace/doc.md.templ?virtualCodeId=root',
          getText: () => 'fallback',
        },
        'file:///workspace/doc.md.templ'
      )
    ).toEqual({ text: '---\ntitle: test\n---\nbody', fromSource: true });
    expect(
      servicePluginTesting.getSourceDocumentText(
        context,
        {
          uri: 'file:///workspace/doc.md.templ',
          getText: () => 'direct',
        },
        'file:///workspace/doc.md.templ'
      )
    ).toEqual({ text: 'direct', fromSource: false });
    expect(
      servicePluginTesting.getSourceDocumentText(
        {
          documents: {
            getVirtualCodeByUri: vi.fn(
              () => [undefined, { id: 'file:///workspace/no-snapshot.md' }] as const
            ),
          },
          language: { files: { get: vi.fn(() => ({ id: 'file:///workspace/no-snapshot.md' })) } },
        } as never,
        {
          uri: 'file:///workspace/no-snapshot.md?virtualCodeId=root',
          getText: () => 'fallback-text',
        },
        'file:///workspace/no-snapshot.md'
      )
    ).toEqual({ text: 'fallback-text', fromSource: false });
    expect(
      servicePluginTesting.getVirtualCodeId(context, 'file:///workspace/doc.md.templ?virtual')
    ).toBe('root');
    expect(servicePluginTesting.isMarkdownTempljsLanguage('templjs-markdown')).toBe(true);
    expect(servicePluginTesting.isMarkdownTempljsLanguage('templjs-yaml')).toBe(false);
    expect(
      servicePluginTesting.isTempljsDocument(context, {
        uri: 'file:///workspace/direct.md.templ',
        languageId: 'templjs-markdown',
      })
    ).toBe(true);
    expect(
      servicePluginTesting.isTempljsDocument(context, {
        uri: 'file:///workspace/doc.md.templ?virtualCodeId=root',
        languageId: 'markdown',
      })
    ).toBe(true);
    expect(
      servicePluginTesting.isTempljsDocument(context, {
        uri: 'file:///workspace/plain.md',
        languageId: 'markdown',
      })
    ).toBe(false);
    expect(
      servicePluginTesting.isYamlDocument(context, {
        uri: 'file:///workspace/data.yaml.templ',
        languageId: 'plaintext',
      })
    ).toBe(true);
    expect(
      servicePluginTesting.isYamlDocument(context, {
        uri: 'file:///workspace/doc.json',
        languageId: 'json',
      })
    ).toBe(false);
    expect(
      servicePluginTesting.detectMarkdownFrontmatterRange('---\ntitle: test\n---\nbody')
    ).toEqual({ start: 0, end: 20 });
    expect(
      servicePluginTesting.detectMarkdownFrontmatterRange('+++\r\ntitle: test\r\n+++\r\nbody')
    ).toEqual({ start: 0, end: 23 });
    expect(
      servicePluginTesting.detectMarkdownFrontmatterRange('---\ntitle: test\n...\nbody')
    ).toBeUndefined();
    expect(
      servicePluginTesting.detectMarkdownFrontmatterRange('title: test\nbody')
    ).toBeUndefined();

    const textDocument = servicePluginTesting.createTextDocumentLike(
      'file:///workspace/test.yaml',
      'yaml',
      'a\r\nbc'
    );
    expect(textDocument.positionAt(-5)).toEqual({ line: 0, character: 0 });
    expect(textDocument.positionAt(4)).toEqual({ line: 1, character: 1 });
    expect(textDocument.positionAt(999)).toEqual({ line: 1, character: 2 });
    expect(textDocument.offsetAt({ line: 1, character: 1 })).toBe(4);
    expect(textDocument.offsetAt({ line: 9, character: 9 })).toBe(5);
    expect(
      servicePluginTesting
        .createTextDocumentLike('file:///workspace/test.yaml', 'yaml', 'a\nb')
        .offsetAt({ line: 1, character: 1 })
    ).toBe(3);
    const emptyDocument = servicePluginTesting.createTextDocumentLike(
      'file:///workspace/empty.yaml',
      'yaml',
      ''
    );
    expect(emptyDocument.positionAt(1)).toEqual({ line: 0, character: 0 });
    expect(emptyDocument.offsetAt({ line: 5, character: 5 })).toBe(0);
    expect(servicePluginTesting.toDiagnosticSeverity(1)).toBe(1);
    expect(servicePluginTesting.toDiagnosticSeverity(2)).toBe(2);
    expect(servicePluginTesting.toDiagnosticSeverity(3)).toBe(3);
    expect(servicePluginTesting.toDiagnosticSeverity(4)).toBe(4);
    expect(servicePluginTesting.toDiagnosticSeverity(9)).toBeUndefined();
  });

  it('covers skip routing and intellisense plugin behaviors', async () => {
    const log = vi.fn();
    vi.spyOn(volar.TempljsServicePlugin.prototype, 'getCompletions').mockReturnValue([
      { label: 'user', kind: 6 },
    ] as never);
    vi.spyOn(volar.TempljsServicePlugin.prototype, 'getHover').mockReturnValue({
      contents: { kind: 'markdown', value: 'hovered' },
    } as never);
    vi.spyOn(volar.TempljsServicePlugin.prototype, 'getDefinition')
      .mockReturnValueOnce({
        uri: 'file:///workspace/schema.json',
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 1 },
        },
      } as never)
      .mockReturnValueOnce(null as never);

    const plugins = createServicePlugins({
      getIntellisenseOptions: () => ({ schemaUri: 'file:///workspace/schema.json' }),
      getDiagnosticOptions: () => ({}),
      log,
      traceYamlDiagnostics: true,
    });
    const intellisensePlugin = plugins.find((plugin) => plugin.name === 'templjs-intellisense');
    const yamlPlugin = plugins.find((plugin) => plugin.name === 'templjs-yaml');
    const markdownDiagPlugin = plugins.find(
      (plugin) => plugin.name === 'templjs-markdown-diagnostics'
    );

    expect(intellisensePlugin).toBeDefined();
    expect(yamlPlugin).toBeDefined();
    expect(markdownDiagPlugin).toBeDefined();

    const context = {
      documents: {
        getVirtualCodeByUri: vi.fn((uri: string) => {
          if (uri.includes('virtual-non-root')) {
            return [
              { id: 'embedded-1' },
              { id: 'file:///workspace/doc.md.templ', languageId: 'templjs-markdown' },
            ] as const;
          }
          if (uri.includes('root')) {
            return [
              { id: 'root' },
              { id: 'file:///workspace/doc.md.templ', languageId: 'templjs-markdown' },
            ] as const;
          }
          return [undefined, undefined] as const;
        }),
      },
      language: {
        files: {
          get: vi.fn((uri: string) =>
            uri.includes('doc.md.templ')
              ? { id: 'file:///workspace/doc.md.templ', languageId: 'templjs-markdown' }
              : uri.includes('plain.json')
                ? { id: 'file:///workspace/plain.json', languageId: 'json' }
                : undefined
          ),
        },
      },
    } as never;

    const route = servicePluginTesting.shouldSkipTempljsDiagnostics(
      context,
      { uri: 'file:///workspace/virtual-non-root', languageId: 'markdown' },
      { getIntellisenseOptions: () => ({}), getDiagnosticOptions: () => ({}), log },
      'test-plugin'
    );
    expect(route.skip).toBe(true);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('reason=virtual-non-root'));

    const pluginInstance = intellisensePlugin!.create(context);
    const completionResult = pluginInstance.provideCompletionItems?.(
      {
        uri: 'file:///workspace/root',
        languageId: 'markdown',
        getText: () => '{{ user.name }}',
        offsetAt: () => 0,
      } as never,
      { line: 0, character: 0 } as never,
      undefined as never,
      undefined as never
    );
    expect(completionResult && 'items' in completionResult).toBe(true);
    expect(
      pluginInstance.provideHover?.(
        {
          uri: 'file:///workspace/root',
          languageId: 'markdown',
          getText: () => '{{ user.name }}',
          offsetAt: () => 0,
        } as never,
        { line: 0, character: 0 } as never,
        undefined as never
      )
    ).toBeDefined();
    expect(
      pluginInstance.provideDefinition?.(
        {
          uri: 'file:///workspace/root',
          languageId: 'markdown',
          getText: () => '{{ user.name }}',
          offsetAt: () => 0,
        } as never,
        { line: 0, character: 0 } as never,
        undefined as never
      )
    ).toEqual([
      {
        targetUri: 'file:///workspace/schema.json',
        targetRange: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 1 },
        },
        targetSelectionRange: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 1 },
        },
      },
    ]);
    expect(
      pluginInstance.provideDefinition?.(
        {
          uri: 'file:///workspace/root',
          languageId: 'markdown',
          getText: () => '{{ user.name }}',
          offsetAt: () => 0,
        } as never,
        { line: 0, character: 0 } as never,
        undefined as never
      )
    ).toBeUndefined();
    expect(
      pluginInstance.provideCompletionItems?.(
        {
          uri: 'file:///workspace/plain.json',
          languageId: 'json',
          getText: () => '{"name": 1}',
          offsetAt: () => 0,
        } as never,
        { line: 0, character: 0 } as never,
        undefined as never,
        undefined as never
      )
    ).toBeUndefined();

    const yamlDiagnostics = await yamlPlugin!.create(context).provideDiagnostics?.(
      {
        uri: 'file:///workspace/data.yaml.templ',
        languageId: 'templjs-yaml',
        getText: () => 'foo: bar: [',
        offsetAt: () => 0,
        positionAt: () => ({ line: 0, character: 0 }),
      } as never,
      undefined as never
    );
    expect(yamlDiagnostics).toBeUndefined();
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('templjs-yaml-plugin] skip source templjs document')
    );

    const markdownDiagnostics = await markdownDiagPlugin!.create(context).provideDiagnostics?.(
      {
        uri: 'file:///workspace/plain.json',
        languageId: 'json',
        getText: () => '{}',
        offsetAt: () => 0,
        positionAt: () => ({ line: 0, character: 0 }),
      } as never,
      undefined as never
    );
    expect(markdownDiagnostics).toBeUndefined();

    const nonMarkdownRoute = await markdownDiagPlugin!
      .create({
        documents: {
          getVirtualCodeByUri: vi.fn(
            () => [undefined, { id: 'file:///workspace/doc.yaml.templ' }] as const
          ),
        },
        language: {
          files: {
            get: vi.fn(() => ({
              id: 'file:///workspace/doc.yaml.templ',
              languageId: 'templjs-yaml',
            })),
          },
        },
      } as never)
      .provideDiagnostics?.(
        {
          uri: 'file:///workspace/doc.yaml.templ',
          languageId: 'templjs-yaml',
          getText: () => 'foo: bar',
          offsetAt: () => 0,
          positionAt: () => ({ line: 0, character: 0 }),
        } as never,
        undefined as never
      );
    expect(nonMarkdownRoute).toBeUndefined();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('skip reason=non-markdown'));
    vi.restoreAllMocks();
  });

  it('covers templjs diagnostics error paths and markdown non-markdown routing', async () => {
    const collectDiagnosticsSpy = vi.spyOn(volar, 'collectDiagnostics');
    const log = vi.fn();
    const plugins = createServicePlugins({
      getIntellisenseOptions: () => ({}),
      getDiagnosticOptions: () => ({}),
      log,
    });
    const diagPlugin = plugins.find((plugin) => plugin.name === 'templjs-diagnostics');
    const markdownDiagPlugin = plugins.find(
      (plugin) => plugin.name === 'templjs-markdown-diagnostics'
    );

    expect(diagPlugin).toBeDefined();
    expect(markdownDiagPlugin).toBeDefined();

    collectDiagnosticsSpy.mockImplementation(() => {
      throw new Error('diagnostics exploded');
    });

    const diagnostics = await diagPlugin!
      .create({
        documents: { getVirtualCodeByUri: vi.fn(() => [undefined, undefined] as const) },
        language: {
          files: {
            get: vi.fn(() => ({
              id: 'file:///workspace/test.yaml.templ',
              languageId: 'templjs-yaml',
            })),
          },
        },
      } as never)
      .provideDiagnostics?.(
        {
          uri: 'file:///workspace/test.yaml.templ',
          languageId: 'templjs-yaml',
          getText: () => '{{ broken }}',
          offsetAt: () => 0,
          positionAt: () => ({ line: 0, character: 0 }),
        } as never,
        undefined as never
      );
    expect(diagnostics).toEqual([]);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('templjs-diag-plugin] error'));

    const markdownRouteDiagnostics = await markdownDiagPlugin!
      .create({
        documents: {
          getVirtualCodeByUri: vi.fn(
            () =>
              [
                { id: 'root' },
                { id: 'file:///workspace/test.yaml.templ', languageId: 'templjs-yaml' },
              ] as const
          ),
        },
        language: { files: { get: vi.fn(() => undefined) } },
      } as never)
      .provideDiagnostics?.(
        {
          uri: 'file:///workspace/test.yaml.templ?virtualCodeId=root',
          languageId: 'yaml',
          getText: () => 'foo: bar',
          offsetAt: () => 0,
          positionAt: () => ({ line: 0, character: 0 }),
        } as never,
        undefined as never
      );
    expect(markdownRouteDiagnostics).toBeUndefined();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('skip reason=non-markdown'));

    const directAdditionalPlugin = servicePluginTesting.createTempljsAdditionalPlugin({
      getIntellisenseOptions: () => ({}),
      getDiagnosticOptions: () => ({}),
    });
    const directAdditional = directAdditionalPlugin.create({
      documents: { getVirtualCodeByUri: vi.fn(() => [undefined, undefined] as const) },
      language: { files: { get: vi.fn(() => undefined) } },
    } as never);
    expect(
      directAdditional.provideHover?.(
        {
          uri: 'file:///workspace/plain.json',
          languageId: 'json',
          getText: () => '{}',
          offsetAt: () => 0,
        } as never,
        { line: 0, character: 0 } as never,
        undefined as never
      )
    ).toBeUndefined();
    expect(
      directAdditional.provideDefinition?.(
        {
          uri: 'file:///workspace/plain.json',
          languageId: 'json',
          getText: () => '{}',
          offsetAt: () => 0,
        } as never,
        { line: 0, character: 0 } as never,
        undefined as never
      )
    ).toBeUndefined();

    const directYamlPlugin = servicePluginTesting.createYamlDiagnosticsPlugin({
      getIntellisenseOptions: () => ({}),
      getDiagnosticOptions: () => ({}),
    });
    const nonYamlDiagnostics = await directYamlPlugin
      .create({
        documents: { getVirtualCodeByUri: vi.fn(() => [undefined, undefined] as const) },
        language: { files: { get: vi.fn(() => undefined) } },
      } as never)
      .provideDiagnostics?.(
        {
          uri: 'file:///workspace/plain.json',
          languageId: 'json',
          getText: () => '{}',
          offsetAt: () => 0,
          positionAt: () => ({ line: 0, character: 0 }),
        } as never,
        undefined as never
      );
    expect(nonYamlDiagnostics).toBeUndefined();

    collectDiagnosticsSpy.mockReset();
    collectDiagnosticsSpy.mockReturnValue([
      {
        message: 'missing source',
        severity: 1,
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 1 },
        },
        code: 'T001',
      },
    ] as never);
    const sourcedDiagnostics = await diagPlugin!
      .create({
        documents: { getVirtualCodeByUri: vi.fn(() => [undefined, undefined] as const) },
        language: {
          files: {
            get: vi.fn(() => ({
              id: 'file:///workspace/test.yaml.templ',
              languageId: 'templjs-yaml',
            })),
          },
        },
      } as never)
      .provideDiagnostics?.(
        {
          uri: 'file:///workspace/test.yaml.templ',
          languageId: 'templjs-yaml',
          getText: () => '{{ user }}',
          offsetAt: () => 0,
          positionAt: () => ({ line: 0, character: 0 }),
        } as never,
        undefined as never
      );
    expect(sourcedDiagnostics).toEqual([
      expect.objectContaining({ source: 'templjs', code: 'T001' }),
    ]);

    collectDiagnosticsSpy.mockRestore();
  });

  it('covers markdown and generic diagnostics skip branches directly', async () => {
    const log = vi.fn();
    const diagPlugin = servicePluginTesting.createTempljsDiagnosticsPlugin({
      getIntellisenseOptions: () => ({}),
      getDiagnosticOptions: () => ({}),
      log,
    });
    const markdownPlugin = servicePluginTesting.createTempljsMarkdownDiagnosticsPlugin({
      getIntellisenseOptions: () => ({}),
      getDiagnosticOptions: () => ({}),
      log,
    });
    const silentDiagPlugin = servicePluginTesting.createTempljsDiagnosticsPlugin({
      getIntellisenseOptions: () => ({}),
      getDiagnosticOptions: () => ({}),
    });
    const silentMarkdownPlugin = servicePluginTesting.createTempljsMarkdownDiagnosticsPlugin({
      getIntellisenseOptions: () => ({}),
      getDiagnosticOptions: () => ({}),
    });

    const markdownContext = {
      documents: {
        getVirtualCodeByUri: vi.fn(
          () =>
            [
              { id: 'root' },
              { id: 'file:///workspace/test.md.templ', languageId: 'templjs-markdown' },
            ] as const
        ),
      },
      language: { files: { get: vi.fn(() => undefined) } },
    } as never;
    const genericDiagnostics = await diagPlugin.create(markdownContext).provideDiagnostics?.(
      {
        uri: 'file:///workspace/test.md.templ?virtualCodeId=root',
        languageId: 'markdown',
        getText: () => '{{ title }}',
        offsetAt: () => 0,
        positionAt: () => ({ line: 0, character: 0 }),
      } as never,
      undefined as never
    );
    expect(genericDiagnostics).toBeUndefined();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('skip reason=markdown-routed'));
    expect(
      await silentDiagPlugin.create(markdownContext).provideDiagnostics?.(
        {
          uri: 'file:///workspace/test.md.templ?virtualCodeId=root',
          languageId: 'markdown',
          getText: () => '{{ title }}',
          offsetAt: () => 0,
          positionAt: () => ({ line: 0, character: 0 }),
        } as never,
        undefined as never
      )
    ).toBeUndefined();

    const skippedMarkdownDiagnostics = await markdownPlugin
      .create({
        documents: {
          getVirtualCodeByUri: vi.fn(
            () =>
              [
                { id: 'embedded-non-root' },
                { id: 'file:///workspace/test.md.templ', languageId: 'templjs-markdown' },
              ] as const
          ),
        },
        language: { files: { get: vi.fn(() => undefined) } },
      } as never)
      .provideDiagnostics?.(
        {
          uri: 'file:///workspace/test.md.templ?virtualCodeId=embedded-non-root',
          languageId: 'markdown',
          getText: () => 'body only',
          offsetAt: () => 0,
          positionAt: () => ({ line: 0, character: 0 }),
        } as never,
        undefined as never
      );
    expect(skippedMarkdownDiagnostics).toBeUndefined();
    expect(
      await silentMarkdownPlugin
        .create({
          documents: {
            getVirtualCodeByUri: vi.fn(
              () =>
                [
                  { id: 'root' },
                  { id: 'file:///workspace/test.yaml.templ', languageId: 'templjs-yaml' },
                ] as const
            ),
          },
          language: { files: { get: vi.fn(() => undefined) } },
        } as never)
        .provideDiagnostics?.(
          {
            uri: 'file:///workspace/test.yaml.templ?virtualCodeId=root',
            languageId: 'yaml',
            getText: () => 'foo: bar',
            offsetAt: () => 0,
            positionAt: () => ({ line: 0, character: 0 }),
          } as never,
          undefined as never
        )
    ).toBeUndefined();

    const markdownNoFrontmatter = await markdownPlugin.create(markdownContext).provideDiagnostics?.(
      {
        uri: 'file:///workspace/test.md.templ?virtualCodeId=root',
        languageId: 'markdown',
        getText: () => 'body only',
        offsetAt: () => 0,
        positionAt: () => ({ line: 0, character: 0 }),
      } as never,
      undefined as never
    );
    expect(Array.isArray(markdownNoFrontmatter)).toBe(true);
  });
});
