/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const path = require('node:path');
const assert = require('node:assert');
const vscode = require('vscode');

const FIXTURES_DIR = path.resolve(__dirname, '../../test-fixtures');

function fixtureUri(filename) {
  return vscode.Uri.file(path.join(FIXTURES_DIR, filename));
}

async function replaceDocumentText(editor, text) {
  const doc = editor.document;
  const start = new vscode.Position(0, 0);
  const end = doc.positionAt(doc.getText().length);
  const wholeRange = new vscode.Range(start, end);

  const updated = await editor.edit((editBuilder) => {
    editBuilder.replace(wholeRange, text);
  });

  assert.strictEqual(updated, true, 'Expected document edit to succeed');
  await doc.save();
}

function positionAtSubstring(doc, substring, offsetInSubstring = 0) {
  const idx = doc.getText().indexOf(substring);
  assert.ok(idx >= 0, `Substring not found in document: ${substring}`);
  return doc.positionAt(idx + offsetInSubstring);
}

async function withWorkspaceSchemaPath(schemaPath, fn) {
  const config = vscode.workspace.getConfiguration('templjs');
  const previous = config.get('schemaPath');

  await config.update('schemaPath', schemaPath, vscode.ConfigurationTarget.Workspace);

  try {
    await fn();
  } finally {
    await config.update('schemaPath', previous ?? '', vscode.ConfigurationTarget.Workspace);
  }
}

function positionAtMarker(doc, marker, cursorDelta = 0) {
  const idx = doc.getText().indexOf(marker);
  assert.ok(idx >= 0, `Marker not found in document: ${marker}`);
  return doc.positionAt(idx + marker.length + cursorDelta);
}

async function completionItemsAt(doc, position) {
  const result = await vscode.commands.executeCommand(
    'vscode.executeCompletionItemProvider',
    doc.uri,
    position
  );
  return result?.items ?? [];
}

function completionLabel(item) {
  return typeof item.label === 'string' ? item.label : String(item.label?.label ?? '');
}

function completionDetail(item) {
  return typeof item.detail === 'string' ? item.detail : '';
}

async function waitForCompletionItems(
  doc,
  position,
  predicate,
  { timeoutMs = 12_000, pollMs = 300 } = {}
) {
  const deadline = Date.now() + timeoutMs;
  let last = [];

  while (Date.now() < deadline) {
    last = await completionItemsAt(doc, position);
    if (predicate(last)) {
      return last;
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  return last;
}

function positionAfterInPrefix(doc, needle) {
  const idx = doc.getText().indexOf(needle);
  assert.ok(idx >= 0, `Needle not found in document: ${needle}`);
  return doc.positionAt(idx + needle.length);
}

function flattenHoverContents(contents) {
  const toText = (value) => {
    if (!value) {
      return '';
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value.value === 'string') {
      return value.value;
    }
    return String(value);
  };

  if (Array.isArray(contents)) {
    return contents.map(toText).join('\n');
  }

  return toText(contents);
}

async function hoverTextAt(doc, position) {
  const hovers = await vscode.commands.executeCommand(
    'vscode.executeHoverProvider',
    doc.uri,
    position
  );
  if (!Array.isArray(hovers) || hovers.length === 0) {
    return '';
  }

  return hovers.map((hover) => flattenHoverContents(hover.contents)).join('\n');
}

async function waitForHoverTextAt(
  doc,
  position,
  predicate,
  { timeoutMs = 12_000, pollMs = 250 } = {}
) {
  const deadline = Date.now() + timeoutMs;
  let last = '';

  while (Date.now() < deadline) {
    last = await hoverTextAt(doc, position);
    if (predicate(last)) {
      return last;
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  return last;
}

async function definitionsAt(doc, position) {
  const results = await vscode.commands.executeCommand(
    'vscode.executeDefinitionProvider',
    doc.uri,
    position
  );
  if (!Array.isArray(results)) {
    return [];
  }

  return results.map((entry) => {
    if ('targetUri' in entry) {
      return {
        uri: entry.targetUri,
        range: entry.targetRange,
      };
    }

    return {
      uri: entry.uri,
      range: entry.range,
    };
  });
}

async function formatEditsFor(doc) {
  const edits = await vscode.commands.executeCommand(
    'vscode.executeFormatDocumentProvider',
    doc.uri,
    {
      tabSize: 2,
      insertSpaces: true,
    }
  );

  return Array.isArray(edits) ? edits : [];
}

async function applyTextEdits(uri, edits) {
  if (!edits.length) {
    return;
  }

  const workspaceEdit = new vscode.WorkspaceEdit();
  workspaceEdit.set(uri, edits);
  const applied = await vscode.workspace.applyEdit(workspaceEdit);
  assert.strictEqual(applied, true, 'Expected format edits to apply');
}

function diagnosticsSignature(diags) {
  return JSON.stringify(
    diags.map((d) => ({
      code: typeof d.code === 'string' ? d.code : (d.code?.value ?? ''),
      source: d.source ?? '',
      message: d.message,
      start: `${d.range.start.line}:${d.range.start.character}`,
      end: `${d.range.end.line}:${d.range.end.character}`,
    }))
  );
}

async function waitForDiagnostics(
  uri,
  predicate,
  { timeoutMs = 12_000, pollMs = 250, stableRounds = 2 } = {}
) {
  const deadline = Date.now() + timeoutMs;
  let last = [];
  let previousSignature = '';
  let stableCount = 0;

  while (Date.now() < deadline) {
    last = vscode.languages.getDiagnostics(uri);
    const signature = diagnosticsSignature(last);

    if (signature === previousSignature) {
      stableCount += 1;
    } else {
      previousSignature = signature;
      stableCount = 1;
    }

    if (stableCount >= stableRounds && (!predicate || predicate(last))) {
      return last;
    }

    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  return last;
}

suite('Extension Host Capability Matrix', () => {
  // H01
  test('H01 hover returns schema-backed details for title expression', async function () {
    this.timeout(30_000);

    await withWorkspaceSchemaPath('./example.schema.json', async () => {
      const uri = fixtureUri('invalid_example.md.tmpl');
      const doc = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(doc);

      const content = ['---', '"$schema": "./example.schema.json",', '---', '{{ title }}'].join(
        '\n'
      );
      await replaceDocumentText(editor, content);

      const hoverPos = positionAtSubstring(doc, 'title', 2);
      const hoverText = await waitForHoverTextAt(doc, hoverPos, (value) => value.length > 0);

      assert.ok(hoverText.length > 0, 'Expected hover result for schema property');
      assert.ok(hoverText.toLowerCase().includes('title'));
    });
  });

  // H02
  test('H02 hover returns local-variable details for set variable usage', async function () {
    this.timeout(30_000);

    const uri = fixtureUri('invalid_example.md.tmpl');
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc);

    const content = [
      '{% set collection = ["a"] %}',
      '{% for item in collection %}',
      '{{ item }}',
      '{% endfor %}',
    ].join('\n');
    await replaceDocumentText(editor, content);

    const hoverPos = positionAtSubstring(doc, 'in collection', 4);
    const hoverText = await waitForHoverTextAt(doc, hoverPos, (value) =>
      value.includes('collection: local template variable')
    );

    assert.ok(hoverText.includes('collection: local template variable'));
  });

  // H03
  test('H03 hover returns loop-alias details for alias usage', async function () {
    this.timeout(30_000);

    const uri = fixtureUri('invalid_example.md.tmpl');
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc);

    const content = ['{% for item in items %}', '{{ item }}', '{% endfor %}'].join('\n');
    await replaceDocumentText(editor, content);

    const hoverPos = positionAtSubstring(doc, '{{ item', 4);
    const hoverText = await waitForHoverTextAt(doc, hoverPos, (value) =>
      value.includes('item: local loop alias')
    );

    assert.ok(hoverText.includes('item: local loop alias'));
  });

  // D01
  test('D01 definition resolves iterable local variable to set declaration', async function () {
    this.timeout(30_000);

    const uri = fixtureUri('invalid_example.md.tmpl');
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc);

    const content = [
      '{% set collection = ["a"] %}',
      '{% for item in collection %}',
      '{{ item }}',
      '{% endfor %}',
    ].join('\n');
    await replaceDocumentText(editor, content);

    const definitionPos = positionAtSubstring(doc, 'in collection', 4);
    const defs = await definitionsAt(doc, definitionPos);

    assert.ok(defs.length > 0, 'Expected definitions for iterable local variable');
    const sameDoc = defs.find((d) => d.uri.toString() === doc.uri.toString());
    assert.ok(sameDoc, 'Expected same-document definition');
    assert.strictEqual(doc.getText(sameDoc.range), 'collection');
  });

  // D02
  test('D02 definition resolves loop alias usage to for declaration', async function () {
    this.timeout(30_000);

    const uri = fixtureUri('invalid_example.md.tmpl');
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc);

    const content = ['{% for item in items %}', '{{ item }}', '{% endfor %}'].join('\n');
    await replaceDocumentText(editor, content);

    const definitionPos = positionAtSubstring(doc, '{{ item', 4);
    const defs = await definitionsAt(doc, definitionPos);

    assert.ok(defs.length > 0, 'Expected definitions for loop alias usage');
    const sameDoc = defs.find((d) => d.uri.toString() === doc.uri.toString());
    assert.ok(sameDoc, 'Expected same-document alias definition');
    assert.strictEqual(doc.getText(sameDoc.range), 'item');
  });

  // D03
  test('D03 definition resolves schema-backed field usage to schema target', async function () {
    this.timeout(30_000);

    await withWorkspaceSchemaPath('./example.schema.json', async () => {
      const uri = fixtureUri('invalid_example.md.tmpl');
      const doc = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(doc);

      const content = ['---', '"$schema": "./example.schema.json",', '---', '{{ title }}'].join(
        '\n'
      );
      await replaceDocumentText(editor, content);

      const definitionPos = positionAtSubstring(doc, 'title', 2);
      const defs = await definitionsAt(doc, definitionPos);

      assert.ok(defs.length > 0, 'Expected definition entries for schema field');
      assert.ok(defs.some((d) => d.uri.toString().endsWith('/example.schema.json')));
    });
  });

  // F01
  test('F01 format is idempotent across repeated runs', async function () {
    this.timeout(30_000);

    const uri = fixtureUri('invalid_example.md.tmpl');
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc);

    const content = ['# Title', '', '{% for item in items %}', '{{ item }}', '{% endfor %}'].join(
      '\n'
    );
    await replaceDocumentText(editor, content);

    const edits1 = await formatEditsFor(doc);
    await applyTextEdits(doc.uri, edits1);
    await doc.save();
    const afterFirst = doc.getText();

    const edits2 = await formatEditsFor(doc);
    await applyTextEdits(doc.uri, edits2);
    await doc.save();
    const afterSecond = doc.getText();

    assert.strictEqual(afterSecond, afterFirst, 'Formatting should be idempotent');
  });

  // F02
  test('F02 format preserves templ delimiters and block tags', async function () {
    this.timeout(30_000);

    const uri = fixtureUri('invalid_example.md.tmpl');
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc);

    const content = ['{% for item in items %}', '{{ item }}', '{% endfor %}'].join('\n');
    await replaceDocumentText(editor, content);

    const edits = await formatEditsFor(doc);
    await applyTextEdits(doc.uri, edits);
    await doc.save();

    const formatted = doc.getText();
    assert.ok(formatted.includes('{% for item in items %}'));
    assert.ok(formatted.includes('{% endfor %}'));
  });

  // G01
  test('G01 diagnostic reports invalid if statement syntax', async function () {
    this.timeout(30_000);

    const uri = fixtureUri('invalid_example.md.tmpl');
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc);

    await replaceDocumentText(editor, '{% if %}\ntext\n{% endif %}');

    const diags = await waitForDiagnostics(uri, (items) =>
      items.some((d) => d.source === 'templjs' && String(d.code).includes('invalidStatement'))
    );

    assert.ok(
      diags.some((d) => d.source === 'templjs' && String(d.code).includes('invalidStatement'))
    );
  });

  // G02
  test('G02 diagnostic anchors missing endfor range to for keyword with trim markers', async function () {
    this.timeout(30_000);

    const uri = fixtureUri('invalid_example.md.tmpl');
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc);

    await replaceDocumentText(editor, '{%- for item in items -%}\n{{ item }}');

    const diags = await waitForDiagnostics(uri, (items) =>
      items.some(
        (d) =>
          d.source === 'templjs' &&
          String(d.code).includes('unclosedStatement') &&
          d.message.includes('endfor')
      )
    );

    const missingEndfor = diags.find(
      (d) =>
        d.source === 'templjs' &&
        String(d.code).includes('unclosedStatement') &&
        d.message.includes('endfor')
    );

    assert.ok(missingEndfor, 'Expected missing endfor diagnostic');
    assert.strictEqual(missingEndfor.range.start.line, 0);
    assert.strictEqual(missingEndfor.range.start.character, 4);
  });

  // G03
  test('G03 diagnostic does not report local variables as schema-missing in malformed template', async function () {
    this.timeout(30_000);

    await withWorkspaceSchemaPath('./example.schema.json', async () => {
      const uri = fixtureUri('invalid_example.md.tmpl');
      const doc = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(doc);

      const content = [
        '---',
        '"$schema": "./example.schema.json",',
        'invalid: bar: [{% if %}foo {% endif %}]',
        '---',
        '{% set collection = ["a", "b"] %}',
        '{% for x in collection -%}',
        '{{ x }}',
      ].join('\n');

      await replaceDocumentText(editor, content);

      const diags = await waitForDiagnostics(uri);
      const templDiags = diags.filter((d) => d.source === 'templjs');
      const undefinedVars = templDiags.filter((d) => String(d.code).includes('undefinedVariable'));

      assert.strictEqual(
        undefinedVars.some((d) => d.message.includes('"collection" not found in schema')),
        false
      );
      assert.strictEqual(
        undefinedVars.some((d) => d.message.includes('"x" not found in schema')),
        false
      );
    });
  });

  // C01
  test('C01 completion excludes local set variable before declaration and includes it after declaration', async function () {
    this.timeout(30_000);

    const uri = fixtureUri('invalid_example.md.tmpl');
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc);

    const content = [
      '---',
      '"$schema": "./example.schema.json",',
      '---',
      '# Title',
      '',
      '## Subtitle',
      '{%- for x in c -%}',
      '{% endfor -%}',
      '{% set collection = ["a", "b", "c"] -%}',
      '{% for x in c -%}',
      '{{ x }}',
      '',
    ].join('\n');

    await replaceDocumentText(editor, content);
    assert.strictEqual(doc.languageId, 'templjs-markdown');

    const beforePos = positionAfterInPrefix(doc, 'in c');
    const beforeItems = await waitForCompletionItems(doc, beforePos, (items) =>
      items.some((item) => completionLabel(item) === 'items')
    );
    assert.strictEqual(
      beforeItems.some(
        (item) =>
          completionLabel(item) === 'collection' &&
          completionDetail(item).includes('local template variable')
      ),
      false,
      'collection must not be suggested before local declaration'
    );

    const secondLoopIndex = doc.getText().lastIndexOf('in c');
    assert.ok(secondLoopIndex >= 0, 'Second loop iterable prefix not found');
    const afterPos = doc.positionAt(secondLoopIndex + 'in c'.length);

    const afterItems = await waitForCompletionItems(doc, afterPos, (items) =>
      items.some(
        (item) =>
          completionLabel(item) === 'collection' &&
          completionDetail(item).includes('local template variable')
      )
    );
    assert.strictEqual(
      afterItems.some(
        (item) =>
          completionLabel(item) === 'collection' &&
          completionDetail(item).includes('local template variable')
      ),
      true,
      'collection should be suggested after local declaration'
    );
  });

  // C02
  test('C02 completion provides schema iterable and property labels', async function () {
    this.timeout(30_000);

    await withWorkspaceSchemaPath('./example.schema.json', async () => {
      const uri = fixtureUri('invalid_example.md.tmpl');
      const doc = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(doc);

      const content = [
        '---',
        '"$schema": "./example.schema.json",',
        '---',
        '# Title',
        '{{ ti }}',
        '',
        '## Subtitle',
        '{%- for x in i -%}',
        '{% endfor -%}',
        '',
      ].join('\n');

      await replaceDocumentText(editor, content);
      assert.strictEqual(doc.languageId, 'templjs-markdown');

      const iterablePos = positionAfterInPrefix(doc, 'in i');
      const iterableItems = await waitForCompletionItems(doc, iterablePos, (items) =>
        items.some((item) => completionLabel(item) === 'items')
      );
      assert.strictEqual(
        iterableItems.some((item) => completionLabel(item) === 'items'),
        true,
        'schema iterable "items" should be suggested in for-loop iterable position'
      );

      const expressionPos = positionAtMarker(doc, '{{ ti', 0);
      const expressionItems = await waitForCompletionItems(doc, expressionPos, (items) =>
        items.some((item) => completionLabel(item) === 'title')
      );
      assert.strictEqual(
        expressionItems.some((item) => completionLabel(item) === 'title'),
        true,
        'schema property "title" should be suggested in expression completion'
      );
    });
  });

  // C03
  test('C03 completion resolves schema properties for loop aliases (item.name)', async function () {
    this.timeout(30_000);

    await withWorkspaceSchemaPath('./example.schema.json', async () => {
      const uri = fixtureUri('invalid_example.md.tmpl');
      const doc = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(doc);

      const content = [
        '---',
        '"$schema": "./example.schema.json",',
        '---',
        '# Title',
        '',
        '## Subtitle',
        '{% for item in items %}',
        '{{ item.n }}',
        '{% endfor %}',
        '',
      ].join('\n');

      await replaceDocumentText(editor, content);
      assert.strictEqual(doc.languageId, 'templjs-markdown');

      const aliasPropPos = positionAtMarker(doc, '{{ item.n', 0);
      const aliasPropItems = await waitForCompletionItems(doc, aliasPropPos, (items) =>
        items.some((item) => completionLabel(item) === 'name')
      );

      assert.strictEqual(
        aliasPropItems.some((item) => completionLabel(item) === 'name'),
        true,
        'loop alias property "name" should be suggested for item.n'
      );
    });
  });

  // C04
  test('C04 completion resolves loop-alias schema properties in malformed templates', async function () {
    this.timeout(30_000);

    await withWorkspaceSchemaPath('./example.schema.json', async () => {
      const uri = fixtureUri('invalid_example.md.tmpl');
      const doc = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(doc);

      const content = [
        '---',
        '"$schema": "./example.schema.json",',
        'invalid: bar: [{% if %}foo ]',
        '---',
        '# Title',
        '{{ ti}}',
        '[broken ref][missing-ref]',
        '',
        '## Subtitle',
        '{%- for  item in items %}',
        '{{ item.n }}',
        '{% endfo',
      ].join('\n');

      await replaceDocumentText(editor, content);
      assert.strictEqual(doc.languageId, 'templjs-markdown');

      const aliasPropPos = positionAtMarker(doc, '{{ item.n', 0);
      const aliasPropItems = await waitForCompletionItems(doc, aliasPropPos, (items) =>
        items.some((item) => completionLabel(item) === 'name')
      );

      assert.strictEqual(
        aliasPropItems.some((item) => completionLabel(item) === 'name'),
        true,
        'loop alias property "name" should be suggested for item.n in malformed templates'
      );
    });
  });
});
