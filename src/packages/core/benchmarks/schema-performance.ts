/**
 * Performance benchmarks for SchemaValidator
 * Run with: node benchmarks/schema-performance.js
 */

import { SchemaValidator } from '../src/schema/SchemaValidator.js';

const complexSchema = {
  type: 'object',
  properties: {
    user: {
      type: 'object',
      properties: {
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        email: { type: 'string', format: 'email' },
        age: { type: 'integer', minimum: 0, maximum: 150 },
        address: {
          type: 'object',
          properties: {
            street: { type: 'string' },
            city: { type: 'string' },
            state: { type: 'string' },
            zip: { type: 'string', pattern: '^\\d{5}$' },
          },
        },
      },
      required: ['firstName', 'lastName', 'email'],
    },
    posts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 200 },
          content: { type: 'string' },
          published: { type: 'boolean' },
          tags: {
            type: 'array',
            items: { type: 'string' },
          },
          metadata: {
            type: 'object',
            properties: {
              views: { type: 'integer', minimum: 0 },
              likes: { type: 'integer', minimum: 0 },
            },
          },
        },
        required: ['title', 'content'],
      },
    },
  },
  required: ['user'],
};

const testData = {
  user: {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    age: 30,
    address: {
      street: '123 Main St',
      city: 'Springfield',
      state: 'IL',
      zip: '62701',
    },
  },
  posts: [
    {
      title: 'First Post',
      content: 'This is my first post',
      published: true,
      tags: ['introduction', 'first'],
      metadata: {
        views: 100,
        likes: 10,
      },
    },
  ],
};

function benchmark(name, fn, iterations = 1000) {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const end = performance.now();
  const total = end - start;
  const avg = total / iterations;

  console.log(`${name}:`);

  console.log(`  Total: ${total.toFixed(2)}ms`);

  console.log(`  Average: ${avg.toFixed(4)}ms`);

  console.log(`  Operations/sec: ${(1000 / avg).toFixed(0)}`);

  console.log();
}

console.log('Schema Validator Performance Benchmarks');
console.log('=======================================\n');

const resetSchemaAnalysisCache = () => {
  new SchemaValidator().clearCache();
};

// Benchmark: Schema compilation
benchmark(
  'Schema Compilation',
  () => {
    new SchemaValidator(complexSchema);
  },
  100
);

// Benchmark: full schema-analysis cold path (no shared cache)
benchmark(
  'Schema Analysis (Cold)',
  () => {
    resetSchemaAnalysisCache();
    const coldValidator = new SchemaValidator(complexSchema);
    coldValidator.getMetadata();
    coldValidator.getValidPaths();
  },
  100
);

// Benchmark: full schema-analysis warm path (shared cache hit)
resetSchemaAnalysisCache();
new SchemaValidator(complexSchema);
benchmark('Schema Analysis (Warm)', () => {
  const warmValidator = new SchemaValidator(complexSchema);
  warmValidator.getMetadata();
  warmValidator.getValidPaths();
});

// Benchmark: Data validation (with cached schema)
const validator = new SchemaValidator(complexSchema);
benchmark('Data Validation (Cached)', () => {
  validator.validate(testData);
});

// Benchmark: Query path validation
benchmark('Query Path Validation', () => {
  validator.validateQueryPath('user.firstName');
  validator.validateQueryPath('posts[0].title');
  validator.validateQueryPath('user.address.city');
});

// Benchmark: Schema inference
benchmark(
  'Schema Inference',
  () => {
    validator.inferSchema(testData);
  },
  100
);

// Benchmark: Fuzzy path matching
benchmark('Fuzzy Path Matching', () => {
  validator.validateQueryPath('user.firstNam'); // Should suggest firstName
  validator.validateQueryPath('posts[0].titl'); // Should suggest title
});

// Benchmark: Metadata extraction
benchmark('Metadata Extraction', () => {
  validator.getMetadata();
});

console.log('Cache Statistics:');
const stats = validator.getCacheStats();
console.log(`  Cached schemas: ${stats.size}`);
console.log(
  `  Cache keys: ${stats.keys.slice(0, 3).join(', ')}${stats.keys.length > 3 ? '...' : ''}`
);
