import { execFileSync, spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nodeExecutable = process.execPath;

function ensureDistServerBundle(format: 'cjs' | 'esm' = 'cjs'): string {
  const distServerPath = path.join(
    extensionRoot,
    'dist',
    format === 'esm' ? 'server.mjs' : 'server.js'
  );
  if (format === 'esm' || !existsSync(distServerPath)) {
    execFileSync(nodeExecutable, ['./scripts/build.mjs'], {
      cwd: extensionRoot,
      env: {
        ...process.env,
        TEMPLJS_SERVER_FORMAT: format,
      },
      stdio: 'pipe',
    });
  }

  return distServerPath;
}

describe('build-bundle-sanity', () => {
  it('guards against jsonc-parser UMD bundling regressions in dist server bundle', () => {
    const distServerPath = ensureDistServerBundle();
    expect(existsSync(distServerPath)).toBe(true);

    const bundle = readFileSync(distServerPath, 'utf-8');

    // This signature indicates the broken UMD path that triggers runtime init crashes.
    expect(bundle).not.toContain('jsonc-parser/lib/umd/main.js');
    expect(bundle).not.toContain('define(["require", "exports", "./impl/format"');
    expect(bundle).not.toContain('require("./impl/format")');
    expect(bundle).not.toContain("require('./impl/format')");
  });

  it('supports opt-in ESM server bundle startup without immediate runtime crash', async () => {
    const distServerPath = ensureDistServerBundle('esm');
    expect(existsSync(distServerPath)).toBe(true);

    await new Promise<void>((resolve, reject) => {
      const child = spawn(nodeExecutable, [distServerPath, '--node-ipc'], {
        cwd: extensionRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let settled = false;
      let stderr = '';
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', (error) => {
        if (!settled) {
          settled = true;
          reject(error);
        }
      });

      child.on('exit', (code) => {
        if (!settled) {
          if (
            code === 0 &&
            stderr.includes('Connection and server created') &&
            !stderr.toLowerCase().includes('error')
          ) {
            settled = true;
            resolve();
            return;
          }

          settled = true;
          reject(
            new Error(
              `ESM server process exited before readiness window (code=${String(code)}) stderr=${stderr}`
            )
          );
        }
      });

      setTimeout(() => {
        if (settled) {
          return;
        }

        settled = true;
        child.kill();
        resolve();
      }, 500);
    });
  });
});
