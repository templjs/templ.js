import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type JsonRecord = Record<string, unknown>;

function readJson(relativePath: string): JsonRecord {
  const url = new URL(relativePath, import.meta.url);
  const content = readFileSync(url, 'utf8');
  return JSON.parse(content) as JsonRecord;
}

const vscodePackage = readJson('../../../extensions/vscode/package.json');
const baseGrammar = readJson('../../../extensions/vscode/syntaxes/templjs.tmLanguage.json');
const markdownInjection = readJson('../../../extensions/vscode/syntaxes/injection-markdown.json');
const htmlInjection = readJson('../../../extensions/vscode/syntaxes/injection-html.json');
const jsonInjection = readJson('../../../extensions/vscode/syntaxes/injection-json.json');
const yamlInjection = readJson('../../../extensions/vscode/syntaxes/injection-yaml.json');

const injectionCases = [
  {
    name: 'markdown',
    grammar: markdownInjection,
    scopeName: 'text.templjs.markdown',
    baseScope: 'text.html.markdown',
    language: 'templjs-markdown',
    path: './syntaxes/injection-markdown.json',
    embeddedScope: 'meta.embedded.block.markdown',
    embeddedLanguage: 'markdown',
  },
  {
    name: 'html',
    grammar: htmlInjection,
    scopeName: 'text.templjs.html',
    baseScope: 'text.html.basic',
    language: 'templjs-html',
    path: './syntaxes/injection-html.json',
    embeddedScope: 'meta.embedded.block.html',
    embeddedLanguage: 'html',
  },
  {
    name: 'json',
    grammar: jsonInjection,
    scopeName: 'text.templjs.json',
    baseScope: 'source.json',
    language: 'templjs-json',
    path: './syntaxes/injection-json.json',
    embeddedScope: 'meta.embedded.block.json',
    embeddedLanguage: 'json',
  },
  {
    name: 'yaml',
    grammar: yamlInjection,
    scopeName: 'text.templjs.yaml',
    baseScope: 'source.yaml',
    language: 'templjs-yaml',
    path: './syntaxes/injection-yaml.json',
    embeddedScope: 'meta.embedded.block.yaml',
    embeddedLanguage: 'yaml',
  },
] as const;

describe('TextMateGrammarIntegration', () => {
  it('parses the base template grammar', () => {
    expect(baseGrammar.scopeName).toBe('source.templjs');
  });

  it.each(injectionCases)('parses $name injection grammar', ({ grammar, scopeName }) => {
    expect(grammar.scopeName).toBe(scopeName);
  });

  it('includes statement, expression, and comment pattern references', () => {
    const patterns = baseGrammar.patterns as Array<{ include: string }>;
    const includes = patterns.map((pattern) => pattern.include);
    expect(includes).toContain('#comment');
    expect(includes).toContain('#statement');
    expect(includes).toContain('#expression');
  });

  it('uses template delimiter punctuation scope', () => {
    const repository = baseGrammar.repository as Record<string, JsonRecord>;
    const statement = repository.statement;
    const beginCaptures = statement.beginCaptures as Record<string, { name: string }>;
    expect(beginCaptures['0'].name).toBe('punctuation.definition.template');
  });

  it('uses keyword scope for control statements', () => {
    const repository = baseGrammar.repository as Record<string, JsonRecord>;
    const statement = repository.statement;
    const patterns = statement.patterns as Array<{ name?: string }>;
    expect(patterns.some((pattern) => pattern.name === 'keyword.control.template')).toBe(true);
  });

  it('uses variable scope for expressions', () => {
    const repository = baseGrammar.repository as Record<string, JsonRecord>;
    const expression = repository.expression;
    const patterns = expression.patterns as Array<{ name?: string }>;
    expect(patterns.some((pattern) => pattern.name === 'variable.other.template')).toBe(true);
  });

  it('uses function scope for filters', () => {
    const repository = baseGrammar.repository as Record<string, JsonRecord>;
    const expression = repository.expression;
    const patterns = expression.patterns as Array<{
      captures?: Record<string, { name: string }>;
    }>;
    expect(
      patterns.some((pattern) => pattern.captures?.['1']?.name === 'support.function.template')
    ).toBe(true);
  });

  it('uses block comment scope for template comments', () => {
    const repository = baseGrammar.repository as Record<string, JsonRecord>;
    const comment = repository.comment;
    expect(comment.name).toBe('comment.block.template');
  });

  it('supports quoted string scopes', () => {
    const repository = baseGrammar.repository as Record<string, JsonRecord>;
    const expression = repository.expression;
    const patterns = expression.patterns as Array<{ name?: string }>;
    expect(patterns.some((pattern) => pattern.name === 'string.quoted.double.template')).toBe(true);
    expect(patterns.some((pattern) => pattern.name === 'string.quoted.single.template')).toBe(true);
  });

  it.each(injectionCases)(
    'injects $name and template scopes together',
    ({ grammar, baseScope }) => {
      const patterns = grammar.patterns as Array<{ include: string }>;
      const includes = patterns.map((pattern) => pattern.include);
      expect(includes).toContain(baseScope);
      expect(includes).toContain('source.templjs');
    }
  );

  it('anchors markdown frontmatter begin to document start', () => {
    const repository = markdownInjection.repository as Record<string, JsonRecord>;
    const frontmatter = repository.frontmatter;
    expect(frontmatter.begin).toBe('\\A---\\s*$');
  });

  it('contributes a base grammar registration in extension manifest', () => {
    const contributes = vscodePackage.contributes as JsonRecord;
    const grammars = contributes.grammars as Array<JsonRecord>;
    expect(grammars.some((grammar) => grammar.scopeName === 'source.templjs')).toBe(true);
  });

  it.each(injectionCases)('contributes $name grammar mapping', ({ language, path }) => {
    const contributes = vscodePackage.contributes as JsonRecord;
    const grammars = contributes.grammars as Array<JsonRecord>;
    const grammar = grammars.find((item) => item.language === language);
    expect(grammar?.path).toBe(path);
  });

  it.each(injectionCases)(
    'declares embedded language mapping for $name',
    ({ language, embeddedScope, embeddedLanguage }) => {
      const contributes = vscodePackage.contributes as JsonRecord;
      const grammars = contributes.grammars as Array<JsonRecord>;
      const grammar = grammars.find((item) => item.language === language) as JsonRecord;
      const embeddedLanguages = grammar.embeddedLanguages as Record<string, string>;
      expect(embeddedLanguages[embeddedScope]).toBe(embeddedLanguage);
    }
  );
});
