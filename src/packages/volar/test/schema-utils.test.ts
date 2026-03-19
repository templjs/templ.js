import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  resolveSchemaFilePath,
  resolveSchemaFilePathSync,
  splitSchemaSourceReference,
} from '../src/schema-utils.js';

const tempDirs: string[] = [];

function makeTempDir(): string {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'templjs-schema-utils-'));
  tempDirs.push(tempDir);
  return tempDir;
}

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('schema-utils', () => {
  it('splits schema references and preserves trailing hash fragments', () => {
    expect(splitSchemaSourceReference(' ./schema.json#/$defs/item ')).toEqual({
      source: './schema.json',
      fragment: '#/$defs/item',
    });
    expect(splitSchemaSourceReference('./schema.json#')).toEqual({
      source: './schema.json',
      fragment: '#',
    });
  });

  it('falls back from document-relative resolution to the workspace root asynchronously', async () => {
    const tempDir = makeTempDir();
    const workspaceSchemaDir = path.join(tempDir, 'schemas');
    const documentDir = path.join(tempDir, 'nested', 'docs');
    mkdirSync(workspaceSchemaDir, { recursive: true });
    mkdirSync(documentDir, { recursive: true });

    const schemaPath = path.join(workspaceSchemaDir, 'frontmatter.json');
    const documentPath = path.join(documentDir, 'note.md.tpl');
    writeFileSync(schemaPath, '{}');
    writeFileSync(documentPath, 'body');

    await expect(
      resolveSchemaFilePath('./schemas/frontmatter.json', tempDir, pathToFileURL(documentPath).href)
    ).resolves.toBe(schemaPath);
  });

  it('resolves relative paths from the current document when the file exists there', async () => {
    const tempDir = makeTempDir();
    const documentDir = path.join(tempDir, 'docs');
    mkdirSync(documentDir, { recursive: true });

    const schemaPath = path.join(documentDir, 'frontmatter.json');
    const documentPath = path.join(documentDir, 'note.md.tpl');
    writeFileSync(schemaPath, '{}');
    writeFileSync(documentPath, 'body');

    await expect(
      resolveSchemaFilePath('./frontmatter.json', tempDir, pathToFileURL(documentPath).href)
    ).resolves.toBe(schemaPath);
    expect(
      resolveSchemaFilePathSync('./frontmatter.json', tempDir, pathToFileURL(documentPath).href)
    ).toBe(schemaPath);
  });

  it('returns undefined for relative paths when neither workspace nor document resolution applies', async () => {
    await expect(resolveSchemaFilePath('./missing.json', undefined)).resolves.toBeUndefined();
    expect(resolveSchemaFilePathSync('./missing.json', undefined)).toBeUndefined();
  });

  it('passes through URLs and absolute paths unchanged', async () => {
    expect(resolveSchemaFilePathSync('https://example.com/schema.json', '/workspace')).toBe(
      'https://example.com/schema.json'
    );
    await expect(resolveSchemaFilePath('/tmp/schema.json', '/workspace')).resolves.toBe(
      '/tmp/schema.json'
    );
  });

  it('resolves file:// schema URLs to filesystem paths', async () => {
    const tempDir = makeTempDir();
    const schemaPath = path.join(tempDir, 'schema.json');
    writeFileSync(schemaPath, '{}');
    const schemaUrl = pathToFileURL(schemaPath).href;

    await expect(resolveSchemaFilePath(schemaUrl, '/workspace')).resolves.toBe(schemaPath);
    expect(resolveSchemaFilePathSync(schemaUrl, '/workspace')).toBe(schemaPath);
  });
});
