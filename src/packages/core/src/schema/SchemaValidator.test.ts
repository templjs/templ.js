import { describe, expect, it } from 'vitest';
import { SchemaValidator } from './SchemaValidator.js';
import type { JSONSchema } from './types.js';

describe('SchemaValidator compile-state contract', () => {
  it('clears compilationError when a cached schema is reloaded', () => {
    const validSchema: JSONSchema = {
      $id: 'schema://valid',
      type: 'object',
      properties: {
        title: { type: 'string' },
      },
    };
    const invalidSchema = {
      type: 'invalid-type',
    } as unknown as JSONSchema;

    const validator = new SchemaValidator(validSchema);
    expect(validator.isCompiled).toBe(true);
    expect(validator.compilationError).toBeNull();

    validator.loadSchema(invalidSchema);
    expect(validator.isCompiled).toBe(false);
    expect(validator.compilationError).toBeTruthy();

    validator.loadSchema(validSchema);
    expect(validator.isCompiled).toBe(true);
    expect(validator.compilationError).toBeNull();
  });

  it('reports skipped validation as invalid and preserves the compilation error', () => {
    const schema = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      allOf: [{ $ref: 'https://does-not-exist.example.com/schemas/base.json#/$defs/core' }],
    } as unknown as JSONSchema;

    const validator = new SchemaValidator(schema);
    const result = validator.validate({ anything: true });

    expect(validator.isCompiled).toBe(false);
    expect(validator.compilationError).toBeTruthy();
    expect(result).toMatchObject({
      valid: false,
      skipped: true,
      errors: [
        {
          path: '$schema',
          message: validator.compilationError,
        },
      ],
    });
  });

  it('merges object metadata from combinator branches without an explicit type', () => {
    const schema: JSONSchema = {
      type: 'object',
      properties: {
        profile: {
          anyOf: [
            {
              type: 'object',
              properties: {
                name: { type: 'string' },
              },
            },
            {
              properties: {
                age: { type: 'integer' },
              },
            },
          ],
        },
      },
    };

    const validator = new SchemaValidator(schema);
    const metadata = validator.getMetadata();

    expect(metadata.profile).toMatchObject({
      type: 'object',
      properties: ['name', 'age'],
    });
    expect(metadata['profile.name']?.type).toBe('string');
  });
});
