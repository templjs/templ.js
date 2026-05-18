import { SchemaValidator } from '@templjs/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSharedSchemaMetadata } from '../src/context-graph-schema.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('context graph schema helpers', () => {
  it('reuses schema metadata for the same schema object', () => {
    const getMetadataSpy = vi.spyOn(SchemaValidator.prototype, 'getMetadata');
    const schema = {
      type: 'object',
      properties: {
        title: {
          type: 'string',
        },
      },
    };

    const first = getSharedSchemaMetadata(schema);
    const second = getSharedSchemaMetadata(schema);

    expect(first).toBe(second);
    expect(getMetadataSpy).toHaveBeenCalledTimes(1);
    expect(first.title?.type).toBe('string');
  });

  it('keeps distinct schema objects isolated', () => {
    const getMetadataSpy = vi.spyOn(SchemaValidator.prototype, 'getMetadata');
    const firstSchema = {
      type: 'object',
      properties: {
        title: {
          type: 'string',
        },
      },
    };
    const secondSchema = {
      type: 'object',
      properties: {
        title: {
          type: 'number',
        },
      },
    };

    const first = getSharedSchemaMetadata(firstSchema);
    const second = getSharedSchemaMetadata(secondSchema);

    expect(first).not.toBe(second);
    expect(first.title?.type).toBe('string');
    expect(second.title?.type).toBe('number');
    expect(getMetadataSpy).toHaveBeenCalledTimes(2);
  });

  it('returns immutable metadata for shared schema objects', () => {
    const schema = {
      type: 'object',
      properties: {
        title: {
          type: 'string',
        },
      },
    };

    const metadata = getSharedSchemaMetadata(schema);

    expect(() => {
      metadata.title!.type = 'number';
    }).toThrow(TypeError);
    expect(() => {
      metadata['']!.properties!.push('other');
    }).toThrow(TypeError);
    expect(() => {
      metadata['']!.properties = [];
    }).toThrow(TypeError);
  });
});
