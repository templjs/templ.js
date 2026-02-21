/**
 * Variable and property resolution with dot notation and array access
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

type AnyValue = any;

/**
 * Resolves variable references and property access
 *
 * Supports:
 * - Simple variables: "user"
 * - Property access: "user.name", "user.profile.email"
 * - Array access: "users[0]", "user.emails[1]"
 * - Mixed: "users[0].name"
 */
export class VariableResolver {
  /**
   * Resolve a variable path using dot notation and array access
   *
   * @param data - The data object to resolve from
   * @param path - The path string (e.g., "user.name" or "items[0].id")
   * @returns The resolved value, or undefined if not found
   */
  resolve(data: AnyValue, path: string): AnyValue {
    if (!path || !data) {
      return undefined;
    }

    const parts = this.parsePath(path);

    let current: any = data;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }

      if (part.type === 'property') {
        current = current[part.value];
      } else if (part.type === 'index') {
        const index = parseInt(part.value, 10);
        if (Number.isNaN(index)) {
          return undefined;
        }

        current = current[index];
      }
    }

    return current;
  }

  /**
   * Parse a path string into segments
   *
   * @example
   * parsePath("user.name") => [{ type: 'property', value: 'user' }, { type: 'property', value: 'name' }]
   * parsePath("items[0].name") => [{ type: 'property', value: 'items' }, { type: 'index', value: '0' }, { type: 'property', value: 'name' }]
   */
  private parsePath(path: string): Array<{ type: 'property' | 'index'; value: string }> {
    const parts: Array<{ type: 'property' | 'index'; value: string }> = [];
    let current = '';
    let i = 0;

    while (i < path.length) {
      const char = path[i];

      if (char === '.') {
        if (current) {
          parts.push({ type: 'property', value: current });
          current = '';
        }
        i++;
      } else if (char === '[') {
        if (current) {
          parts.push({ type: 'property', value: current });
          current = '';
        }

        // Find closing bracket
        let bracketContent = '';
        i++;
        while (i < path.length && path[i] !== ']') {
          bracketContent += path[i];
          i++;
        }

        if (i < path.length && path[i] === ']') {
          // Remove quotes if present
          const cleanContent = bracketContent.replace(/^['"]|['"]$/g, '');
          parts.push({ type: 'index', value: cleanContent });
          i++;
        }
      } else if (char === ']') {
        // Unexpected closing bracket, skip
        i++;
      } else {
        current += char;
        i++;
      }
    }

    if (current) {
      parts.push({ type: 'property', value: current });
    }

    return parts;
  }

  /**
   * Get the type of a value
   */
  getType(value: AnyValue): string {
    if (value === null) {
      return 'null';
    }
    if (value === undefined) {
      return 'undefined';
    }
    if (Array.isArray(value)) {
      return 'array';
    }
    return typeof value;
  }

  /**
   * Check if a value is iterable (array or object)
   */
  isIterable(value: AnyValue): boolean {
    return Array.isArray(value) || (typeof value === 'object' && value !== null);
  }

  /**
   * Convert a value to boolean for conditional checks
   */
  toBoolean(value: AnyValue): boolean {
    if (value === null || value === undefined) {
      return false;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value !== 0;
    }
    if (typeof value === 'string') {
      return value.length > 0;
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (typeof value === 'object') {
      return Object.keys(value).length > 0;
    }
    return true;
  }

  /**
   * Convert a value to string
   */
  toString(value: AnyValue): string {
    if (value === null) {
      return '';
    }
    if (value === undefined) {
      return '';
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number') {
      return String(value);
    }
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    if (Array.isArray(value)) {
      return value.map((v) => this.toString(v)).join(',');
    }
    if (typeof value === 'object') {
      return '[object Object]';
    }
    return String(value);
  }
}
