/**
 * @templjs/core - Core template parser, renderer, and query engine
 *
 * This is the main library for the templjs meta-templating system.
 * It provides functionality for parsing templates, rendering output,
 * and querying structured data.
 */

export const version = '0.1.0';

// Export types
export type * from './lexer/types.js';
export type * from './parser/types.js';
export type * from './schema/types.js';
export type * from './query-engine/types.js';
export type * from './semantic/template-scopes.js';
export type * from './semantic/semantic-context.js';
// Explicitly re-export FilterFunction to resolve ambiguity
export type { FilterFunction } from './query-engine/types.js';
export type * from './renderer/types.js';

// Export runtime values from lexer/types
export { TokenType, DEFAULT_DELIMITERS } from './lexer/types.js';

// Export lexer functions
export { tokenize } from './lexer/lexer.js';

// Export parser functions
export { parse } from './parser/parser.js';

// Export schema validation
export { SchemaValidator } from './schema/SchemaValidator.js';
export { extractPaths, isValidPath } from './schema/queryPathValidator.js';
export { inferSchemaFromValue, mergeSchemas } from './schema/schemaInference.js';
export { extractTemplateScopeBindings } from './semantic/template-scopes.js';
export {
  detectFrontmatterRange,
  getSemanticProfileId,
  getFrontmatterKeyValueAtOffset,
  getFrontmatterSchemaAliases,
  getFrontmatterSchemaReferenceAtOffset,
  getTokenAtOffset,
  isOffsetInFrontmatter,
  resolveSemanticContextBlock,
  resolveSemanticHostLanguage,
  resolveSemanticZone,
  resolveSemanticZoneByHostLanguage,
  toSemanticZone,
} from './semantic/semantic-context.js';
export type {
  ValidationResult,
  ValidationError,
  SchemaMetadata,
  JSONSchema,
} from './schema/types.js';

// Export query engine
export { QueryEngine, filter, query } from './query-engine/query-engine.js';
export type { FunctionSignature } from './query-engine/types.js';

// Export renderer
export { Renderer, render } from './renderer/renderer.js';
export { BUILTIN_FILTER_NAMES, getBuiltinFilterNames } from './renderer/filter-engine.js';
import { QueryEngine } from './query-engine/query-engine.js';
import { tokenize } from './lexer/lexer.js';
import { parse } from './parser/parser.js';
import { render } from './renderer/renderer.js';
import { extractTemplateScopeBindings } from './semantic/template-scopes.js';
import type { RenderOptions } from './renderer/types.js';

/**
 * Create a lexer instance for tokenizing templates
 *
 * @returns Lexer interface with tokenize function
 */
export function createLexer() {
  return {
    tokenize,
  };
}

/**
 * Create a parser instance for generating AST from tokens
 *
 * @returns Parser interface with parse function
 */
export function createParser() {
  return {
    parse,
  };
}

/**
 * Create a renderer instance for rendering templates
 *
 * @returns Renderer interface with render function
 */
export function createRenderer() {
  return {
    render,
  };
}

/**
 * Create a fully configured query engine instance.
 */
export function createQueryEngine() {
  return new QueryEngine();
}

let cachedBuiltinFilterSignatures:
  | Record<string, import('./query-engine/types.js').FunctionSignature>
  | undefined;

/**
 * Get built-in filter signatures registered by the query engine.
 *
 * Note: if a function has multiple overload signatures in `metadata.functions`,
 * this API exposes only the first signature (`signatures[0]`) for that function
 * in `cachedBuiltinFilterSignatures`.
 *
 * Callers that need all overloads should query engine metadata directly via
 * `createQueryEngine().getMetadata().functions`.
 */
export function getBuiltinFilterSignatures(): Record<
  string,
  import('./query-engine/types.js').FunctionSignature
> {
  if (cachedBuiltinFilterSignatures) {
    return cachedBuiltinFilterSignatures;
  }

  const engine = createQueryEngine();
  const metadata = engine.getMetadata();
  const result: Record<string, import('./query-engine/types.js').FunctionSignature> = {};

  for (const [name, signatures] of metadata.functions.entries()) {
    if (signatures.length > 0) {
      result[name] = signatures[0];
    }
  }

  cachedBuiltinFilterSignatures = result;
  return cachedBuiltinFilterSignatures;
}

/**
 * Render a template string with the provided data
 * @param template - Template string to render
 * @param data - Data for rendering
 * @param options - Optional render options
 * @returns Rendered template output
 * @throws Error if tokenization, parsing, or rendering fails
 */
export function renderTemplate(
  template: string,
  data: Record<string, unknown>,
  options?: RenderOptions
): string {
  try {
    // Tokenize the template
    const tokens = tokenize(template);

    // Parse the tokens
    const parseResult = parse(tokens);

    if (parseResult.errors.length > 0) {
      const errorMessages = parseResult.errors.map((error) => `${error.type}: ${error.message}`);
      throw new Error(`Failed to parse template: ${errorMessages.join('; ')}`);
    }

    if (!parseResult.ast) {
      throw new Error('Failed to parse template: no AST generated');
    }

    // Render the AST
    const renderResult = render(parseResult.ast, data, options);

    if (!renderResult.success && options?.throwOnError) {
      const errorMessages = renderResult.errors.map((e) => e.message).join('; ');
      throw new Error(errorMessages);
    }

    return renderResult.output;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith('Render failed:')) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(message, { cause: error });
    }
    throw new Error(`Render failed: ${message}`, { cause: error });
  }
}

/**
 * Validate a template string for syntax errors
 * @param template - Template string to validate
 * @returns Validation result with valid flag and any errors
 */
export function validateTemplate(template: string): { valid: boolean; errors?: string[] } {
  try {
    // Tokenize the template
    const tokens = tokenize(template);

    // Parse the tokens
    const parseResult = parse(tokens);

    // Check for parse errors
    if (parseResult.errors && parseResult.errors.length > 0) {
      return {
        valid: false,
        errors: parseResult.errors.map((err) => `${err.type}: ${err.message}`),
      };
    }

    // Check if AST was generated
    if (!parseResult.ast) {
      return {
        valid: false,
        errors: ['Failed to generate AST from template'],
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

export default {
  version,
  createLexer,
  createParser,
  createRenderer,
  createQueryEngine,
  extractTemplateScopeBindings,
  renderTemplate,
  validateTemplate,
};
