/**
 * Query Engine Type Definitions
 *
 * Defines interfaces for function signatures, query metadata, and filter operations.
 */

/**
 * Represents a parameter for a function in the query engine.
 */
export interface FunctionParameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
  examples?: string[];
}

/**
 * Represents the signature of a registered function.
 */
export interface FunctionSignature {
  name: string;
  category: 'string' | 'number' | 'datetime' | 'array' | 'object';
  description: string;
  parameters: FunctionParameter[];
  returnType: string;
  examples: string[];
}

/**
 * Type information for a variable or value.
 */
export interface TypeInfo {
  type: string;
  properties?: Record<string, TypeInfo>;
  items?: TypeInfo;
  description?: string;
}

/**
 * Metadata about available queries, functions, and variables.
 */
export interface QueryMetadata {
  functions: Map<string, FunctionSignature>;
  variables: Map<string, TypeInfo>;
}

/**
 * A filter/function that can be applied to values in the query engine.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FilterFunction = (value: any, ...args: any[]) => any;

/**
 * Options for query execution.
 */
export interface QueryOptions {
  strict?: boolean; // If true, throw on missing properties (default: false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  defaultValue?: any; // Value to return for undefined paths (default: undefined)
  maxDepth?: number; // Maximum nesting depth (default: 100)
}

/**
 * Result of a query operation.
 */
export interface QueryResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
  error?: string;
  isUndefined: boolean;
}
