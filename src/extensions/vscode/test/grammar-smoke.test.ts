import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

type InjectionGrammar = {
  patterns: Array<{ include?: string }>;
  repository: {
    embeddedMarkdown?: {
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
