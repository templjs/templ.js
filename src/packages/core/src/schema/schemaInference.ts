/**
 * JSON Schema inference from sample data
 */

import type { JSONSchema } from './types';

/**
 * Infer JSON type from a value
 * @param value - Value to inspect
 * @returns JSON Schema type string
 */
export function inferType(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  const type = typeof value;
  if (type === 'object') {
    return 'object';
  }
  if (type === 'boolean') {
    return 'boolean';
  }
  if (type === 'number') {
    return Number.isInteger(value) ? 'integer' : 'number';
  }
  if (type === 'string') {
    return 'string';
  }
  return 'string'; // fallback
}

/**
 * Infer JSON Schema from an object
 * @param obj - Object to infer from
 * @returns JSON Schema for the object
 */
export function inferObjectSchema(obj: Record<string, unknown>): JSONSchema {
  const properties: { [key: string]: JSONSchema } = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    properties[key] = inferSchemaFromValue(value);
    // Consider all present properties as required
    if (value !== undefined && value !== null) {
      required.push(key);
    }
  }

  return {
    type: 'object',
    properties,
    required: required.length > 0 ? required : undefined,
  };
}

/**
 * Infer JSON Schema from an array
 * @param arr - Array to infer from
 * @returns JSON Schema for the array
 */
export function inferArraySchema(arr: unknown[]): JSONSchema {
  if (arr.length === 0) {
    return {
      type: 'array',
      items: {},
    };
  }

  // Infer schema from all items and merge
  const itemSchemas = arr.map((item) => inferSchemaFromValue(item));
  const mergedItems = mergeSchemas(...itemSchemas);

  return {
    type: 'array',
    items: mergedItems,
  };
}

/**
 * Infer JSON Schema from a value
 * @param value - Value to infer from
 * @returns JSON Schema
 */
export function inferSchemaFromValue(value: unknown): JSONSchema {
  const type = inferType(value);

  if (type === 'object' && value !== null) {
    return inferObjectSchema(value as Record<string, unknown>);
  }

  if (type === 'array') {
    return inferArraySchema(value as unknown[]);
  }

  if (type === 'null') {
    return { type: ['null', 'string'] }; // Assume nullable string
  }

  return { type };
}

/**
 * Merge multiple JSON Schemas into one
 * Useful for inferring schema from multiple samples
 * @param schemas - Schemas to merge
 * @returns Merged schema
 */
export function mergeSchemas(...schemas: JSONSchema[]): JSONSchema {
  if (schemas.length === 0) {
    return {};
  }

  if (schemas.length === 1) {
    return schemas[0];
  }

  // Collect all types
  const types = new Set<string>();
  schemas.forEach((schema) => {
    if (schema.type) {
      if (Array.isArray(schema.type)) {
        schema.type.forEach((t) => types.add(t));
      } else {
        types.add(schema.type);
      }
    }
  });

  // If all same type, merge deeply
  if (types.size === 1) {
    const type = Array.from(types)[0];

    if (type === 'object') {
      return mergeObjectSchemas(schemas);
    }

    if (type === 'array') {
      return mergeArraySchemas(schemas);
    }

    return { type };
  }

  // Different types - use anyOf or type array
  const typeArray = Array.from(types);
  return {
    type: typeArray.length > 1 ? typeArray : typeArray[0],
  };
}

/**
 * Merge object schemas
 * @param schemas - Object schemas to merge
 * @returns Merged object schema
 */
function mergeObjectSchemas(schemas: JSONSchema[]): JSONSchema {
  const allProperties: { [key: string]: JSONSchema[] } = {};
  const requiredSets: Set<string>[] = [];

  for (const schema of schemas) {
    if (schema.properties) {
      for (const [key, prop] of Object.entries(schema.properties)) {
        if (!allProperties[key]) {
          allProperties[key] = [];
        }
        allProperties[key].push(prop);
      }
    }
    if (schema.required) {
      requiredSets.push(new Set(schema.required));
    }
  }

  // Merge properties
  const properties: { [key: string]: JSONSchema } = {};
  for (const [key, propSchemas] of Object.entries(allProperties)) {
    properties[key] = mergeSchemas(...propSchemas);
  }

  // Find common required fields
  const required =
    requiredSets.length > 0
      ? Array.from(
          requiredSets.reduce((acc, set) => {
            const intersection = new Set<string>();
            for (const item of acc) {
              if (set.has(item)) {
                intersection.add(item);
              }
            }
            return intersection;
          })
        )
      : undefined;

  return {
    type: 'object',
    properties,
    required: required && required.length > 0 ? required : undefined,
  };
}

/**
 * Merge array schemas
 * @param schemas - Array schemas to merge
 * @returns Merged array schema
 */
function mergeArraySchemas(schemas: JSONSchema[]): JSONSchema {
  const itemSchemas: JSONSchema[] = [];

  for (const schema of schemas) {
    if (schema.items) {
      if (Array.isArray(schema.items)) {
        itemSchemas.push(...schema.items);
      } else {
        itemSchemas.push(schema.items);
      }
    }
  }

  if (itemSchemas.length === 0) {
    return { type: 'array', items: {} };
  }

  return {
    type: 'array',
    items: mergeSchemas(...itemSchemas),
  };
}
