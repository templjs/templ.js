/**
 * Comprehensive test suite for JSON Schema validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SchemaValidator } from './SchemaValidator';
import type { JSONSchema } from './types';
import {
  extractPaths,
  fuzzyMatch,
  levenshteinDistance,
  isValidPath,
  normalizePath,
} from './queryPathValidator';
import { inferType, inferObjectSchema, inferArraySchema, mergeSchemas } from './schemaInference';

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

    it('should throw error for invalid schema', () => {
      const validator = new SchemaValidator();
      const invalidSchema = {
        type: 'invalid-type',
      } as unknown as JSONSchema;

      expect(() => validator.loadSchema(invalidSchema)).toThrow();
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

    it('should reject invalid paths', () => {
      const validPaths = new Set(['user.name']);
      expect(isValidPath('user.invalid', validPaths)).toBe(false);
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
      expect(schema.items?.type).toBe('string');
    });

    it('should infer array of objects', () => {
      const schema = inferArraySchema([{ name: 'John' }, { name: 'Jane' }]);

      expect(schema.type).toBe('array');
      expect(schema.items?.type).toBe('object');
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
});
