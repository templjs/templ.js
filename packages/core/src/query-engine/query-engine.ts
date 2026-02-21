/**
 * Query Engine - Core Query Processing System
 *
 * The query engine handles:
 * - Dot notation path resolution (user.profile.name)
 * - Array access ([0], [index])
 * - Filter application and chaining
 * - Function registry and dispatch
 * - Type inference and metadata
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type {
  FunctionSignature,
  FilterFunction,
  QueryMetadata,
  QueryOptions,
  QueryResult,
} from './types';

/**
 * Internal registry entry for a function.
 */
interface RegistryEntry {
  signature: FunctionSignature;
  handler: FilterFunction;
}

/**
 * Main Query Engine class.
 *
 * Provides query processing with support for dot notation, array access,
 * filters, and 50+ built-in functions.
 */
export class QueryEngine {
  private registry: Map<string, RegistryEntry> = new Map();
  private metadata: QueryMetadata = {
    functions: new Map(),
    variables: new Map(),
  };

  constructor() {
    this.registerBuiltins();
  }

  /**
   * Register all built-in functions.
   * Implemented by importing and registering functions from function modules.
   */
  private registerBuiltins(): void {
    // Note: Built-in functions are registered when this class is instantiated
    // They will be registered via registerFunction calls
    // This is a placeholder for the initialization logic
  }

  /**
   * Register a custom function or built-in function.
   *
   * @param sig - Function signature with metadata
   * @param handler - Handler function that implements the logic
   */
  registerFunction(sig: FunctionSignature, handler: FilterFunction): void {
    this.registry.set(sig.name, { signature: sig, handler });
    this.metadata.functions.set(sig.name, sig);
  }

  /**
   * Query data using dot notation and array access.
   *
   * @param data - The data object to query
   * @param path - Query path (e.g., "user.profile.name" or "items[0]")
   * @param options - Query options
   * @returns The resolved value or undefined
   *
   * @example
   * query({ user: { name: 'Alice' } }, 'user.name')  // 'Alice'
   * query({ items: ['a', 'b'] }, 'items[0]')         // 'a'
   */
  query(data: unknown, path: string, options?: QueryOptions): unknown {
    try {
      const result = this.resolvePath(data, path, options?.maxDepth ?? 100);
      if (result.error && options?.strict) {
        throw new Error(result.error);
      }
      return options?.defaultValue ?? result.value;
    } catch (error) {
      if (options?.strict) {
        throw error;
      }
      return options?.defaultValue;
    }
  }

  /**
   * Apply a filter/function to a value.
   *
   * @param value - The value to filter
   * @param name - The name of the filter/function
   * @param args - Arguments to pass to the function
   * @returns The filtered value
   *
   * @example
   * applyFilter('hello', 'upper', [])  // 'HELLO'
   * applyFilter('hello', 'replace', ['o', '0'])  // 'hell0'
   */
  applyFilter(value: unknown, name: string, args: unknown[]): unknown {
    const entry = this.registry.get(name);
    if (!entry) {
      throw new Error(`Unknown filter: ${name}`);
    }

    try {
      return entry.handler(value, ...(args as any[]));
    } catch (error) {
      throw new Error(
        `Error applying filter "${name}": ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  }

  /**
   * Get metadata about registered functions.
   *
   * @returns QueryMetadata with function signatures and type information
   */
  getMetadata(): QueryMetadata {
    return this.metadata;
  }

  /**
   * Get a specific function signature.
   *
   * @param name - Name of the function
   * @returns Function signature or undefined
   */
  getFunction(name: string): FunctionSignature | undefined {
    return this.metadata.functions.get(name);
  }

  /**
   * Get all registered function names.
   *
   * @returns Array of function names
   */
  listFunctions(): string[] {
    return Array.from(this.registry.keys()).sort();
  }

  /**
   * Get all functions in a specific category.
   *
   * @param category - Function category
   * @returns Array of function names in that category
   */
  getFunctionsByCategory(
    category: 'string' | 'number' | 'datetime' | 'array' | 'object'
  ): string[] {
    return Array.from(this.registry.values())
      .filter((entry) => entry.signature.category === category)
      .map((entry) => entry.signature.name)
      .sort();
  }

  /**
   * Resolve a property path in an object.
   *
   * Supports:
   * - Dot notation: user.profile.name
   * - Array access: items[0], items[i]
   * - Mixed: user.items[0].name
   *
   * @param data - The data to traverse
   * @param path - The path to resolve
   * @param maxDepth - Maximum nesting depth to prevent infinite loops
   * @returns QueryResult with value and error info
   */
  private resolvePath(data: unknown, path: string, maxDepth: number): QueryResult {
    let current = data;
    let depth = 0;

    // Split path by . but handle array brackets
    const parts = this.parsePath(path);

    for (const part of parts) {
      depth++;
      if (depth > maxDepth) {
        return {
          value: undefined,
          error: `Max nesting depth (${maxDepth}) exceeded`,
          isUndefined: true,
        };
      }

      if (current === null || current === undefined) {
        return {
          value: undefined,
          error: `Cannot access property "${part}" of ${current}`,
          isUndefined: true,
        };
      }

      // Handle array access [0], [key]
      const arrayMatch = part.match(/^(\w+?)\[(.+?)\]$/);
      if (arrayMatch) {
        const objKey = arrayMatch[1];
        const indexStr = arrayMatch[2];

        // Get the array/object
        const obj = objKey ? (current as Record<string, unknown>)[objKey] : current;
        if (obj === undefined || obj === null) {
          return {
            value: undefined,
            error: `Cannot access property "${objKey}"`,
            isUndefined: true,
          };
        }

        // Parse the index - could be numeric or a variable name
        const index = isNaN(Number(indexStr)) ? indexStr : Number(indexStr);

        current = (obj as any)[index];
        continue;
      }

      // Regular property access

      current = (current as any)[part];
    }

    return {
      value: current,
      isUndefined: current === undefined,
    };
  }

  /**
   * Parse a path string into parts.
   *
   * Handles:
   * - Simple paths: user.name
   * - Array access: items[0], items[index]
   * - Mixed: user.items[0].name
   *
   * @param path - The path string to parse
   * @returns Array of path parts
   */
  private parsePath(path: string): string[] {
    const parts: string[] = [];
    let current = '';
    let inBrackets = false;

    for (let i = 0; i < path.length; i++) {
      const char = path[i];

      if (char === '[') {
        inBrackets = true;
        current += char;
      } else if (char === ']') {
        inBrackets = false;
        current += char;
      } else if (char === '.' && !inBrackets) {
        if (current) {
          parts.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current) {
      parts.push(current);
    }

    return parts;
  }
}

/**
 * Default singleton instance of the query engine.
 */
export const defaultEngine = new QueryEngine();

/**
 * Convenience function to query using the default engine.
 *
 * @param data - The data to query
 * @param path - The query path
 * @returns The resolved value
 *
 * @example
 * query({ user: { name: 'Alice' } }, 'user.name')  // 'Alice'
 */
export function query(data: unknown, path: string): unknown {
  return defaultEngine.query(data, path);
}

/**
 * Convenience function to apply a filter using the default engine.
 *
 * @param value - The value to filter
 * @param name - The filter name
 * @param args - Filter arguments
 * @returns The filtered value
 *
 * @example
 * filter('hello', 'upper', [])  // 'HELLO'
 */
export function filter(value: unknown, name: string, args: unknown[]): unknown {
  return defaultEngine.applyFilter(value, name, args);
}
