/**
 * JSON Schema validator using Ajv
 */

import Ajv2020 from 'ajv/dist/2020.js';
import type { ValidateFunction, ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import type { ValidationResult, ValidationError, SchemaMetadata, JSONSchema } from './types.js';
import { extractPaths, fuzzyMatch, isValidPath, normalizePath } from './queryPathValidator.js';
import { inferSchemaFromValue } from './schemaInference.js';

interface SchemaAnalysisCacheEntry {
  canonicalSchema: string;
  validPaths: Set<string>;
  metadata: SchemaMetadata;
}

const DEFAULT_SHARED_SCHEMA_CACHE_LIMIT = 128;
const sharedSchemaAnalysisCache = new Map<string, SchemaAnalysisCacheEntry>();

function cloneMetadata(metadata: SchemaMetadata): SchemaMetadata {
  const clone: SchemaMetadata = {};

  for (const [path, entry] of Object.entries(metadata)) {
    clone[path] = {
      ...entry,
      properties: entry.properties ? [...entry.properties] : undefined,
    };
  }

  return clone;
}

function canonicalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeValue(item));
  }

  if (value && typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    const sortedKeys = Object.keys(objectValue).sort();
    const canonicalObject: Record<string, unknown> = {};

    for (const key of sortedKeys) {
      canonicalObject[key] = canonicalizeValue(objectValue[key]);
    }

    return canonicalObject;
  }

  return value;
}

function canonicalStringify(value: unknown): string {
  return JSON.stringify(canonicalizeValue(value));
}

function hashString(input: string): string {
  let hash = 2166136261;

  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Schema validator with query path validation and schema inference
 */
export class SchemaValidator {
  private ajv: Ajv2020;
  private currentSchema: JSONSchema | null = null;
  private validPaths: Set<string> = new Set();
  private metadata: SchemaMetadata = {};
  private validateFunction: ValidateFunction | null = null;
  private compileError: string | null = null;

  /**
   * Create a new SchemaValidator
   * @param schema - Optional JSON Schema to initialize with
   */
  constructor(schema?: JSONSchema) {
    this.ajv = new Ajv2020({
      allErrors: true,
      verbose: true,
      strictSchema: false,
    });
    addFormats(this.ajv);

    if (schema) {
      this.loadSchema(schema);
    }
  }

  /**
   * Load and compile a JSON Schema
   * @param schema - JSON Schema object
   */
  loadSchema(schema: JSONSchema): void {
    this.currentSchema = schema;

    const canonicalSchema = canonicalStringify(schema);
    const cacheKey = this.getCacheKey(schema, canonicalSchema);

    // Check shared analysis cache first.
    const cached = sharedSchemaAnalysisCache.get(cacheKey);
    if (cached && cached.canonicalSchema === canonicalSchema) {
      this.validPaths = new Set(cached.validPaths);
      this.metadata = cloneMetadata(cached.metadata);
    } else {
      this.validPaths = extractPaths(schema);
      this.metadata = this.extractMetadata(schema);

      sharedSchemaAnalysisCache.set(cacheKey, {
        canonicalSchema,
        validPaths: new Set(this.validPaths),
        metadata: cloneMetadata(this.metadata),
      });

      while (sharedSchemaAnalysisCache.size > DEFAULT_SHARED_SCHEMA_CACHE_LIMIT) {
        const firstKey = sharedSchemaAnalysisCache.keys().next().value;
        if (typeof firstKey !== 'string') {
          break;
        }
        sharedSchemaAnalysisCache.delete(firstKey);
      }
    }

    // Compile schema per instance Ajv to avoid cross-instance Ajv state coupling.
    try {
      this.validateFunction = this.ajv.compile(schema);
      this.compileError = null;
    } catch (error) {
      // Degrade gracefully: unknown meta-schema or unresolvable remote $ref.
      // Validation is skipped; completions and hover still work.
      this.validateFunction = null;
      this.compileError = (error as Error).message;
    }
  }

  /** Whether the schema compiled successfully. False means validation is skipped. */
  get isCompiled(): boolean {
    return this.validateFunction !== null;
  }

  /** The compile error message if compilation failed, otherwise null. */
  get compilationError(): string | null {
    return this.compileError;
  }

  /**
   * Validate data against the loaded schema
   * @param data - Data to validate
   * @returns Validation result with errors if any
   */
  validate(data: unknown): ValidationResult {
    if (!this.currentSchema) {
      throw new Error('No schema loaded. Call loadSchema() first.');
    }
    // Schema loaded but compile failed (e.g. remote $ref, unknown meta-schema).
    if (!this.validateFunction) {
      return {
        valid: false,
        errors: [
          {
            path: '$schema',
            message:
              this.compileError ?? 'Schema validation unavailable because compilation failed.',
          },
        ],
        skipped: true,
      };
    }

    const valid = this.validateFunction(data);

    if (valid) {
      return { valid: true, errors: [] };
    }

    const errors = this.formatErrors(this.validateFunction.errors || []);
    return { valid: false, errors };
  }

  /**
   * Validate a query path against the schema
   * @param path - Query path (e.g., `user.name`, `users[0].email`)
   * @returns Validation result with suggestions if invalid
   */
  validateQueryPath(path: string): ValidationResult {
    if (!this.currentSchema) {
      throw new Error('No schema loaded. Call loadSchema() first.');
    }

    // Check if path is valid
    if (isValidPath(path, this.validPaths)) {
      return { valid: true, errors: [] };
    }

    // Path is invalid, find suggestions
    const normalizedPath = normalizePath(path);
    const suggestions = fuzzyMatch(normalizedPath, this.validPaths);

    const error: ValidationError = {
      path,
      message: 'Property not found in schema',
      suggestion: suggestions.length > 0 ? `Did you mean: ${suggestions.join(', ')}?` : undefined,
    };

    return { valid: false, errors: [error] };
  }

  /**
   * Infer a JSON Schema from sample data
   * @param data - Sample data to infer from
   * @returns Inferred JSON Schema
   */
  inferSchema(data: unknown): JSONSchema {
    return inferSchemaFromValue(data);
  }

  /**
   * Get schema metadata for IDE completion
   * @returns Schema metadata with property information
   */
  getMetadata(): SchemaMetadata {
    if (!this.currentSchema) {
      return {};
    }

    return cloneMetadata(this.metadata);
  }

  /**
   * Get all valid paths from the current schema
   * @returns Set of valid paths
   */
  getValidPaths(): Set<string> {
    return new Set(this.validPaths);
  }

  /**
   * Clear the shared process-wide compiled schema cache.
   */
  static clearCache(): void {
    sharedSchemaAnalysisCache.clear();
  }

  /**
   * Clear compiled schema cache.
   *
   * @deprecated Prefer SchemaValidator.clearCache() to make the process-wide
   * side effect explicit.
   */
  clearCache(): void {
    SchemaValidator.clearCache();
  }

  /**
   * Get cache statistics
   * @returns Object with cache size and keys
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: sharedSchemaAnalysisCache.size,
      keys: Array.from(sharedSchemaAnalysisCache.keys()),
    };
  }

  /**
   * Format Ajv validation errors
   * @param ajvErrors - Ajv error objects
   * @returns Formatted validation errors
   */
  private formatErrors(ajvErrors: ErrorObject[]): ValidationError[] {
    return ajvErrors.map((error) => {
      const pathStr = error.instancePath || error.schemaPath || '/';
      const path = String(pathStr);
      let message = error.message || 'Validation error';

      // Enhance error messages
      if (error.keyword === 'required') {
        const missingProperty = (error.params as { missingProperty?: string }).missingProperty;
        message = `must have required property '${missingProperty}'`;
      } else if (error.keyword === 'type') {
        const expectedType = (error.params as { type?: string }).type;
        message = `must be ${expectedType}`;
      } else if (error.keyword === 'format') {
        const format = (error.params as { format?: string }).format;
        message = `must match format "${format}"`;
      }

      return {
        path: path.replace(/^\//, '').replace(/\//g, '.'),
        message,
      };
    });
  }

  /**
   * Extract metadata from schema for IDE features
   * @param schema - JSON Schema
   * @param prefix - Current path prefix
   * @param parentRequired - Parent required field names
   * @returns Schema metadata
   */
  private extractMetadata(
    schema: JSONSchema,
    prefix = '',
    parentRequired?: string[]
  ): SchemaMetadata {
    const metadata: SchemaMetadata = {};
    const inferredType = Array.isArray(schema?.type)
      ? schema.type.join('|')
      : (schema?.type ?? (schema?.properties ? 'object' : schema?.items ? 'array' : 'any'));
    const isObjectSchema = schema.type === 'object' || !!schema.properties;
    const isArraySchema = schema.type === 'array' || schema.items !== undefined;

    if (!schema || typeof schema !== 'object') {
      return metadata;
    }

    // Add current level metadata
    if (prefix) {
      const propertyName = prefix
        .split('.')
        .pop()
        ?.replace(/\[0\]$/, '');
      metadata[prefix] = {
        type: inferredType,
        description: schema.description,
        required: propertyName ? (parentRequired?.includes(propertyName) ?? false) : false,
      };
    }

    // Handle object properties
    if (isObjectSchema && schema.properties) {
      const propertyNames = Object.keys(schema.properties).sort();

      if (prefix) {
        metadata[prefix].properties = propertyNames;
      }

      for (const [key, subSchema] of Object.entries(schema.properties)) {
        const newPrefix = prefix ? `${prefix}.${key}` : key;
        const subMetadata = this.extractMetadata(
          subSchema,
          newPrefix,
          Array.isArray(schema.required) ? schema.required : undefined
        );
        Object.assign(metadata, subMetadata);
      }
    }

    // Handle array items
    if (isArraySchema && schema.items) {
      const itemsSchema = Array.isArray(schema.items) ? schema.items[0] : schema.items;
      if (itemsSchema) {
        const itemType = itemsSchema.type;
        if (prefix) {
          metadata[prefix].itemType = Array.isArray(itemType) ? itemType.join('|') : itemType;
        }

        const arrayPrefix = prefix ? `${prefix}[0]` : '[0]';
        // Array items don't have parent required, use undefined
        const subMetadata = this.extractMetadata(itemsSchema, arrayPrefix, undefined);
        Object.assign(metadata, subMetadata);
      }
    }

    // Handle combinators (allOf/anyOf/oneOf)
    const combinators = [schema.allOf, schema.anyOf, schema.oneOf].filter(Boolean);
    for (const combinator of combinators) {
      if (!Array.isArray(combinator)) {
        continue;
      }

      for (const subSchema of combinator) {
        const subMetadata = this.extractMetadata(subSchema, prefix, parentRequired);

        if (prefix && subMetadata[prefix]?.properties && !subMetadata[prefix].type) {
          subMetadata[prefix].type = 'object';
        }

        if (prefix && metadata[prefix] && subMetadata[prefix]) {
          const current = metadata[prefix];
          const incoming = subMetadata[prefix];

          if (incoming.properties) {
            current.properties = Array.from(
              new Set([...(current.properties ?? []), ...incoming.properties])
            ).sort();
          }

          if (incoming.itemType && !current.itemType) {
            current.itemType = incoming.itemType;
          }

          if (current.type === 'any' && incoming.type) {
            current.type = incoming.type;
          }

          delete subMetadata[prefix];
        }

        Object.assign(metadata, subMetadata);
      }
    }

    return metadata;
  }

  /**
   * Generate cache key for a schema
   * @param schema - JSON Schema
   * @param canonicalSchema - Canonical schema string
   * @returns Cache key string
   */
  private getCacheKey(schema: JSONSchema, canonicalSchema: string): string {
    const schemaId = schema.$id ?? 'no-id';
    const schemaHash = hashString(canonicalSchema);
    return `${schemaId}::${schemaHash}`;
  }
}
