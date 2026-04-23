import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('build-bundle-sanity', () => {
  it('guards against jsonc-parser UMD bundling regressions in dist server bundle', () => {
    const distServerPath = path.join(extensionRoot, 'dist/server.js');
    expect(existsSync(distServerPath)).toBe(true);

    const bundle = readFileSync(distServerPath, 'utf-8');

    // This signature indicates the broken UMD path that triggers runtime init crashes.
    expect(bundle).not.toContain('jsonc-parser/lib/umd/main.js');
    expect(bundle).not.toContain('define(["require", "exports", "./impl/format"');
    expect(bundle).not.toContain('require("./impl/format")');
    expect(bundle).not.toContain("require('./impl/format')");
  });
});
