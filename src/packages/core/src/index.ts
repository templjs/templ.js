/**
 * @templjs/core - Core template parser, renderer, and query engine
 *
 * This is the main library for the templjs meta-templating system.
 * It provides functionality for parsing templates, rendering output,
 * and querying structured data.
 */

export const version = '0.1.0';

// Export types
export type * from './lexer/types';
export type * from './parser/types';
export type * from './schema/types';
export type * from './query-engine/types';
// Explicitly re-export FilterFunction to resolve ambiguity
export type { FilterFunction } from './query-engine/types';
export type * from './renderer/types';

// Export lexer functions
export { tokenize } from './lexer/lexer';

// Export parser functions
export { parse } from './parser/parser';

// Export schema validation
export { SchemaValidator } from './schema/SchemaValidator';
export { extractPaths, isValidPath } from './schema/queryPathValidator';
export { inferSchemaFromValue, mergeSchemas } from './schema/schemaInference';
export type { ValidationResult, ValidationError, SchemaMetadata, JSONSchema } from './schema/types';

// Export query engine
export { QueryEngine, filter, query } from './query-engine/query-engine';

// Export renderer
export { Renderer, render } from './renderer/renderer';
import { QueryEngine } from './query-engine/query-engine';

/**
 * Placeholder lexer function - to be implemented
 */
export function createLexer() {
  return {
    tokenize: (_input: string) => {
      // TODO: Implement lexer
      return [];
    },
  };
}

/**
 * Placeholder parser function - to be implemented
 */
export function createParser() {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parse: (_tokens: any[]) => {
      // TODO: Implement parser
      return null;
    },
  };
}

/**
 * Placeholder renderer function - to be implemented
 */
export function createRenderer() {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render: (_ast: any, _data: any) => {
      // TODO: Implement renderer
      return '';
    },
  };
}

/**
 * Create a fully configured query engine instance.
 */
export function createQueryEngine() {
  return new QueryEngine();
}

/**
 * Stub function for renderTemplate - to be implemented in Phase 2
 * @param _template - Template string to render
 * @param _data - Data for rendering
 * @returns Rendered template
 */
export function renderTemplate(_template: string, _data: Record<string, unknown>): string {
  throw new Error('renderTemplate not yet implemented - implement in Phase 2 (WI-007)');
}

/**
 * Stub function for validateTemplate - to be implemented in Phase 2
 * @param _template - Template string to validate
 * @returns Validation result
 */
export function validateTemplate(_template: string): { valid: boolean; errors?: string[] } {
  throw new Error('validateTemplate not yet implemented - implement in Phase 2 (WI-006, WI-025)');
}

export default {
  version,
  createLexer,
  createParser,
  createRenderer,
  createQueryEngine,
  renderTemplate,
  validateTemplate,
};
