import { describe, expect, it } from 'vitest';

import {
  asNonEmptyString,
  asString,
  buildPathNodes,
  buildSnapshotCacheKey,
  filterNodes,
  getLabel,
  getParentPath,
  getSnapshotSchemaToken,
  hashStringFNV1a,
  querySnapshot,
  resolveProfileId,
  resolveSchemaUriForContext,
  resolveZoneKind,
  stableSerialize,
} from '../src/context-graph-snapshot.js';

describe('context-graph-snapshot helpers', () => {
  it('stably serializes sorted keys, arrays, and circular references', () => {
    const circular: Record<string, unknown> = { b: 2, a: 1 };
    circular.self = circular;

    const serialized = stableSerialize(circular);
    expect(serialized).toContain('"a":1');
    expect(serialized).toContain('"b":2');
    expect(serialized).toContain('"[Circular]"');
  });

  it('hashes and schema tokens are stable across repeated values', () => {
    expect(hashStringFNV1a('templjs')).toBe(hashStringFNV1a('templjs'));

    const objectSchema = { type: 'object' };
    const objectTokenA = getSnapshotSchemaToken(objectSchema);
    const objectTokenB = getSnapshotSchemaToken(objectSchema);
    expect(objectTokenA).toMatch(/^id:/);
    expect(objectTokenA).toBe(objectTokenB);

    const primitiveTokenA = getSnapshotSchemaToken('schema-ref');
    const primitiveTokenB = getSnapshotSchemaToken('schema-ref');
    expect(primitiveTokenA).toMatch(/^hash:/);
    expect(primitiveTokenA).toBe(primitiveTokenB);
  });

  it('builds cache keys and path helpers for dotted and indexed paths', () => {
    const schema = { type: 'object' };
    const keyWithoutUri = buildSnapshotCacheKey({ schema });
    const keyWithUri = buildSnapshotCacheKey({ schema, contentSchemaUri: 'file:///schema.json' });

    expect(keyWithoutUri).toContain('::');
    expect(keyWithUri).toContain('file:///schema.json');

    expect(getParentPath('users[0].name')).toBe('users[0]');
    expect(getParentPath('root')).toBe('');
    expect(getLabel('users[0].name')).toBe('name');
    expect(getLabel('users[0]')).toBe('users');
  });

  it('resolves profile, zone, and schema URI by semantic context', () => {
    expect(resolveProfileId({ operation: 'completion', contextBlock: 'content' })).toBeTruthy();
    expect(
      resolveProfileId({
        operation: 'completion',
        profileId: 'explicit-profile',
      })
    ).toBe('explicit-profile');
    expect(
      resolveProfileId({
        operation: 'completion',
        semanticZone: { profileId: 'zone-profile', kind: 'metadata', segment: 'frontmatter' },
      } as never)
    ).toBe('zone-profile');

    expect(resolveZoneKind({ operation: 'hover', contextBlock: 'frontmatter' })).toBe('metadata');
    expect(resolveZoneKind({ operation: 'hover', contextBlock: 'content' })).toBe('body');
    expect(
      resolveZoneKind({
        operation: 'hover',
        semanticZone: { profileId: 'zone', kind: 'metadata', segment: 'frontmatter' },
      } as never)
    ).toBe('metadata');

    expect(
      resolveSchemaUriForContext(
        { operation: 'definition', contextBlock: 'frontmatter' },
        { schemaUri: 'file:///frontmatter.json', contentSchemaUri: 'file:///content.json' }
      )
    ).toBe('file:///frontmatter.json');
    expect(
      resolveSchemaUriForContext(
        { operation: 'definition', contextBlock: 'content' },
        { schemaUri: 'file:///frontmatter.json', contentSchemaUri: 'file:///content.json' }
      )
    ).toBe('file:///content.json');
  });

  it('builds schema path/enum nodes and filters/query-sorts results', () => {
    const schema = {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['active', 'paused'] },
          },
        },
      },
    };

    const nodes = buildPathNodes('content', schema);
    expect(nodes.some((node) => node.kind === 'schema-path')).toBe(true);
    expect(nodes.some((node) => node.kind === 'schema-enum-value')).toBe(true);

    const snapshot = {
      version: 'v1' as const,
      revision: 4,
      nodes,
      edges: [],
    };

    const filtered = filterNodes(snapshot, {
      version: 'v1',
      nodes: {
        kind: 'schema-path',
        profileIds: [nodes[0]?.profileId ?? 'none'],
        attributeEquals: { contextBlock: 'content' },
      },
    });
    expect(filtered.length).toBeGreaterThan(0);

    const response = querySnapshot(snapshot, {
      version: 'v1',
      nodes: { kind: 'schema-path' },
    });
    expect(response.revision).toBe(4);
    expect(response.edges).toEqual([]);
    expect(response.nodes.length).toBeGreaterThan(0);
  });

  it('coerces primitive helpers correctly', () => {
    expect(asString('x')).toBe('x');
    expect(asString(1)).toBeUndefined();
    expect(asNonEmptyString('x')).toBe('x');
    expect(asNonEmptyString('')).toBeUndefined();
  });
});
