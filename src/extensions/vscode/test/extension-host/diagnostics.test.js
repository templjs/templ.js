/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const path = require('node:path');
const assert = require('node:assert');
const vscode = require('vscode');

const FIXTURES_DIR = path.resolve(__dirname, '../../test-fixtures');

function fixtureUri(filename) {
  return vscode.Uri.file(path.join(FIXTURES_DIR, filename));
}

async function waitForDiagnostics(
  uri,
  { timeoutMs = 10_000, pollMs = 300, stabilityRounds = 3 } = {}
) {
  const deadline = Date.now() + timeoutMs;
  let lastJson = '';
  let stableCount = 0;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollMs));
    const diags = vscode.languages.getDiagnostics(uri);
    const json = JSON.stringify(diags.map((d) => ({ msg: d.message, src: d.source })));

    if (json === lastJson) {
      stableCount += 1;
      if (stableCount >= stabilityRounds) {
        return diags;
      }
    } else {
      lastJson = json;
      stableCount = 1;
    }
  }

  return vscode.languages.getDiagnostics(uri);
}

suite('Extension Host Diagnostics', () => {
  test('language association is correct across markdown/html/json/yaml template files', async function () {
    this.timeout(20_000);

    const expected = new Map([
      ['example.md.tmpl', 'templjs-markdown'],
      ['invalid_example.md.tmpl', 'templjs-markdown'],
      ['index.html.tmpl', 'templjs-html'],
      ['config.json.tmpl', 'templjs-json'],
      ['deploy.yaml.tmpl', 'templjs-yaml'],
      ['invalid_example.yaml.tmpl', 'templjs-yaml'],
    ]);

    for (const [filename, languageId] of expected) {
      const doc = await vscode.workspace.openTextDocument(fixtureUri(filename));
      assert.strictEqual(
        doc.languageId,
        languageId,
        `Expected '${filename}' languageId '${languageId}', got '${doc.languageId}'`
      );
    }
  });

  test('deploy.yaml.tmpl (valid) produces no templjs diagnostics', async function () {
    this.timeout(20_000);

    const uri = fixtureUri('deploy.yaml.tmpl');
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc);

    const diags = await waitForDiagnostics(uri);
    const templjsDiags = diags.filter((d) => d.source === 'templjs');

    assert.strictEqual(
      templjsDiags.length,
      0,
      `Expected 0 templjs diagnostics for deploy.yaml.tmpl, got ${templjsDiags.length}: ${JSON.stringify(templjsDiags.map((d) => d.message))}`
    );
  });

  test('example.md.tmpl (valid) produces no templjs diagnostics', async function () {
    this.timeout(20_000);

    const uri = fixtureUri('example.md.tmpl');
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc);

    const diags = await waitForDiagnostics(uri);
    const templjsDiags = diags.filter((d) => d.source === 'templjs');

    assert.strictEqual(
      templjsDiags.length,
      0,
      `Expected 0 templjs diagnostics for example.md.tmpl, got ${templjsDiags.length}: ${JSON.stringify(templjsDiags.map((d) => d.message))}`
    );
  });
});
