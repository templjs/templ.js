/**
 * Query path validation utilities
 */

import type { JSONSchema } from './types';

/**
 * Extract all valid paths from a JSON Schema
 * @param schema - JSON Schema object
 * @param prefix - Current path prefix for recursion
 * @returns Set of valid dot-notation paths
 */
export function extractPaths(schema: JSONSchema, prefix = ''): Set<string> {
  const paths = new Set<string>();

  if (!schema || typeof schema !== 'object') {
    return paths;
  }

  // Add current path if not root
  if (prefix) {
    paths.add(prefix);
  }

  // Handle $ref
  if (schema.$ref) {
    // Note: Full $ref resolution would require a schema registry
    // For now, we just note that the path exists
    return paths;
  }

  // Handle object properties
  if (schema.type === 'object' && schema.properties) {
    for (const [key, subSchema] of Object.entries(schema.properties)) {
      const newPrefix = prefix ? `${prefix}.${key}` : key;
      const subPaths = extractPaths(subSchema, newPrefix);
      subPaths.forEach((p) => paths.add(p));
    }
  }

  // Handle arrays
  if (schema.type === 'array' && schema.items) {
    const itemsSchema = Array.isArray(schema.items) ? schema.items[0] : schema.items;
    if (itemsSchema) {
      // Add array indexing patterns
      const arrayPrefix = prefix ? `${prefix}[0]` : '[0]';
      paths.add(arrayPrefix);
      const subPaths = extractPaths(itemsSchema, arrayPrefix);
      subPaths.forEach((p) => paths.add(p));
    }
  }

  // Handle allOf, anyOf, oneOf
  const combinators = [schema.allOf, schema.anyOf, schema.oneOf].filter(Boolean);
  for (const combinator of combinators) {
    if (Array.isArray(combinator)) {
      for (const subSchema of combinator) {
        const subPaths = extractPaths(subSchema, prefix);
        subPaths.forEach((p) => paths.add(p));
      }
    }
  }

  return paths;
}

/**
 * Calculate Levenshtein distance between two strings
 * @param a - First string
 * @param b - Second string
 * @returns Edit distance between strings
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Find similar paths using fuzzy matching
 * @param input - Input path to match
 * @param validPaths - Set of valid paths
 * @param maxDistance - Maximum Levenshtein distance (default: 2)
 * @param maxResults - Maximum number of suggestions (default: 3)
 * @returns Array of suggested paths sorted by similarity
 */
export function fuzzyMatch(
  input: string,
  validPaths: Set<string>,
  maxDistance = 2,
  maxResults = 3
): string[] {
  const suggestions: Array<{ path: string; distance: number }> = [];

  for (const path of validPaths) {
    const distance = levenshteinDistance(input, path);
    if (distance <= maxDistance) {
      suggestions.push({ path, distance });
    }
  }

  // Sort by distance (closest first) and limit results
  suggestions.sort((a, b) => a.distance - b.distance);
  return suggestions.slice(0, maxResults).map((s) => s.path);
}

/**
 * Normalize path for comparison (handle array indices)
 * @param path - Path to normalize
 * @returns Normalized path
 */
export function normalizePath(path: string): string {
  // Replace [0], [1], etc. with [0] for pattern matching
  return path.replace(/\[\d+\]/g, '[0]');
}

/**
 * Check if a path matches a schema pattern
 * @param path - Path to check
 * @param validPaths - Set of valid paths
 * @returns True if path is valid
 */
export function isValidPath(path: string, validPaths: Set<string>): boolean {
  // Direct match
  if (validPaths.has(path)) {
    return true;
  }

  // Normalize and check (for array indices)
  const normalized = normalizePath(path);
  if (validPaths.has(normalized)) {
    return true;
  }

  // Check if any valid path is a prefix of the input (for partial paths)
  for (const validPath of validPaths) {
    if (normalized === normalizePath(validPath)) {
      return true;
    }
  }

  return false;
}
