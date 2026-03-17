import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { GraphOperationError, QueryRequest, QueryResponse } from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, '..');

describe('API boundary and contract compatibility', () => {
  const dtsPath = path.join(packageRoot, 'dist', 'index.d.ts');
  it.skipIf(!existsSync(dtsPath))('public .d.ts does not leak external dependency imports', () => {
    const dts = readFileSync(dtsPath, 'utf-8');

    // assumes that each import/export statement in the public .d.ts is on a single line, which is currently true and can be enforced via linting if needed
    const lines = dts
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('import') || line.startsWith('export'));

    // if we've got an import/export that references a non-relative path, it's likely an external dependency leak
    const externalImport = lines.find((line) => /from ['"](?!\.{1,2}\/)/.test(line));
    expect(externalImport).toBeUndefined();
  });

  it('query request/response contracts are v1-compatible and serialization-safe', () => {
    const request: QueryRequest = {
      version: 'v1',
      nodes: {
        kind: 'symbol',
        profileIds: ['editor-location'],
      },
    };

    const response: QueryResponse = {
      version: 'v1',
      revision: 2,
      nodes: [
        {
          id: 'node-1',
          profileId: 'editor-location',
          kind: 'symbol',
          attributes: { name: 'title' },
        },
      ],
      edges: [],
    };

    const requestRoundTrip = JSON.parse(JSON.stringify(request));
    const responseRoundTrip = JSON.parse(JSON.stringify(response));

    expect(requestRoundTrip).toEqual(request);
    expect(responseRoundTrip).toEqual(response);
  });

  it('structured error payloads are v1-compatible and serialization-safe', () => {
    const errorPayload: GraphOperationError = {
      version: 'v1',
      code: 'provider-failed',
      message: 'provider exploded',
      providerId: 'provider-x',
    };

    const roundTrip = JSON.parse(JSON.stringify(errorPayload));
    expect(roundTrip).toEqual(errorPayload);
  });
});
