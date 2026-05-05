import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Registry, parseRawGrammar } from 'vscode-textmate';
import { createOnigScanner, createOnigString, loadWASM } from 'vscode-oniguruma';

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
    scopes: { templjs: templjs.scopeName, md: md.scopeName, yaml: yaml.scopeName },
  };
}

function lineScopes(
  grammar: NonNullable<Awaited<ReturnType<Registry['loadGrammar']>>>,
  line: string
) {
  const tokenized = grammar.tokenizeLine(line);
  return tokenized.tokens.map((token) => token.scopes.join(' '));
}

describe('textmate-harness', () => {
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
});
