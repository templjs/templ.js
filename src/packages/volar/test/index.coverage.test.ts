import { describe, expect, it, vi } from 'vitest';
import { URI } from 'vscode-uri';
import {
  cleanTemplateContent,
  createTempljsLanguagePlugin,
  default as volarDefault,
  version,
} from '../src/index.js';

function createSnapshot(
  text: string,
  changeRange?: { span: { start: number; length: number }; newLength: number }
) {
  return {
    getText: (start: number, end?: number) => text.slice(start, end ?? text.length),
    getLength: () => text.length,
    getChangeRange: () => changeRange,
  };
}

describe('volar index coverage branches', () => {
  it('exports version and default factory consistently', () => {
    expect(volarDefault.version).toBe(version);
    expect(typeof volarDefault.createTempljsLanguagePlugin).toBe('function');
    const snapshot = createTempljsLanguagePlugin().createVirtualCode(
      URI.parse('file:///plain.txt.templ'),
      'templjs-plain',
      createSnapshot('plain text') as never,
      {} as never
    );
    expect(snapshot.snapshot.getText(0)).toBe('plain text');
    expect(snapshot.snapshot.getChangeRange()).toBeUndefined();
  });

  it('cleans template content via tokenizer-only path', async () => {
    const cleaned = cleanTemplateContent('Hello {{ name }}\n{% if ok %}\nHi\n{% endif %}');
    expect(cleaned.cleaned).not.toContain('{{');
    expect(cleaned.originalToCleanedOffsets).toHaveLength(
      'Hello {{ name }}\n{% if ok %}\nHi\n{% endif %}'.length + 1
    );

    vi.resetModules();
    vi.doMock('@templjs/core', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@templjs/core')>();
      return {
        ...actual,
        tokenize: () => {
          throw new Error('boom');
        },
      };
    });

    const mod = await import('../src/index.js');
    expect(() => mod.cleanTemplateContent('plain text')).toThrow('boom');
  });

  it('applies trim-marker semantics to adjacent whitespace in cleaned content', () => {
    const source = 'A\n{%- if show -%}\nB';
    const cleaned = cleanTemplateContent(source);

    expect(cleaned.cleaned).toBe('A\n               \nB');
    expect(cleaned.originalToCleanedOffsets).toHaveLength(source.length + 1);
  });

  it('supports expression padding-character override in preserve-width mode', () => {
    const source = 'A {{x}} B {% if ok %} C';
    const cleaned = cleanTemplateContent(source, undefined, {
      expressionPaddingCharacter: '_',
    });

    const expressionStart = source.indexOf('{{x}}');
    const statementStart = source.indexOf('{% if ok %}');

    expect(cleaned.cleaned.slice(expressionStart, expressionStart + '{{x}}'.length)).toBe('_____');
    expect(cleaned.cleaned.slice(statementStart, statementStart + '{% if ok %}'.length)).toBe(
      ' '.repeat('{% if ok %}'.length)
    );
  });

  it('supports expression padding-character override in text-only mode', () => {
    const source = ['## Subtitle', '{{ x }}', '', '```yaml', 'key: value', '```'].join('\n');
    const cleaned = cleanTemplateContent(source, undefined, {
      mode: 'text-only',
      expressionPaddingCharacter: '_',
    });

    // The whole expression is represented by a single padding char.
    expect(cleaned.cleaned.split('\n')[1]).toBe('_');
  });

  it('suppresses trimmed whitespace from trim markers in text-only mode', () => {
    // -%} trims the whitespace (including blank lines) that follows.
    const source = [
      '## Subtitle',
      '{% set collection = ["a", "b", "c"] -%}',
      '{% for x in collection -%}',
      '',
      '{{ x }}',
      '',
      '```yaml',
    ].join('\n');
    const cleaned = cleanTemplateContent(source, undefined, {
      mode: 'text-only',
      expressionPaddingCharacter: '_',
    });
    const lines = cleaned.cleaned.split('\n');
    // All three non-text lines (set, for, blank) collapse: expression appears immediately after heading.
    expect(lines[0]).toBe('## Subtitle');
    expect(lines[1]).toBe('_'); // {{ x }}
    expect(lines[2]).toBe(''); // blank line after {{ x }}
    expect(lines[3]).toBe('```yaml');
  });

  it('returns undefined for unsupported language ids and rebuilds virtual code from a non-templjs cache entry', () => {
    const plugin = createTempljsLanguagePlugin();
    expect(plugin.getLanguageId(URI.parse('file:///note.txt'))).toBeUndefined();
    expect(plugin.getLanguageId(URI.parse('file:///config.yaml.templ'))).toBe('templjs-yaml');
    expect(plugin.getLanguageId(URI.parse('file:///config.json.templ'))).toBe('templjs-json');
    expect(plugin.getLanguageId(URI.parse('file:///readme.md.templ'))).toBe('templjs-markdown');
    expect(plugin.getLanguageId(URI.parse('file:///page.html.templ'))).toBe('templjs-html');

    const first = plugin.createVirtualCode(
      URI.parse('file:///page.md.templ'),
      'templjs-markdown',
      createSnapshot('Hello {{ name }}') as never,
      {} as never
    );
    const onlyTemplate = plugin.createVirtualCode(
      URI.parse('file:///page.md.templ'),
      'templjs-markdown',
      createSnapshot('{{ name }}') as never,
      {} as never
    );
    const onlyTemplateHost = onlyTemplate.embeddedCodes.find((code) => code.id === 'host.markdown');
    expect(onlyTemplateHost?.mappings).toEqual([
      expect.objectContaining({
        sourceOffsets: [0],
        generatedOffsets: [0],
      }),
    ]);
    expect(
      createTempljsLanguagePlugin().createVirtualCode(
        URI.parse('file:///page.html.tpl'),
        'templjs-html',
        createSnapshot('<div>{{ user }}</div>') as never,
        {} as never
      ).languageId
    ).toBe('html');
    expect(
      createTempljsLanguagePlugin().createVirtualCode(
        URI.parse('file:///page.json.templ'),
        'templjs-json',
        createSnapshot('{"name": "{{ user }}"}') as never,
        {} as never
      ).languageId
    ).toBe('json');
    const updated = plugin.updateVirtualCode(
      URI.parse('file:///page.md.templ'),
      {
        id: 'other',
        languageId: 'markdown',
        snapshot: first.snapshot,
        mappings: [],
        embeddedCodes: [],
      } as never,
      createSnapshot('Hello {{ user.name }}') as never,
      {} as never
    );

    expect(updated.id).toBe('root');
    expect(updated.languageId).toBe('markdown');
  });

  it('creates fallback mappings when no preserved ranges exist and honors custom delimiters', () => {
    const plugin = createTempljsLanguagePlugin({
      delimiters: {
        statementStart: '<%',
        statementEnd: '%>',
        expressionStart: '<<',
        expressionEnd: '>>',
        commentStart: '<#',
        commentEnd: '#>',
      },
    });

    const code = plugin.createVirtualCode(
      URI.parse('file:///page.md.templ'),
      'templjs-markdown',
      createSnapshot('<% if ok %><< value >><% endif %>') as never,
      {} as never
    ) as {
      languageId: string;
      createMappings: (
        text: string,
        languageId: string,
        offsets: [number, number, number, number]
      ) => Array<{
        sourceOffsets: number[];
        generatedOffsets: number[];
        lengths: number[];
      }>;
    };

    expect(code.languageId).toBe('markdown');
    expect(code.createMappings('abc', 'x', [0, 0, 0, 0])).toEqual([
      expect.objectContaining({
        sourceOffsets: [0],
        generatedOffsets: [0],
        lengths: [1],
      }),
    ]);
    const cleaned = cleanTemplateContent('<% if ok %><< value >><% endif %>', {
      statementStart: '<%',
      statementEnd: '%>',
      expressionStart: '<<',
      expressionEnd: '>>',
      commentStart: '<#',
      commentEnd: '#>',
    });
    expect(cleaned.cleaned).toHaveLength('<% if ok %><< value >><% endif %>'.length);
    expect(cleaned.cleaned).not.toContain('<%');
  });

  it('preserves CRLF characters when tokenizer-based cleaning replaces template tokens', async () => {
    vi.resetModules();
    vi.doMock('@templjs/core', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@templjs/core')>();
      return {
        ...actual,
        tokenize: () => [
          {
            type: actual.TokenType.EXPRESSION,
            start: { line: 1, column: 0 },
            end: { line: 2, column: 1 },
          },
        ],
      };
    });

    const mod = await import('../src/index.js');
    const cleaned = mod.cleanTemplateContent('a\r\nb');
    expect(cleaned.cleaned).toBe(' \r\n ');
  });
});
