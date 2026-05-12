/* global process */
import { expect, test } from '@playwright/test';
import { _electron as electron } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixturesPath = path.resolve(extensionRoot, 'test-fixtures');

function resolveVscodePaths() {
  const base = path.resolve(extensionRoot, '.vscode-test');
  const dirs = fs
    .readdirSync(base, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('vscode-'))
    .map((entry) => path.join(base, entry.name))
    .sort();

  if (dirs.length === 0) {
    throw new Error(`No VS Code test installation found under ${base}`);
  }

  const installDir = dirs[dirs.length - 1];
  const executablePath = path.join(
    installDir,
    'Visual Studio Code.app',
    'Contents',
    'MacOS',
    'Electron'
  );
  const appPath = path.join(installDir, 'Visual Studio Code.app', 'Contents', 'Resources', 'app');

  return { executablePath, appPath };
}

async function launchVscode() {
  const { executablePath, appPath } = resolveVscodePaths();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'templjs-e2e-user-data-'));
  const extensionsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'templjs-e2e-extensions-'));
  const fixturesFolderUri = pathToFileURL(fixturesPath).toString();

  const args = [
    appPath,
    '--skip-welcome',
    '--skip-release-notes',
    '--disable-updates',
    '--disable-telemetry',
    '--disable-workspace-trust',
    '--disable-extensions',
    '--new-window',
    `--user-data-dir=${userDataDir}`,
    `--extensions-dir=${extensionsDir}`,
    `--extensionDevelopmentPath=${extensionRoot}`,
    `--folder-uri=${fixturesFolderUri}`,
  ];

  const userSettingsDir = path.join(userDataDir, 'User');
  fs.mkdirSync(userSettingsDir, { recursive: true });
  fs.writeFileSync(
    path.join(userSettingsDir, 'settings.json'),
    JSON.stringify(
      {
        editor: {
          quickSuggestions: { other: true, comments: true, strings: true },
          suggestOnTriggerCharacters: true,
        },
        'workbench.startupEditor': 'none',
        'workbench.welcome.enabled': false,
        'chat.commandCenter.enabled': false,
        'chat.experimental.detectParticipant.enabled': false,
        'git.openRepositoryInParentFolders': 'never',
        'update.mode': 'none',
      },
      null,
      2
    )
  );

  const app = await electron.launch({ executablePath, args });
  return { app, userDataDir, extensionsDir };
}

async function cleanupPaths(paths) {
  for (const p of paths) {
    fs.rmSync(p, { recursive: true, force: true });
  }
}

async function getWorkbenchWindow(app) {
  const window = await app.firstWindow();
  await window.waitForSelector('.monaco-workbench', { timeout: 60_000 });
  return window;
}

async function openFixtureFile(window, filename) {
  await window.keyboard.press('Meta+P');
  await window.keyboard.type(filename);
  await window.keyboard.press('Enter');

  // Give VS Code time to load editor model and focus it.
  await window.waitForTimeout(800);
}

async function ensureTempljsMarkdownMode(window) {
  await window.keyboard.press('F1');
  await window.keyboard.type('Change Language Mode');
  await window.keyboard.press('Enter');
  await window.keyboard.type('TemplJS Markdown');
  await window.keyboard.press('Enter');
  await window.waitForTimeout(400);
}

async function replaceEditorContent(window, text) {
  const editorSurface = window
    .locator('.monaco-editor[data-uri^="file://"]:visible, .monaco-editor:visible')
    .first();
  await expect(editorSurface).toBeVisible({ timeout: 30_000 });
  await window.keyboard.press('Escape');
  await editorSurface.click();

  await window.keyboard.press('Meta+A');
  await window.keyboard.press('Backspace');
  await window.keyboard.type(text);
}

async function suggestionLabels(window) {
  return await window.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.suggest-widget .monaco-list-row'));
    return rows.map((row) => {
      const label = row.querySelector('.label-name');
      return (label?.textContent ?? row.textContent ?? '').trim();
    });
  });
}

async function waitForSuggestion(window, expectedLabel, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const labels = await suggestionLabels(window);
    if (labels.some((label) => label.toLowerCase() === expectedLabel.toLowerCase())) {
      return labels;
    }
    await window.waitForTimeout(200);
  }

  const labels = await suggestionLabels(window);
  throw new Error(
    `Expected suggestion '${expectedLabel}' not found. Suggestions: ${JSON.stringify(labels)}`
  );
}

test.describe('templjs true e2e typing behavior', () => {
  test('shows completion on partial iterable token while typing', async () => {
    const { app, userDataDir, extensionsDir } = await launchVscode();

    try {
      const window = await getWorkbenchWindow(app);
      await openFixtureFile(window, 'invalid_example.md.tmpl');
      await ensureTempljsMarkdownMode(window);

      await replaceEditorContent(
        window,
        ['---', '"$schema": "./example.schema.json",', '---', '{% for item in it'].join('\n')
      );

      const labels = await waitForSuggestion(window, 'items');
      expect(labels).toContain('items');
    } finally {
      await app.close();
      await cleanupPaths([userDataDir, extensionsDir]);
    }
  });

  test.fail('shows schema property completion for loop alias path item n', async () => {
    const { app, userDataDir, extensionsDir } = await launchVscode();

    try {
      const window = await getWorkbenchWindow(app);
      await openFixtureFile(window, 'invalid_example.md.tmpl');
      await ensureTempljsMarkdownMode(window);

      await replaceEditorContent(
        window,
        [
          '---',
          '"$schema": "./example.schema.json",',
          '---',
          '{% for item in items %}',
          '{{ item.n',
        ].join('\n')
      );

      const labels = await waitForSuggestion(window, 'name');
      expect(labels).toContain('name');
    } finally {
      await app.close();
      await cleanupPaths([userDataDir, extensionsDir]);
    }
  });
});
