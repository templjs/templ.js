/**
 * Types for the template renderer
 */

import type { Position } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyValue = any;

/**
 * Render context containing data and scope information
 */
export interface RenderContext {
  /** Root data object for variable resolution */
  data: Record<string, AnyValue>;
  /** Stack of scopes for nested contexts (loops, conditionals) */
  scopes: Array<Record<string, AnyValue>>;
  /** Registered filter functions */
  filters: Map<string, FilterFunction>;
  /** Registered built-in functions */
  functions: Map<string, BuiltinFunction>;
  /** Error tracking during rendering */
  errors: RenderError[];
  /** Configuration options */
  options: RenderOptions;
}

/**
 * Rendering result with output and diagnostics
 */
export interface RenderResult {
  /** Rendered template output */
  output: string;
  /** Errors encountered during rendering */
  errors: RenderError[];
  /** Whether rendering completed successfully */
  success: boolean;
}

/**
 * Error that occurs during rendering
 */
export interface RenderError {
  /** Error message */
  message: string;
  /** Path to the failed variable or expression */
  path: string;
  /** Location in the source template */
  location?: {
    start: Position;
    end: Position;
  };
  /** Error category */
  type: 'undefined_variable' | 'type_error' | 'filter_error' | 'runtime_error';
}

/**
 * Filter function signature
 *
 * @param value - The value to filter
 * @param args - Arguments passed to the filter
 * @returns The filtered value
 */
export type FilterFunction = (value: AnyValue, ...args: AnyValue[]) => AnyValue;

/**
 * Built-in function signature
 *
 * @param context - The current render context
 * @param args - Arguments passed to the function
 * @returns The result of the function
 */
export type BuiltinFunction = (context: RenderContext, ...args: AnyValue[]) => AnyValue;

/**
 * Options for renderer behavior
 */
export interface RenderOptions {
  /** Whether to throw errors or collect them */
  throwOnError?: boolean;
  /** Whether to include undefined variables in output */
  includeUndefinedVars?: boolean;
  /** Default value for undefined variables */
  undefinedValue?: string;
  /** Maximum nesting depth for scopes */
  maxDepth?: number;
  /** Enable debug output */
  debug?: boolean;
}

/**
 * Type information for values
 */
export type ValueType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'array'
  | 'object'
  | 'function'
  | 'null'
  | 'undefined'
  | 'symbol';
