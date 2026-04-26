import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

type InjectionGrammar = {
  patterns: Array<{ include?: string }>;
  repository: {
    embeddedHtml?: {
      patterns?: Array<{ include?: string }>;
    };
    embeddedJson?: {
      patterns?: Array<{ include?: string }>;
    };
    embeddedMarkdown?: {
      patterns?: Array<{ include?: string }>;
    };
    embeddedYaml?: {
      patterns?: Array<{ include?: string }>;
    };
    frontmatter?: {
      begin: string;
      end: string;
    };
  };
};

type TempljsGrammar = {
  repository: {
    expression?: { begin: string; end: string };
    statement?: { begin: string; end: string };
    comment?: { begin: string; end: string };
  };
};

describe('grammar-smoke-md-tmpl', () => {
  it('includes frontmatter, markdown host grammar, and templjs grammar in markdown injection', () => {
    const grammarPath = path.join(extensionRoot, 'syntaxes/injection-markdown.json');
    const grammar = JSON.parse(readFileSync(grammarPath, 'utf-8')) as InjectionGrammar;

    expect(grammar.patterns.map((pattern) => pattern.include)).toEqual(
      expect.arrayContaining(['text.html.markdown', '#embeddedMarkdown', 'source.templjs'])
    );

    expect(
      grammar.repository.embeddedMarkdown?.patterns?.map((pattern) => pattern.include)
    ).toEqual(expect.arrayContaining(['#frontmatter', 'text.html.markdown']));

    expect(grammar.repository.frontmatter?.begin).toBe('\\A---\\s*$');
    expect(grammar.repository.frontmatter?.end).toBe('^---\\s*$');
  });

  it('places embedded wrappers before host includes for embedded language routing', () => {
    const markdownGrammar = JSON.parse(
      readFileSync(path.join(extensionRoot, 'syntaxes/injection-markdown.json'), 'utf-8')
    ) as InjectionGrammar;
    const htmlGrammar = JSON.parse(
      readFileSync(path.join(extensionRoot, 'syntaxes/injection-html.json'), 'utf-8')
    ) as InjectionGrammar;
    const jsonGrammar = JSON.parse(
      readFileSync(path.join(extensionRoot, 'syntaxes/injection-json.json'), 'utf-8')
    ) as InjectionGrammar;
    const yamlGrammar = JSON.parse(
      readFileSync(path.join(extensionRoot, 'syntaxes/injection-yaml.json'), 'utf-8')
    ) as InjectionGrammar;

    expect(markdownGrammar.patterns.map((pattern) => pattern.include).slice(0, 2)).toEqual([
      '#embeddedMarkdown',
      'text.html.markdown',
    ]);
    expect(htmlGrammar.patterns.map((pattern) => pattern.include).slice(0, 2)).toEqual([
      '#embeddedHtml',
      'text.html.basic',
    ]);
    expect(jsonGrammar.patterns.map((pattern) => pattern.include).slice(0, 2)).toEqual([
      '#embeddedJson',
      'source.json',
    ]);
    expect(yamlGrammar.patterns.map((pattern) => pattern.include).slice(0, 2)).toEqual([
      '#embeddedYaml',
      'source.yaml',
    ]);
  });

  it('defines templjs token delimiters used by markdown injection', () => {
    const grammarPath = path.join(extensionRoot, 'syntaxes/templjs.tmLanguage.json');
    const grammar = JSON.parse(readFileSync(grammarPath, 'utf-8')) as TempljsGrammar;

    expect(grammar.repository.expression?.begin).toBe('\\{\\{');
    expect(grammar.repository.expression?.end).toBe('\\}\\}');
    expect(grammar.repository.statement?.begin).toBe('\\{%');
    expect(grammar.repository.statement?.end).toBe('%\\}');
    expect(grammar.repository.comment?.begin).toBe('\\{#');
    expect(grammar.repository.comment?.end).toBe('#\\}');
  });
});
