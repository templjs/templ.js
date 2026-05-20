import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Registry, parseRawGrammar } from 'vscode-textmate';
import { createOnigScanner, createOnigString, loadWASM } from 'vscode-oniguruma';

const require = createRequire(import.meta.url);
const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let wasmLoaded = false;

async function ensureOnigurumaLoaded(): Promise<void> {
  if (wasmLoaded) {
    return;
  }

  const wasmPath = require.resolve('vscode-oniguruma/release/onig.wasm');
  const wasmBin = readFileSync(wasmPath).buffer;
  await loadWASM(wasmBin);
  wasmLoaded = true;
}

async function createRegistry() {
  await ensureOnigurumaLoaded();

  const grammars = new Map<string, ReturnType<typeof parseRawGrammar>>();

  const load = (fileName: string) => {
    const fullPath = path.join(extensionRoot, 'syntaxes', fileName);
    const content = readFileSync(fullPath, 'utf8');
    return parseRawGrammar(content, fullPath);
  };

  const templjs = load('templjs.tmLanguage.json');
  const md = load('injection-markdown.json');
  const yaml = load('injection-yaml.json');
  const json = load('injection-json.json');
  const html = load('injection-html.json');

  grammars.set(templjs.scopeName, templjs);
  grammars.set(md.scopeName, md);
  grammars.set(yaml.scopeName, yaml);
  grammars.set(json.scopeName, json);
  grammars.set(html.scopeName, html);

  const registry = new Registry({
    onigLib: Promise.resolve({
      createOnigScanner,
      createOnigString,
    }),
    loadGrammar: async (scopeName) => grammars.get(scopeName) ?? null,
  });

  return {
    registry,
    scopes: {
      templjs: templjs.scopeName,
      md: md.scopeName,
      yaml: yaml.scopeName,
      json: json.scopeName,
      html: html.scopeName,
    },
  };
}

function lineScopes(
  grammar: NonNullable<Awaited<ReturnType<Registry['loadGrammar']>>>,
  line: string
) {
  const tokenized = grammar.tokenizeLine(line);
  return tokenized.tokens.map((token) => token.scopes.join(' '));
}

function getEmbeddedLanguageMappings(): Record<string, string | undefined> {
  const manifestPath = path.join(extensionRoot, 'package.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    contributes?: {
      grammars?: Array<{
        language?: string;
        embeddedLanguages?: Record<string, string>;
      }>;
    };
  };

  const mappings: Record<string, string | undefined> = {};
  for (const grammar of manifest.contributes?.grammars ?? []) {
    if (!grammar.language || !grammar.embeddedLanguages) {
      continue;
    }

    for (const [embeddedScope, languageId] of Object.entries(grammar.embeddedLanguages)) {
      mappings[embeddedScope] = languageId;
    }
  }

  return mappings;
}

describe('textmate-harness', () => {
  it('keeps host-language embedded block scopes live for markdown/html/json/yaml injections', async () => {
    const { registry, scopes } = await createRegistry();
    const embeddedLanguageMappings = getEmbeddedLanguageMappings();
    const cases: Array<{
      scopeName: string;
      line: string;
      expectedEmbeddedScope: string;
      expectedLanguageId: string;
    }> = [
      {
        scopeName: scopes.md,
        line: 'title: {% if show_title %}{{ title }}{% endif %}',
        expectedEmbeddedScope: 'meta.embedded.block.markdown',
        expectedLanguageId: 'markdown',
      },
      {
        scopeName: scopes.html,
        line: '<p>{% if show_title %}{{ title }}{% endif %}</p>',
        expectedEmbeddedScope: 'meta.embedded.block.html',
        expectedLanguageId: 'html',
      },
      {
        scopeName: scopes.json,
        line: '"title": "{% if show_title %}{{ title }}{% endif %}"',
        expectedEmbeddedScope: 'meta.embedded.block.json',
        expectedLanguageId: 'json',
      },
      {
        scopeName: scopes.yaml,
        line: 'title: {% if show_title %}{{ title }}{% endif %}',
        expectedEmbeddedScope: 'meta.embedded.block.yaml',
        expectedLanguageId: 'yaml',
      },
    ];

    for (const testCase of cases) {
      const grammar = await registry.loadGrammar(testCase.scopeName);
      expect(grammar).toBeDefined();

      const scopesForLine = lineScopes(grammar!, testCase.line);
      expect(
        scopesForLine.some((scope) => scope.includes(testCase.expectedEmbeddedScope)),
        `Expected ${testCase.expectedEmbeddedScope} in ${testCase.scopeName}`
      ).toBe(true);
      expect(embeddedLanguageMappings[testCase.expectedEmbeddedScope]).toBe(
        testCase.expectedLanguageId
      );
    }
  });

  it('tokenizes templjs statements in yaml host grammar', async () => {
    const { registry, scopes } = await createRegistry();
    const grammar = await registry.loadGrammar(scopes.yaml);
    expect(grammar).toBeDefined();

    const scopesForLine = lineScopes(grammar!, '{% for c in id %}');
    expect(scopesForLine.some((scope) => scope.includes('meta.embedded.block.yaml'))).toBe(true);
    expect(scopesForLine.some((scope) => scope.includes('meta.block.template'))).toBe(true);
    expect(scopesForLine.some((scope) => scope.includes('keyword.control.template'))).toBe(true);
  });

  it('tokenizes markdown frontmatter templjs before yaml host scalar parsing', async () => {
    const { registry, scopes } = await createRegistry();
    const grammar = await registry.loadGrammar(scopes.md);
    expect(grammar).toBeDefined();

    const scopesForLine = lineScopes(grammar!, 'invalid: bar: [{% if true %}foo{% endif %}]');
    expect(scopesForLine.some((scope) => scope.includes('meta.embedded.block.markdown'))).toBe(
      true
    );
    expect(scopesForLine.some((scope) => scope.includes('meta.block.template'))).toBe(true);
    expect(scopesForLine.some((scope) => scope.includes('keyword.control.template'))).toBe(true);
  });

  it('keeps inline template expression tokenization active in yaml host scalar lines', async () => {
    const { registry, scopes } = await createRegistry();
    const grammar = await registry.loadGrammar(scopes.yaml);
    expect(grammar).toBeDefined();

    const scopesForLine = lineScopes(grammar!, 'title: {{ user.name }}');
    expect(scopesForLine.some((scope) => scope.includes('meta.embedded.block.yaml'))).toBe(true);
    expect(scopesForLine.some((scope) => scope.includes('meta.expression.template'))).toBe(true);
    expect(scopesForLine.some((scope) => scope.includes('punctuation.definition.template'))).toBe(
      true
    );
  });

  it('keeps inline template expression tokenization active in markdown frontmatter lines', async () => {
    const { registry, scopes } = await createRegistry();
    const grammar = await registry.loadGrammar(scopes.md);
    expect(grammar).toBeDefined();

    const scopesForLine = lineScopes(grammar!, 'title: {{ user.name }}');
    expect(scopesForLine.some((scope) => scope.includes('meta.embedded.block.markdown'))).toBe(
      true
    );
    expect(scopesForLine.some((scope) => scope.includes('meta.expression.template'))).toBe(true);
    expect(scopesForLine.some((scope) => scope.includes('punctuation.definition.template'))).toBe(
      true
    );
  });
});
