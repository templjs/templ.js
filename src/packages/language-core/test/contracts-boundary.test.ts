import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type {
  TempljsHostLanguage,
  TempljsLanguageServerInitializationOptions,
  TempljsVirtualDocumentMetadata,
} from '../src/index.js';

function toJson(value: unknown): string {
  return JSON.stringify(value);
}

type Assert<T extends true> = T;
type IsEqual<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

type CanonicalHostLanguage = 'markdown' | 'json' | 'yaml' | 'html' | 'toml' | 'xml' | 'plaintext';

type _HostLanguageParity = Assert<IsEqual<TempljsHostLanguage, CanonicalHostLanguage>>;

describe('language-core contract boundary', () => {
  it('uses plaintext as the canonical host-language fallback', () => {
    const supportedHostLanguages = [
      'markdown',
      'json',
      'yaml',
      'html',
      'toml',
      'xml',
      'plaintext',
    ] as const satisfies readonly TempljsHostLanguage[];

    expect(supportedHostLanguages).toContain('plaintext');
  });

  it('exports JSON-compatible contract shapes', () => {
    const metadata: TempljsVirtualDocumentMetadata = {
      snapshotId: 'snapshot-1',
      sourceFileKind: 'template',
      hostLanguage: 'markdown',
      delimiters: {
        blockOpen: '{%',
        blockClose: '%}',
        expressionOpen: '{{',
        expressionClose: '}}',
        commentOpen: '{#',
        commentClose: '#}',
      },
      semanticZones: [
        {
          id: 'zone-1',
          kind: 'content',
          segment: 'content',
          startOffset: 0,
          endOffset: 12,
        },
      ],
      schemaSources: [
        {
          id: 'source-1',
          kind: 'workspace-setting',
          source: 'templjs.schemas',
          uri: 'file:///schema.json',
        },
      ],
      parseDiagnostics: [],
      contextGraphSnapshotId: 'graph-1',
    };

    const init: TempljsLanguageServerInitializationOptions = {
      traceMode: 'messages',
      workspaceFolder: '/workspace',
      schemaPath: '/workspace/schema.json',
      contentSchemaPath: '/workspace/content-schema.json',
      schemaPatterns: ['**/*.templ.json'],
    };

    expect(toJson(metadata)).toContain('snapshot-1');
    expect(toJson(init)).toContain('messages');
  });

  it('emitted d.ts does not leak third-party dependency types', () => {
    const dtsPath = path.resolve(__dirname, '../dist/public-types.d.ts');
    const sourcePath = path.resolve(__dirname, '../src/public-types.ts');
    const content = readFileSync(existsSync(dtsPath) ? dtsPath : sourcePath, 'utf8');

    expect(content).not.toMatch(/@volar\//i);
    expect(content).not.toMatch(/vscode/i);
    expect(content).not.toMatch(/typescript/i);
    expect(content).not.toMatch(/yaml-language-service/i);
  });
});
