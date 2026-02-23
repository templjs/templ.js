/**
 * JSON Schema validation types
 */

/**
 * Result of a validation operation
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Individual validation error with optional suggestion
 */
export interface ValidationError {
  path: string;
  message: string;
  suggestion?: string;
}

/**
 * Schema metadata for IDE completion and type information
 */
export interface SchemaMetadata {
  [key: string]: {
    type: string;
    properties?: string[];
    itemType?: string;
    required?: boolean;
    description?: string;
  };
}

/**
 * JSON Schema format (subset of JSON Schema v7)
 */
export interface JSONSchema {
  $id?: string;
  $ref?: string;
  $schema?: string;
  type?: string | string[];
  properties?: { [key: string]: JSONSchema };
  items?: JSONSchema | JSONSchema[];
  required?: string[];
  enum?: unknown[];
  const?: unknown;
  allOf?: JSONSchema[];
  anyOf?: JSONSchema[];
  oneOf?: JSONSchema[];
  not?: JSONSchema;
  format?: string;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  minProperties?: number;
  maxProperties?: number;
  additionalProperties?: boolean | JSONSchema;
  patternProperties?: { [key: string]: JSONSchema };
  dependencies?: { [key: string]: JSONSchema | string[] };
  title?: string;
  description?: string;
  default?: unknown;
  examples?: unknown[];
  definitions?: { [key: string]: JSONSchema };
}
