/**
 * Comprehensive test suite for JSON Schema validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SchemaValidator } from '../../src/schema/SchemaValidator.js';
import type { JSONSchema } from '../../src/schema/types.js';
import {
  extractPaths,
  fuzzyMatch,
  levenshteinDistance,
  isValidPath,
  normalizePath,
} from '../../src/schema/queryPathValidator.js';
import {
  inferType,
  inferObjectSchema,
  inferArraySchema,
  mergeSchemas,
} from '../../src/schema/schemaInference.js';

describe('SchemaValidator', () => {
  describe('Schema Loading and Compilation', () => {
    it('should create validator without schema', () => {
      const validator = new SchemaValidator();
      expect(validator).toBeDefined();
    });

    it('should create validator with schema', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      };
      const validator = new SchemaValidator(schema);
      expect(validator).toBeDefined();
    });

    it('should load schema after construction', () => {
      const validator = new SchemaValidator();
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          age: { type: 'integer' },
        },
      };
      validator.loadSchema(schema);

      const result = validator.validate({ age: 30 });
      expect(result.valid).toBe(true);
    });

    it('should degrade gracefully for invalid schema', () => {
      const validator = new SchemaValidator();
      const invalidSchema = {
        type: 'invalid-type',
      } as unknown as JSONSchema;

      expect(() => validator.loadSchema(invalidSchema)).not.toThrow();
      expect(validator.isCompiled).toBe(false);
      expect(validator.compilationError).toBeTruthy();
    });

    it('compiles a JSON Schema draft 2020-12 schema without throwing', () => {
      const schema: JSONSchema = {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        $id: '/test/draft2020',
        type: 'object',
        unevaluatedProperties: false,
        properties: {
          title: { type: 'string' },
          count: { type: 'integer' },
        },
      };

      expect(() => new SchemaValidator(schema)).not.toThrow();
    });

    it('isCompiled is true when draft 2020-12 schema compiles successfully', () => {
      const schema: JSONSchema = {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        unevaluatedProperties: false,
        properties: { title: { type: 'string' } },
      };

      const validator = new SchemaValidator(schema);
      expect(validator.isCompiled).toBe(true);
      expect(validator.compilationError).toBeNull();
    });

    it('validates data against a draft 2020-12 schema with unevaluatedProperties', () => {
      const schema: JSONSchema = {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        unevaluatedProperties: false,
        properties: {
          title: { type: 'string' },
          count: { type: 'integer' },
        },
      };

      const validator = new SchemaValidator(schema);
      expect(validator.validate({ title: 'hello', count: 1 }).valid).toBe(true);
      expect(validator.validate({ title: 'hello', extra: true }).valid).toBe(false);
    });

    it('degrades gracefully when schema contains an unresolvable remote $ref', () => {
      const schema: JSONSchema = {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        allOf: [{ $ref: 'https://does-not-exist.example.com/schemas/base.json#/$defs/core' }],
        properties: { title: { type: 'string' } },
      } as unknown as JSONSchema;

      expect(() => new SchemaValidator(schema)).not.toThrow();
    });

    it('returns isCompiled=false and a compilationError when remote $ref is unresolvable', () => {
      const schema: JSONSchema = {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        allOf: [{ $ref: 'https://does-not-exist.example.com/schemas/base.json#/$defs/core' }],
        properties: { title: { type: 'string' } },
      } as unknown as JSONSchema;

      const validator = new SchemaValidator(schema);
      expect(validator.isCompiled).toBe(false);
      expect(validator.compilationError).toBeTruthy();
    });

    it('validate() returns valid:false with skipped=true when compilation failed', () => {
      const schema: JSONSchema = {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        allOf: [{ $ref: 'https://does-not-exist.example.com/schemas/base.json' }],
      } as unknown as JSONSchema;

      const validator = new SchemaValidator(schema);
      const result = validator.validate({ anything: true });
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].path).toBe('$schema');
      expect(result.errors[0].message).toContain(validator.compilationError ?? 'compilation');
      expect(result.skipped).toBe(true);
    });

    it('clears compilationError when reloading a cached compiled schema', () => {
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

    it('getMetadata() still returns property info even when compilation failed', () => {
      const schema: JSONSchema = {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        allOf: [{ $ref: 'https://does-not-exist.example.com/schemas/base.json' }],
        properties: { title: { type: 'string' }, count: { type: 'integer' } },
      } as unknown as JSONSchema;

      const validator = new SchemaValidator(schema);
      const metadata = validator.getMetadata();
      expect(metadata).toHaveProperty('title');
      expect(metadata).toHaveProperty('count');
    });

    it('returns empty metadata when no schema has been loaded', () => {
      expect(new SchemaValidator().getMetadata()).toEqual({});
    });
  });

  describe('Data Validation', () => {
    it('should validate valid data', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'integer' },
        },
        required: ['name'],
      };

      const validator = new SchemaValidator(schema);
      const result = validator.validate({ name: 'John', age: 30 });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.skipped).toBeUndefined();
    });

    it('should detect missing required fields', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
        },
        required: ['name', 'email'],
      };

      const validator = new SchemaValidator(schema);
      const result = validator.validate({ name: 'John' });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain("must have required property 'email'");
    });

    it('should detect type errors', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          age: { type: 'integer' },
        },
      };

      const validator = new SchemaValidator(schema);
      const result = validator.validate({ age: 'not a number' });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate email format', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
        },
      };

      const validator = new SchemaValidator(schema);

      const validResult = validator.validate({ email: 'test@example.com' });
      expect(validResult.valid).toBe(true);

      const invalidResult = validator.validate({ email: 'not-an-email' });
      expect(invalidResult.valid).toBe(false);
    });

    it('should validate nested objects', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              firstName: { type: 'string' },
              lastName: { type: 'string' },
            },
            required: ['firstName'],
          },
        },
      };

      const validator = new SchemaValidator(schema);

      const validResult = validator.validate({
        user: { firstName: 'John', lastName: 'Doe' },
      });
      expect(validResult.valid).toBe(true);

      const invalidResult = validator.validate({ user: {} });
      expect(invalidResult.valid).toBe(false);
    });

    it('should validate arrays', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          tags: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      };

      const validator = new SchemaValidator(schema);

      const validResult = validator.validate({ tags: ['a', 'b', 'c'] });
      expect(validResult.valid).toBe(true);

      const invalidResult = validator.validate({ tags: [1, 2, 3] });
      expect(invalidResult.valid).toBe(false);
    });

    it('should throw error when validating without schema', () => {
      const validator = new SchemaValidator();
      expect(() => validator.validate({})).toThrow('No schema loaded');
    });
  });

  describe('Query Path Validation', () => {
    let validator: SchemaValidator;

    beforeEach(() => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              firstName: { type: 'string' },
              lastName: { type: 'string' },
              email: { type: 'string' },
            },
          },
          users: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                age: { type: 'integer' },
              },
            },
          },
        },
      };
      validator = new SchemaValidator(schema);
    });

    it('should validate existing property paths', () => {
      const result = validator.validateQueryPath('user.firstName');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate array paths', () => {
      const result = validator.validateQueryPath('users[0].name');
      expect(result.valid).toBe(true);
    });

    it('should detect invalid paths', () => {
      const result = validator.validateQueryPath('user.missingField');
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Property not found');
    });

    it('should provide fuzzy match suggestions', () => {
      const result = validator.validateQueryPath('user.firstNam');
      expect(result.valid).toBe(false);
      expect(result.errors[0].suggestion).toBeDefined();
      expect(result.errors[0].suggestion).toContain('Did you mean');
    });

    it('omits suggestions when no similar paths exist', () => {
      const result = validator.validateQueryPath('totally.unknown.path');

      expect(result.valid).toBe(false);
      expect(result.errors[0].suggestion).toBeUndefined();
    });

    it('should suggest multiple alternatives', () => {
      const result = validator.validateQueryPath('user.name');
      expect(result.valid).toBe(false);
      if (result.errors[0].suggestion) {
        // Should suggest firstName or lastName
        expect(result.errors[0].suggestion).toMatch(/firstName|lastName/);
      }
    });

    it('should throw error when validating path without schema', () => {
      const emptyValidator = new SchemaValidator();
      expect(() => emptyValidator.validateQueryPath('user.name')).toThrow();
    });
  });

  describe('Schema Inference', () => {
    it('should infer schema from simple object', () => {
      const validator = new SchemaValidator();
      const data = {
        name: 'John',
        age: 30,
        active: true,
      };

      const schema = validator.inferSchema(data);

      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
      expect(schema.properties?.name.type).toBe('string');
      expect(schema.properties?.age.type).toBe('integer');
      expect(schema.properties?.active.type).toBe('boolean');
    });

    it('should infer schema from nested object', () => {
      const validator = new SchemaValidator();
      const data = {
        user: {
          name: 'John',
          contact: {
            email: 'john@example.com',
          },
        },
      };

      const schema = validator.inferSchema(data);

      expect(schema.type).toBe('object');
      expect(schema.properties?.user.type).toBe('object');
    });

    it('should infer schema from array', () => {
      const validator = new SchemaValidator();
      const data = {
        items: ['a', 'b', 'c'],
      };

      const schema = validator.inferSchema(data);

      expect(schema.properties?.items.type).toBe('array');
      expect(schema.properties?.items.items?.type).toBe('string');
    });

    it('should infer schema from array of objects', () => {
      const validator = new SchemaValidator();
      const data = {
        users: [
          { name: 'John', age: 30 },
          { name: 'Jane', age: 25 },
        ],
      };

      const schema = validator.inferSchema(data);

      expect(schema.properties?.users.type).toBe('array');
      expect(schema.properties?.users.items?.type).toBe('object');
    });

    it('should handle empty arrays', () => {
      const validator = new SchemaValidator();
      const data = { items: [] };

      const schema = validator.inferSchema(data);

      expect(schema.properties?.items.type).toBe('array');
    });

    it('should handle null values', () => {
      const validator = new SchemaValidator();
      const data = { value: null };

      const schema = validator.inferSchema(data);

      expect(schema.properties?.value.type).toBeDefined();
    });

    it('should detect required fields', () => {
      const validator = new SchemaValidator();
      const data = {
        required1: 'value',
        required2: 42,
      };

      const schema = validator.inferSchema(data);

      expect(schema.required).toBeDefined();
      expect(schema.required).toContain('required1');
      expect(schema.required).toContain('required2');
    });
  });

  describe('Schema Metadata', () => {
    it('should extract metadata from schema', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'User name' },
          age: { type: 'integer' },
        },
      };

      const validator = new SchemaValidator(schema);
      const metadata = validator.getMetadata();

      expect(metadata.name).toBeDefined();
      expect(metadata.name.type).toBe('string');
      expect(metadata.name.description).toBe('User name');
    });

    it('should list object properties', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              firstName: { type: 'string' },
              lastName: { type: 'string' },
            },
          },
        },
      };

      const validator = new SchemaValidator(schema);
      const metadata = validator.getMetadata();

      expect(metadata.user.properties).toContain('firstName');
      expect(metadata.user.properties).toContain('lastName');
    });

    it('should include array item types', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          tags: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      };

      const validator = new SchemaValidator(schema);
      const metadata = validator.getMetadata();

      expect(metadata.tags.itemType).toBe('string');
    });
  });

  describe('Caching', () => {
    it('should cache compiled schemas', () => {
      const schema: JSONSchema = {
        $id: 'test-schema',
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      };

      const validator = new SchemaValidator(schema);
      const stats1 = validator.getCacheStats();

      expect(stats1.size).toBeGreaterThan(0);
    });

    it('should clear cache', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      };

      const validator = new SchemaValidator(schema);
      validator.clearCache();

      const stats = validator.getCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should reuse cached schemas', () => {
      const schema: JSONSchema = {
        $id: 'reusable-schema',
        type: 'object',
        properties: {
          value: { type: 'string' },
        },
      };

      const validator1 = new SchemaValidator(schema);
      const validator2 = new SchemaValidator();
      validator2.loadSchema(schema);

      // Both should work correctly
      expect(validator1.validate({ value: 'test' }).valid).toBe(true);
      expect(validator2.validate({ value: 'test' }).valid).toBe(true);
    });

    it('uses JSON stringification as a cache key when no $id is present', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          value: { type: 'string' },
        },
      };

      const validator = new SchemaValidator();
      validator.loadSchema(schema);

      const stats = validator.getCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.keys[0]).toContain('"type":"object"');
    });
  });

  describe('Valid Paths', () => {
    it('should return all valid paths', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' },
            },
          },
        },
      };

      const validator = new SchemaValidator(schema);
      const paths = validator.getValidPaths();

      expect(paths.has('user')).toBe(true);
      expect(paths.has('user.name')).toBe(true);
    });

    it('returns a defensive copy of valid paths', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: { user: { type: 'string' } },
      };

      const validator = new SchemaValidator(schema);
      const paths = validator.getValidPaths();
      paths.add('mutated');

      expect(validator.getValidPaths().has('mutated')).toBe(false);
    });
  });
});

describe('SchemaValidator metadata edge cases', () => {
  it('merges combinator metadata and preserves inferred container types', () => {
    const schema: JSONSchema = {
      type: 'object',
      properties: {
        target: {
          allOf: [
            { type: 'object', properties: { first: { type: 'string' } } },
            { anyOf: [{ type: 'object', properties: { second: { type: 'number' } } }] },
          ],
        },
      },
    };

    const metadata = new SchemaValidator(schema).getMetadata();
    expect(metadata.target.type).toBe('object');
    expect(metadata.target.properties).toEqual(expect.arrayContaining(['first', 'second']));
  });

  it('records array item metadata for tuple-style items', () => {
    const schema: JSONSchema = {
      type: 'object',
      properties: {
        entries: {
          type: 'array',
          items: [
            {
              type: 'object',
              properties: {
                name: { type: 'string' },
              },
            },
          ],
        },
      },
    };

    const metadata = new SchemaValidator(schema).getMetadata();
    expect(metadata.entries.itemType).toBe('object');
    expect(metadata['entries[0]'].type).toBe('object');
    expect(metadata['entries[0].name'].type).toBe('string');
  });

  it('merges combinator item metadata into an existing prefix', () => {
    const schema: JSONSchema = {
      type: 'object',
      properties: {
        target: {
          allOf: [
            { type: 'array', items: { type: 'string' } },
            { description: 'merged array metadata' },
          ],
        },
      },
    };

    const metadata = new SchemaValidator(schema).getMetadata();
    expect(metadata.target.type).toBe('array');
    expect(metadata.target.itemType).toBe('string');
  });

  it('handles non-array combinator values without throwing', () => {
    const validator = new SchemaValidator();
    const metadata = (validator as any).extractMetadata(
      {
        type: 'object',
        properties: {
          target: {
            allOf: { type: 'object' },
          },
        },
      },
      '',
      undefined
    );

    expect(metadata.target.type).toBe('any');
  });

  it('formats fallback Ajv error paths and default messages', () => {
    const validator = new SchemaValidator();
    const formatted = (validator as any).formatErrors([
      {
        keyword: 'custom',
        instancePath: '',
        schemaPath: '',
        params: {},
        message: '',
      },
    ]);

    expect(formatted).toEqual([{ path: '', message: 'Validation error' }]);
  });

  it('uses fallback compilation message when compileError is absent', () => {
    const validator = new SchemaValidator();
    (validator as any).currentSchema = { type: 'object' };
    (validator as any).validateFunction = undefined;
    (validator as any).compileError = undefined;

    expect(validator.validate({})).toEqual({
      valid: false,
      skipped: true,
      errors: [
        {
          path: '$schema',
          message: 'Schema validation unavailable because compilation failed.',
        },
      ],
    });
  });

  it('handles validateFunction errors fallback when the validator returns false without errors', () => {
    const validator = new SchemaValidator();
    (validator as any).currentSchema = { type: 'object' };
    (validator as any).validateFunction = () => false;

    const result = validator.validate({});
    expect(result).toEqual({ valid: false, errors: [] });
  });

  it('extracts union type strings from schema metadata', () => {
    const schema: JSONSchema = {
      type: 'object',
      properties: {
        status: {
          type: ['string', 'null'],
        },
      },
    };

    const metadata = new SchemaValidator(schema).getMetadata();
    expect(metadata.status.type).toBe('string|null');
  });

  it('infers array metadata when schema defines items without an explicit type', () => {
    const schema: JSONSchema = {
      type: 'object',
      properties: {
        list: {
          items: { type: 'string' },
        },
      },
    };

    const metadata = new SchemaValidator(schema).getMetadata();
    expect(metadata.list.type).toBe('array');
    expect(metadata.list.itemType).toBe('string');
  });

  it('handles root array schemas with union item types', () => {
    const schema: JSONSchema = {
      type: 'array',
      items: {
        type: ['string', 'null'],
      },
    };

    const metadata = new SchemaValidator(schema).getMetadata();
    expect(metadata['[0]'].type).toBe('string|null');
  });

  it('returns empty metadata for primitive non-object values in private extraction', () => {
    const validator = new SchemaValidator();
    expect((validator as any).extractMetadata('primitive', '', undefined)).toEqual({});
  });

  it('skips tuple item metadata when tuple array has no first item schema', () => {
    const schema: JSONSchema = {
      type: 'array',
      items: [],
    };

    const metadata = new SchemaValidator(schema).getMetadata();
    expect(metadata).toEqual({});
  });

  it('marks array-index metadata as not required when property name normalizes to empty', () => {
    const validator = new SchemaValidator();
    const metadata = (validator as any).extractMetadata({ type: 'string' }, '[0]', ['item']);

    expect(metadata['[0]']).toMatchObject({
      required: false,
      type: 'string',
    });
  });

  it('returns empty metadata for non-object values in private extraction', () => {
    const validator = new SchemaValidator();
    expect(() => (validator as any).extractMetadata(null, '', undefined)).toThrow();
  });
});

describe('Query Path Validator', () => {
  describe('extractPaths', () => {
    it('should extract simple object paths', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'integer' },
        },
      };

      const paths = extractPaths(schema);

      expect(paths.has('name')).toBe(true);
      expect(paths.has('age')).toBe(true);
    });

    it('should extract nested paths', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              profile: {
                type: 'object',
                properties: {
                  bio: { type: 'string' },
                },
              },
            },
          },
        },
      };

      const paths = extractPaths(schema);

      expect(paths.has('user')).toBe(true);
      expect(paths.has('user.profile')).toBe(true);
      expect(paths.has('user.profile.bio')).toBe(true);
    });

    it('should extract array paths', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
              },
            },
          },
        },
      };

      const paths = extractPaths(schema);

      expect(paths.has('items[0]')).toBe(true);
      expect(paths.has('items[0].name')).toBe(true);
    });

    it('should extract root-level array paths', () => {
      const schema: JSONSchema = {
        type: 'array',
        items: { type: 'string' },
      };

      const paths = extractPaths(schema);

      expect(paths.has('[0]')).toBe(true);
    });

    it('should skip tuple-style arrays with no first item schema', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: [],
          },
        },
      };

      const paths = extractPaths(schema);

      expect(paths.has('items')).toBe(true);
      expect(paths.has('items[0]')).toBe(false);
    });

    it('should extract paths through local #/definitions $ref', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          relationship: {
            $ref: '#/definitions/relationship',
          },
        },
        definitions: {
          relationship: {
            type: 'object',
            properties: {
              target: { type: 'string' },
              type: { type: 'string' },
            },
          },
        },
      };

      const paths = extractPaths(schema);

      expect(paths.has('relationship')).toBe(true);
      expect(paths.has('relationship.target')).toBe(true);
      expect(paths.has('relationship.type')).toBe(true);
    });

    it('should traverse local refs that point to schema objects describing arrays', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          list: {
            $ref: '#/$defs/list',
          },
        },
        $defs: {
          list: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      };

      const paths = extractPaths(schema);

      expect(paths.has('list')).toBe(true);
      expect(paths.has('list[0]')).toBe(true);
    });

    it('should extract paths through local #/$defs $ref in arrays', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          relationships: {
            type: 'array',
            items: {
              $ref: '#/$defs/relationship',
            },
          },
        },
        $defs: {
          relationship: {
            type: 'object',
            properties: {
              target: { type: 'string' },
              note: { type: 'string' },
            },
          },
        },
      };

      const paths = extractPaths(schema);

      expect(paths.has('relationships')).toBe(true);
      expect(paths.has('relationships[0]')).toBe(true);
      expect(paths.has('relationships[0].target')).toBe(true);
      expect(paths.has('relationships[0].note')).toBe(true);
    });

    it('should avoid infinite recursion for self-referential local $ref', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          node: {
            $ref: '#/definitions/node',
          },
        },
        definitions: {
          node: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              parent: { $ref: '#/definitions/node' },
            },
          },
        },
      };

      const paths = extractPaths(schema);

      expect(paths.has('node')).toBe(true);
      expect(paths.has('node.name')).toBe(true);
      expect(paths.has('node.parent')).toBe(true);
    });

    it('should ignore non-array combinator values when extracting paths', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          user: {
            allOf: { type: 'object' } as unknown as JSONSchema[],
          },
        },
      };

      const paths = extractPaths(schema);

      expect(paths.has('user')).toBe(true);
    });

    it('should skip root-level array tuple recursion when first item schema is absent', () => {
      const schema: JSONSchema = {
        type: 'array',
        items: [],
      };

      const paths = extractPaths(schema);
      expect(paths.size).toBe(0);
    });

    it('should keep prefix-only paths when local refs resolve to array schemas', () => {
      const schema: JSONSchema = {
        type: 'object',
        allOf: [{ type: 'string' }],
        properties: {
          alias: {
            $ref: '#/allOf',
          },
        },
      };

      const paths = extractPaths(schema);
      expect(paths.has('alias')).toBe(true);
      expect(paths.has('alias[0]')).toBe(false);
    });
  });

  describe('levenshteinDistance', () => {
    it('should calculate distance for identical strings', () => {
      expect(levenshteinDistance('hello', 'hello')).toBe(0);
    });

    it('should calculate distance for one character difference', () => {
      expect(levenshteinDistance('hello', 'hallo')).toBe(1);
    });

    it('should calculate distance for completely different strings', () => {
      const distance = levenshteinDistance('abc', 'xyz');
      expect(distance).toBe(3);
    });

    it('should handle empty strings', () => {
      expect(levenshteinDistance('', 'hello')).toBe(5);
      expect(levenshteinDistance('hello', '')).toBe(5);
    });
  });

  describe('fuzzyMatch', () => {
    it('should find close matches', () => {
      const validPaths = new Set(['firstName', 'lastName', 'email']);
      const suggestions = fuzzyMatch('firstNam', validPaths);

      expect(suggestions).toContain('firstName');
    });

    it('should return multiple suggestions', () => {
      const validPaths = new Set(['name', 'username', 'nickname']);
      const suggestions = fuzzyMatch('nam', validPaths);

      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('should limit results', () => {
      const validPaths = new Set(['a', 'b', 'c', 'd', 'e']);
      const suggestions = fuzzyMatch('x', validPaths, 2, 2);

      expect(suggestions.length).toBeLessThanOrEqual(2);
    });

    it('should return empty for no matches', () => {
      const validPaths = new Set(['firstName', 'lastName']);
      const suggestions = fuzzyMatch('completelydifferent', validPaths, 2);

      expect(suggestions).toHaveLength(0);
    });
  });

  describe('normalizePath', () => {
    it('should normalize array indices', () => {
      expect(normalizePath('items[5].name')).toBe('items[0].name');
      expect(normalizePath('items[123].value')).toBe('items[0].value');
    });

    it('should handle multiple array indices', () => {
      expect(normalizePath('a[1].b[2].c')).toBe('a[0].b[0].c');
    });

    it('should not change non-array paths', () => {
      expect(normalizePath('user.name')).toBe('user.name');
    });
  });

  describe('isValidPath', () => {
    it('should validate exact matches', () => {
      const validPaths = new Set(['user.name', 'user.email']);
      expect(isValidPath('user.name', validPaths)).toBe(true);
    });

    it('should validate normalized array paths', () => {
      const validPaths = new Set(['items[0].name']);
      expect(isValidPath('items[5].name', validPaths)).toBe(true);
    });

    it('matches equivalent normalized paths even when the stored path uses a different index', () => {
      const validPaths = new Set(['items[3].name']);
      expect(isValidPath('items[5].name', validPaths)).toBe(true);
    });

    it('should reject invalid paths', () => {
      const validPaths = new Set(['user.name']);
      expect(isValidPath('user.invalid', validPaths)).toBe(false);
    });

    it('extracts paths from local root refs, tuple arrays, and combinators', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          rootAlias: { $ref: '#' },
          tupleItems: {
            type: 'array',
            items: [
              {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                },
              },
            ],
          },
          combined: {
            allOf: [
              { type: 'object', properties: { first: { type: 'string' } } },
              { anyOf: [{ type: 'object', properties: { second: { type: 'number' } } }] },
              { oneOf: [{ type: 'object', properties: { third: { type: 'boolean' } } }] },
            ],
          },
        },
      };

      const paths = extractPaths(schema);
      expect(paths.has('rootAlias')).toBe(true);
      expect(paths.has('tupleItems[0]')).toBe(true);
      expect(paths.has('tupleItems[0].name')).toBe(true);
      expect(paths.has('combined.first')).toBe(true);
      expect(paths.has('combined.second')).toBe(true);
      expect(paths.has('combined.third')).toBe(true);
    });

    it('stops recursing on circular and unresolved refs', () => {
      const circularSchema: JSONSchema = {
        type: 'object',
        properties: {
          node: {
            $ref: '#/properties/node',
          },
          broken: {
            $ref: '#/properties/missing',
          },
        },
      };

      const paths = extractPaths(circularSchema);
      expect(paths.has('node')).toBe(true);
      expect(paths.has('broken')).toBe(true);
      expect(paths.has('node.node')).toBe(false);
    });

    it('falls back when a decoded pointer segment cannot be resolved', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          alias: {
            $ref: '#/properties/%ZZ',
          },
          '%ZZ': {
            type: 'string',
          },
        },
      };

      const paths = extractPaths(schema);
      expect(paths.has('alias')).toBe(true);
    });

    it('returns no extracted paths for non-object schema input', () => {
      expect(extractPaths('not-a-schema' as unknown as JSONSchema).size).toBe(0);
    });
  });
});

describe('Schema Inference', () => {
  describe('inferType', () => {
    it('should infer primitive types', () => {
      expect(inferType('hello')).toBe('string');
      expect(inferType(42)).toBe('integer');
      expect(inferType(3.14)).toBe('number');
      expect(inferType(true)).toBe('boolean');
      expect(inferType(null)).toBe('null');
    });

    it('should infer complex types', () => {
      expect(inferType([])).toBe('array');
      expect(inferType({})).toBe('object');
    });
  });

  describe('inferObjectSchema', () => {
    it('should infer object schema', () => {
      const obj = {
        name: 'John',
        age: 30,
      };

      const schema = inferObjectSchema(obj);

      expect(schema.type).toBe('object');
      expect(schema.properties?.name.type).toBe('string');
      expect(schema.properties?.age.type).toBe('integer');
      expect(schema.required).toContain('name');
      expect(schema.required).toContain('age');
    });

    it('should handle nested objects', () => {
      const obj = {
        user: {
          name: 'John',
        },
      };

      const schema = inferObjectSchema(obj);

      expect(schema.properties?.user.type).toBe('object');
    });
  });

  describe('inferArraySchema', () => {
    it('should infer array of primitives', () => {
      const schema = inferArraySchema(['a', 'b', 'c']);

      expect(schema.type).toBe('array');
      expect(Array.isArray(schema.items) ? schema.items[0]?.type : schema.items?.type).toBe(
        'string'
      );
    });

    it('should infer array of objects', () => {
      const schema = inferArraySchema([{ name: 'John' }, { name: 'Jane' }]);

      expect(schema.type).toBe('array');
      expect(Array.isArray(schema.items) ? schema.items[0]?.type : schema.items?.type).toBe(
        'object'
      );
    });

    it('should handle empty arrays', () => {
      const schema = inferArraySchema([]);

      expect(schema.type).toBe('array');
    });
  });

  describe('mergeSchemas', () => {
    it('should merge schemas of same type', () => {
      const schema1: JSONSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      };

      const schema2: JSONSchema = {
        type: 'object',
        properties: {
          age: { type: 'integer' },
        },
      };

      const merged = mergeSchemas(schema1, schema2);

      expect(merged.type).toBe('object');
      expect(merged.properties?.name).toBeDefined();
      expect(merged.properties?.age).toBeDefined();
    });

    it('should handle different types', () => {
      const schema1: JSONSchema = { type: 'string' };
      const schema2: JSONSchema = { type: 'integer' };

      const merged = mergeSchemas(schema1, schema2);

      expect(Array.isArray(merged.type) || merged.type).toBeTruthy();
    });

    it('should return single schema unchanged', () => {
      const schema: JSONSchema = { type: 'string' };
      const merged = mergeSchemas(schema);

      expect(merged).toEqual(schema);
    });

    it('should return empty for no schemas', () => {
      const merged = mergeSchemas();
      expect(merged).toEqual({});
    });

    it('should merge arrays with same element type', () => {
      const schema1: JSONSchema = {
        type: 'array',
        items: { type: 'string' },
      };

      const schema2: JSONSchema = {
        type: 'array',
        items: { type: 'string' },
      };

      const merged = mergeSchemas(schema1, schema2);

      expect(merged.type).toBe('array');
      expect(Array.isArray(merged.items) ? merged.items[0]?.type : merged.items?.type).toBe(
        'string'
      );
    });

    it('should merge arrays with different element types', () => {
      const schema1: JSONSchema = {
        type: 'array',
        items: { type: 'string' },
      };

      const schema2: JSONSchema = {
        type: 'array',
        items: { type: 'integer' },
      };

      const merged = mergeSchemas(schema1, schema2);

      expect(merged.type).toBe('array');
      expect(merged.items).toBeDefined();
      expect(Array.isArray(merged.items)).toBe(false);

      if (!Array.isArray(merged.items) && merged.items) {
        const itemTypes = Array.isArray(merged.items.type)
          ? merged.items.type
          : [merged.items.type];
        expect(itemTypes).toEqual(expect.arrayContaining(['string', 'integer']));
      }
    });

    it('should merge object properties recursively', () => {
      const schema1: JSONSchema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' },
            },
          },
        },
      };

      const schema2: JSONSchema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              age: { type: 'integer' },
            },
          },
        },
      };

      const merged = mergeSchemas(schema1, schema2);

      expect(merged.properties?.user.properties?.name).toBeDefined();
      expect(merged.properties?.user.properties?.age).toBeDefined();
    });

    it('should find common required properties', () => {
      const schema1: JSONSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'integer' },
        },
        required: ['name', 'age'],
      };

      const schema2: JSONSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
        },
        required: ['name', 'email'],
      };

      const merged = mergeSchemas(schema1, schema2);

      expect(merged.required).toContain('name');
      expect(merged.required?.length).toBe(1);
    });

    it('should handle object without required property', () => {
      const schema1: JSONSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      };

      const schema2: JSONSchema = {
        type: 'object',
        properties: {
          age: { type: 'integer' },
        },
      };

      const merged = mergeSchemas(schema1, schema2);

      expect(merged.required).toBeUndefined();
    });

    it('should merge arrays with tuple items', () => {
      const schema1: JSONSchema = {
        type: 'array',
        items: [{ type: 'string' }, { type: 'integer' }],
      };

      const schema2: JSONSchema = {
        type: 'array',
        items: [{ type: 'string' }, { type: 'number' }],
      };

      const merged = mergeSchemas(schema1, schema2);

      expect(merged.type).toBe('array');
      expect(merged.items).toBeDefined();
      expect(Array.isArray(merged.items)).toBe(false);

      if (!Array.isArray(merged.items) && merged.items) {
        const itemTypes = Array.isArray(merged.items.type)
          ? merged.items.type
          : [merged.items.type];
        expect(itemTypes).toEqual(expect.arrayContaining(['string', 'integer', 'number']));
      }
    });

    it('should merge arrays with empty items', () => {
      const schema1: JSONSchema = {
        type: 'array',
      };

      const schema2: JSONSchema = {
        type: 'array',
      };

      const merged = mergeSchemas(schema1, schema2);

      expect(merged.type).toBe('array');
      expect(merged.items).toEqual({});
    });

    it('should handle mixed type arrays', () => {
      const schema1: JSONSchema = {
        type: 'array',
        items: { type: 'string' },
      };

      const schema2: JSONSchema = {
        type: 'array',
        items: { type: ['string', 'integer'] },
      };

      const merged = mergeSchemas(schema1, schema2);

      expect(merged.type).toBe('array');
      expect(merged.items).toBeDefined();
      expect(Array.isArray(merged.items)).toBe(false);

      if (!Array.isArray(merged.items) && merged.items) {
        const itemTypes = Array.isArray(merged.items.type)
          ? merged.items.type
          : [merged.items.type];
        expect(itemTypes).toEqual(expect.arrayContaining(['string', 'integer']));
      }
    });

    it('should merge with non-array type property', () => {
      const schema1: JSONSchema = { type: 'object' };
      const schema2: JSONSchema = { type: 'object' };

      const merged = mergeSchemas(schema1, schema2);

      expect(merged.type).toBe('object');
    });
  });
});

describe('Integration Tests', () => {
  it('should validate and suggest for real-world schema', () => {
    const schema: JSONSchema = {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            email: { type: 'string', format: 'email' },
            age: { type: 'integer', minimum: 0 },
          },
          required: ['firstName', 'email'],
        },
        posts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              content: { type: 'string' },
              published: { type: 'boolean' },
            },
          },
        },
      },
    };

    const validator = new SchemaValidator(schema);

    // Valid data
    const validData = {
      user: {
        firstName: 'John',
        email: 'john@example.com',
        age: 30,
      },
      posts: [{ title: 'Post 1', content: 'Content', published: true }],
    };

    expect(validator.validate(validData).valid).toBe(true);

    // Invalid data - missing required field
    const invalidData = {
      user: { firstName: 'John' },
    };

    const result = validator.validate(invalidData);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);

    // Query path validation
    expect(validator.validateQueryPath('user.firstName').valid).toBe(true);
    expect(validator.validateQueryPath('posts[0].title').valid).toBe(true);
    expect(validator.validateQueryPath('user.invalid').valid).toBe(false);
  });

  it('should infer and validate with inferred schema', () => {
    const sampleData = {
      product: {
        name: 'Widget',
        price: 19.99,
        inStock: true,
      },
      tags: ['electronics', 'gadget'],
    };

    const validator = new SchemaValidator();
    const inferredSchema = validator.inferSchema(sampleData);

    validator.loadSchema(inferredSchema);

    // Should validate similar data
    const similarData = {
      product: {
        name: 'Gizmo',
        price: 29.99,
        inStock: false,
      },
      tags: ['tool'],
    };

    expect(validator.validate(similarData).valid).toBe(true);
  });

  it('should handle complex nested structures', () => {
    const schema: JSONSchema = {
      type: 'object',
      properties: {
        company: {
          type: 'object',
          properties: {
            departments: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  employees: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        firstName: { type: 'string' },
                        role: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const validator = new SchemaValidator(schema);
    const paths = validator.getValidPaths();

    expect(paths.has('company')).toBe(true);
    expect(paths.has('company.departments[0]')).toBe(true);
    expect(paths.has('company.departments[0].employees[0].firstName')).toBe(true);

    expect(validator.validateQueryPath('company.departments[0].name').valid).toBe(true);
  });

  describe('Cache Management', () => {
    it('should track cache statistics', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      };

      const validator = new SchemaValidator(schema);
      const stats = validator.getCacheStats();

      expect(stats.size).toBeGreaterThan(0);
      expect(stats.keys).toHaveLength(stats.size);
    });

    it('should clear compiled schema cache', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      };

      const validator = new SchemaValidator(schema);
      const initialStats = validator.getCacheStats();
      expect(initialStats.size).toBeGreaterThan(0);

      validator.clearCache();
      const clearedStats = validator.getCacheStats();
      expect(clearedStats.size).toBe(0);
    });

    it('should reuse compiled validator from cache for same schema', () => {
      const schema: JSONSchema = {
        $id: 'unique-schema-id',
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      };

      const validator = new SchemaValidator(schema);
      const stats1 = validator.getCacheStats();
      const cachedKeys1 = [...stats1.keys];

      // Verify schema was cached after initial load
      expect(stats1.size).toBeGreaterThan(0);

      // Load the same schema again - should retrieve from cache
      validator.loadSchema(schema);
      const stats2 = validator.getCacheStats();

      // Verify cache still contains the schema (not cleared and recompiled)
      expect(stats2.size).toBe(stats1.size);
      expect(stats2.keys).toEqual(cachedKeys1);

      // Verify validation still works (compiled validator is functional)
      const result = validator.validate({ name: 'test' });
      expect(result.valid).toBe(true);
    });
  });

  describe('Error Message Formatting', () => {
    it('should format enum validation errors', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          status: { enum: ['active', 'inactive', 'pending'] },
        },
      };

      const validator = new SchemaValidator(schema);
      const result = validator.validate({ status: 'invalid' });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should format additionalProperties validation errors', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        additionalProperties: false,
      };

      const validator = new SchemaValidator(schema);
      const result = validator.validate({ name: 'John', extra: 'field' });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(
        result.errors.some((error) => /additional|not allowed|not permitted/i.test(error.message))
      ).toBe(true);
    });

    it('should format oneOf validation errors', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          value: {
            oneOf: [{ type: 'string' }, { type: 'number' }],
          },
        },
      };

      const validator = new SchemaValidator(schema);
      const result = validator.validate({ value: [] });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((error) => /oneOf/i.test(error.message))).toBe(true);
    });

    it('should format array minItems validation error', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            minItems: 2,
          },
        },
      };

      const validator = new SchemaValidator(schema);
      const result = validator.validate({ items: [1] });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((error) => /fewer than|minItems/i.test(error.message))).toBe(true);
    });

    it('should improve format error messages', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
        },
      };

      const validator = new SchemaValidator(schema);
      const result = validator.validate({ email: 'invalid-email' });

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toMatch(/format|email/i);
    });
  });

  describe('Metadata Extraction Edge Cases', () => {
    it('should extract metadata from schema with object properties', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      };

      const validator = new SchemaValidator(schema);
      const metadata = validator.getMetadata();

      expect(metadata).toBeDefined();
      expect(Object.keys(metadata).length).toBeGreaterThan(0);
    });

    it('should handle array with no items schema', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          items: {
            type: 'array',
          },
        },
      };

      const validator = new SchemaValidator(schema);
      const metadata = validator.getMetadata();

      expect(metadata.items).toBeDefined();
    });

    it('should handle object with no properties', () => {
      const schema: JSONSchema = {
        type: 'object',
      };

      const validator = new SchemaValidator(schema);
      const metadata = validator.getMetadata();

      expect(metadata).toBeDefined();
    });

    it('should handle mixed array items (tuple)', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          tuple: {
            type: 'array',
            items: [{ type: 'string' }, { type: 'number' }],
          },
        },
      };

      const validator = new SchemaValidator(schema);
      const metadata = validator.getMetadata();

      expect(metadata.tuple).toBeDefined();
    });

    it('should extract deeply nested properties', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          level1: {
            type: 'object',
            properties: {
              level2: {
                type: 'object',
                properties: {
                  level3: { type: 'string' },
                },
              },
            },
          },
        },
      };

      const validator = new SchemaValidator(schema);
      const metadata = validator.getMetadata();

      expect(metadata['level1.level2.level3']).toBeDefined();
    });

    it('should extract metadata from allOf-composed root schemas', () => {
      const schema: JSONSchema = {
        allOf: [
          {
            type: 'object',
            properties: {
              milestoneObjective: { type: 'string' },
              successSignals: {
                type: 'array',
                items: { type: 'string' },
              },
            },
          },
        ],
      };

      const validator = new SchemaValidator(schema);
      const metadata = validator.getMetadata();

      expect(metadata.milestoneObjective).toBeDefined();
      expect(metadata.successSignals).toBeDefined();
      expect(metadata['successSignals[0]']).toBeDefined();
    });

    it('should preserve object metadata from combinator branches without an explicit type', () => {
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
      });
      expect(metadata.profile.properties).toEqual(expect.arrayContaining(['name', 'age']));
      expect(metadata['profile.name']?.type).toBe('string');
      expect(metadata['profile.age']?.type).toBe('integer');
    });

    it('should track property metadata at nested levels', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              profile: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                },
                required: ['name'],
              },
            },
            required: ['profile'],
          },
        },
      };

      const validator = new SchemaValidator(schema);
      const metadata = validator.getMetadata();

      expect(metadata['user.profile']).toBeDefined();
      expect(metadata['user.profile'].required).toBe(true);
    });
  });
});
