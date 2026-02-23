/**
 * JSON Schema validator using Ajv
 */

import Ajv from 'ajv';
import type { ValidateFunction, ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import type { ValidationResult, ValidationError, SchemaMetadata, JSONSchema } from './types';
import { extractPaths, fuzzyMatch, isValidPath, normalizePath } from './queryPathValidator';
import { inferSchemaFromValue } from './schemaInference';

/**
 * Schema validator with query path validation and schema inference
 */
export class SchemaValidator {
  private ajv: Ajv;
  private currentSchema: JSONSchema | null = null;
  private validPaths: Set<string> = new Set();
  private compiledSchemas: Map<string, ValidateFunction> = new Map();
  private validateFunction: ValidateFunction | null = null;

  /**
   * Create a new SchemaValidator
   * @param schema - Optional JSON Schema to initialize with
   */
  constructor(schema?: JSONSchema) {
    this.ajv = new Ajv({
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
    this.validPaths = extractPaths(schema);

    // Clear cache when loading new schema
    this.compiledSchemas.clear();

    // Generate cache key
    const cacheKey = this.getCacheKey(schema);

    // Check cache
    if (this.compiledSchemas.has(cacheKey)) {
      this.validateFunction = this.compiledSchemas.get(cacheKey)!;
      return;
    }

    // Compile schema
    try {
      this.validateFunction = this.ajv.compile(schema);
      if (this.validateFunction) {
        this.compiledSchemas.set(cacheKey, this.validateFunction);
      }
    } catch (error) {
      throw new Error(`Failed to compile schema: ${(error as Error).message}`, { cause: error });
    }
  }

  /**
   * Validate data against the loaded schema
   * @param data - Data to validate
   * @returns Validation result with errors if any
   */
  validate(data: unknown): ValidationResult {
    if (!this.validateFunction || !this.currentSchema) {
      throw new Error('No schema loaded. Call loadSchema() first.');
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
   * @param path - Query path (e.g., 'user.name', 'users[0].email')
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

    return this.extractMetadata(this.currentSchema);
  }

  /**
   * Get all valid paths from the current schema
   * @returns Set of valid paths
   */
  getValidPaths(): Set<string> {
    return new Set(this.validPaths);
  }

  /**
   * Clear compiled schema cache
   */
  clearCache(): void {
    this.compiledSchemas.clear();
  }

  /**
   * Get cache statistics
   * @returns Object with cache size and keys
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.compiledSchemas.size,
      keys: Array.from(this.compiledSchemas.keys()),
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
   * @returns Schema metadata
   */
  private extractMetadata(schema: JSONSchema, prefix = ''): SchemaMetadata {
    const metadata: SchemaMetadata = {};

    if (!schema || typeof schema !== 'object') {
      return metadata;
    }

    // Add current level metadata
    if (prefix) {
      metadata[prefix] = {
        type: Array.isArray(schema.type) ? schema.type.join('|') : schema.type || 'any',
        description: schema.description,
        required: schema.required !== undefined,
      };
    }

    // Handle object properties
    if (schema.type === 'object' && schema.properties) {
      const propertyNames = Object.keys(schema.properties);

      if (prefix) {
        metadata[prefix].properties = propertyNames;
      }

      for (const [key, subSchema] of Object.entries(schema.properties)) {
        const newPrefix = prefix ? `${prefix}.${key}` : key;
        const subMetadata = this.extractMetadata(subSchema, newPrefix);
        Object.assign(metadata, subMetadata);
      }
    }

    // Handle array items
    if (schema.type === 'array' && schema.items) {
      const itemsSchema = Array.isArray(schema.items) ? schema.items[0] : schema.items;
      if (itemsSchema) {
        const itemType = itemsSchema.type;
        if (prefix) {
          metadata[prefix].itemType = Array.isArray(itemType) ? itemType.join('|') : itemType;
        }

        const arrayPrefix = prefix ? `${prefix}[0]` : '[0]';
        const subMetadata = this.extractMetadata(itemsSchema, arrayPrefix);
        Object.assign(metadata, subMetadata);
      }
    }

    return metadata;
  }

  /**
   * Generate cache key for a schema
   * @param schema - JSON Schema
   * @returns Cache key string
   */
  private getCacheKey(schema: JSONSchema): string {
    // Use $id if available, otherwise stringify
    return schema.$id || JSON.stringify(schema);
  }
}
