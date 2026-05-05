/* global process */
import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function runPnpm(args) {
  const output = execFileSync('pnpm', args, {
    cwd: extensionRoot,
    encoding: 'utf-8',
    env: process.env,
  });

  return output
    // eslint-disable-next-line no-control-regex
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/[\u00b7\r]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

test.describe('templjs playwright smoke checklist', () => {
  test('runs Volar labs probe suite for md/yaml diagnostics, hover, and definition visibility', () => {
    const output = runPnpm([
      'run',
      'test',
      '--',
      'test/volar-labs.probes.test.ts',
      'test/service-plugins.test.ts',
    ]);

    expect(output).toMatch(/test\/volar-labs\.probes\.test\.ts \(3 tests\)/);
    expect(output).toMatch(/test\/service-plugins\.test\.ts \(19 tests\)/);
  });

  test('runs focused volar virtual-code transparency checks', () => {
    const output = runPnpm(['--filter', '@templjs/volar', 'test', '--', 'test/index.test.ts']);

    expect(output).toMatch(/test\/index\.test\.ts/);
  });

  test('runs grammar smoke checks for frontmatter tokenization precedence', () => {
    const output = runPnpm(['run', 'test', '--', 'test/grammar-smoke.test.ts']);

    expect(output).toMatch(/test\/grammar-smoke\.test\.ts \(4 tests\)/);
  });
});
