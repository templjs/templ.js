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

describe('TextMate Grammar Integration', () => {
  it('parses the base template grammar', () => {
    expect(baseGrammar.scopeName).toBe('source.templjs');
  });

  it('parses markdown injection grammar', () => {
    expect(markdownInjection.scopeName).toBe('text.templjs.markdown');
  });

  it('parses html injection grammar', () => {
    expect(htmlInjection.scopeName).toBe('text.templjs.html');
  });

  it('parses json injection grammar', () => {
    expect(jsonInjection.scopeName).toBe('text.templjs.json');
  });

  it('parses yaml injection grammar', () => {
    expect(yamlInjection.scopeName).toBe('text.templjs.yaml');
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
    const patterns = expression.patterns as Array<{ captures?: Record<string, { name: string }> }>;
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

  it('injects markdown and template scopes together', () => {
    const patterns = markdownInjection.patterns as Array<{ include: string }>;
    const includes = patterns.map((pattern) => pattern.include);
    expect(includes).toContain('source.gfm');
    expect(includes).toContain('source.templjs');
  });

  it('injects html and template scopes together', () => {
    const patterns = htmlInjection.patterns as Array<{ include: string }>;
    const includes = patterns.map((pattern) => pattern.include);
    expect(includes).toContain('text.html.basic');
    expect(includes).toContain('source.templjs');
  });

  it('injects json and template scopes together', () => {
    const patterns = jsonInjection.patterns as Array<{ include: string }>;
    const includes = patterns.map((pattern) => pattern.include);
    expect(includes).toContain('source.json');
    expect(includes).toContain('source.templjs');
  });

  it('injects yaml and template scopes together', () => {
    const patterns = yamlInjection.patterns as Array<{ include: string }>;
    const includes = patterns.map((pattern) => pattern.include);
    expect(includes).toContain('source.yaml');
    expect(includes).toContain('source.templjs');
  });

  it('contributes a base grammar registration in extension manifest', () => {
    const contributes = vscodePackage.contributes as JsonRecord;
    const grammars = contributes.grammars as Array<JsonRecord>;
    expect(grammars.some((grammar) => grammar.scopeName === 'source.templjs')).toBe(true);
  });

  it('contributes markdown grammar mapping', () => {
    const contributes = vscodePackage.contributes as JsonRecord;
    const grammars = contributes.grammars as Array<JsonRecord>;
    const grammar = grammars.find((item) => item.language === 'templjs-markdown');
    expect(grammar?.path).toBe('./syntaxes/injection-markdown.json');
  });

  it('contributes html grammar mapping', () => {
    const contributes = vscodePackage.contributes as JsonRecord;
    const grammars = contributes.grammars as Array<JsonRecord>;
    const grammar = grammars.find((item) => item.language === 'templjs-html');
    expect(grammar?.path).toBe('./syntaxes/injection-html.json');
  });

  it('contributes json grammar mapping', () => {
    const contributes = vscodePackage.contributes as JsonRecord;
    const grammars = contributes.grammars as Array<JsonRecord>;
    const grammar = grammars.find((item) => item.language === 'templjs-json');
    expect(grammar?.path).toBe('./syntaxes/injection-json.json');
  });

  it('contributes yaml grammar mapping', () => {
    const contributes = vscodePackage.contributes as JsonRecord;
    const grammars = contributes.grammars as Array<JsonRecord>;
    const grammar = grammars.find((item) => item.language === 'templjs-yaml');
    expect(grammar?.path).toBe('./syntaxes/injection-yaml.json');
  });

  it('declares embedded language mapping for markdown', () => {
    const contributes = vscodePackage.contributes as JsonRecord;
    const grammars = contributes.grammars as Array<JsonRecord>;
    const grammar = grammars.find((item) => item.language === 'templjs-markdown') as JsonRecord;
    const embeddedLanguages = grammar.embeddedLanguages as Record<string, string>;
    expect(embeddedLanguages['meta.embedded.block.markdown']).toBe('markdown');
  });

  it('declares embedded language mapping for html', () => {
    const contributes = vscodePackage.contributes as JsonRecord;
    const grammars = contributes.grammars as Array<JsonRecord>;
    const grammar = grammars.find((item) => item.language === 'templjs-html') as JsonRecord;
    const embeddedLanguages = grammar.embeddedLanguages as Record<string, string>;
    expect(embeddedLanguages['meta.embedded.block.html']).toBe('html');
  });

  it('declares embedded language mapping for json', () => {
    const contributes = vscodePackage.contributes as JsonRecord;
    const grammars = contributes.grammars as Array<JsonRecord>;
    const grammar = grammars.find((item) => item.language === 'templjs-json') as JsonRecord;
    const embeddedLanguages = grammar.embeddedLanguages as Record<string, string>;
    expect(embeddedLanguages['meta.embedded.block.json']).toBe('json');
  });

  it('declares embedded language mapping for yaml', () => {
    const contributes = vscodePackage.contributes as JsonRecord;
    const grammars = contributes.grammars as Array<JsonRecord>;
    const grammar = grammars.find((item) => item.language === 'templjs-yaml') as JsonRecord;
    const embeddedLanguages = grammar.embeddedLanguages as Record<string, string>;
    expect(embeddedLanguages['meta.embedded.block.yaml']).toBe('yaml');
  });
});
