import { describe, it, expect } from 'vitest';
import { version as packageVersion } from '../package.json';
import core, {
  createLexer,
  createParser,
  extractTemplateBindings,
  createRenderer,
  createQueryEngine,
  getBuiltinFilterSignatures,
  renderTemplate,
  validateTemplate,
  version,
} from '../src/index.js';
import { QueryEngine } from '../src/query-engine/query-engine.js';

describe('core entrypoint', () => {
  it('exports version', () => {
    expect(version).toBe(packageVersion);
    expect(core.version).toBe(packageVersion);
  });

  it('creates lexer with tokenize function', () => {
    const lexer = createLexer();
    expect(typeof lexer.tokenize).toBe('function');
    expect(lexer.tokenize('{{name}}')).toBeDefined();
  });

  it('creates parser with parse function', () => {
    const parser = createParser();
    expect(typeof parser.parse).toBe('function');
    const result = parser.parse([]);
    expect(result).toHaveProperty('ast');
    expect(result).toHaveProperty('errors');
  });

  it('creates renderer with render function', () => {
    const renderer = createRenderer();
    expect(typeof renderer.render).toBe('function');
    const result = renderer.render(
      {
        type: 'template',
        children: [],
        start: { line: 1, column: 0 },
        end: { line: 1, column: 0 },
      },
      {}
    );
    expect(result).toHaveProperty('output');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('success');
  });

  it('creates query engine instance', () => {
    const engine = createQueryEngine();
    expect(engine).toBeInstanceOf(QueryEngine);
  });

  it('exposes canonical built-in filter metadata from core', () => {
    const signatures = getBuiltinFilterSignatures();
    const engineMetadata = createQueryEngine().getMetadata();
    const upperSignature = engineMetadata.functions.get('upper')?.[0];
    const truncateSignature = engineMetadata.functions.get('truncate')?.[0];

    expect(signatures.upper).toBeDefined();
    expect(signatures.truncate).toBeDefined();
    expect(signatures.upper?.description).toBe(upperSignature?.description);
    expect(signatures.truncate?.description).toBe(truncateSignature?.description);
    expect(signatures.truncate?.parameters).toEqual(truncateSignature?.parameters);
  });

  it('reuses cached built-in filter metadata across calls', () => {
    const first = getBuiltinFilterSignatures();
    const second = getBuiltinFilterSignatures();

    expect(second).toBe(first);
  });

  it('renders a simple template', () => {
    const result = renderTemplate('Hello {{name}}!', { name: 'World' });
    expect(result).toBe('Hello World!');
  });

  it('throws parse failures instead of rendering recovered AST', () => {
    expect(() => renderTemplate('{% if condition %}hello', {})).toThrow(
      /Render failed: Failed to parse template:/
    );
  });

  it('does not duplicate render failure prefix', () => {
    try {
      renderTemplate('{{ value | unknownFilter }}', { value: 'test' }, { throwOnError: true });
      throw new Error('Expected renderTemplate to throw');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message.startsWith('Render failed:')).toBe(true);
      expect(message).not.toContain('Render failed: Render failed:');
    }
  });

  it('validates correct template syntax', () => {
    const result = validateTemplate('Hello {{name}}!');
    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it('detects invalid template syntax', () => {
    const result = validateTemplate('{{unclosed');
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.length).toBeGreaterThan(0);
  });

  it('default export maps public API functions', () => {
    expect(core.createLexer).toBe(createLexer);
    expect(core.createParser).toBe(createParser);
    expect(core.createRenderer).toBe(createRenderer);
    expect(core.createQueryEngine).toBe(createQueryEngine);
    expect(core.extractTemplateBindings).toBe(extractTemplateBindings);
    expect(core.renderTemplate).toBe(renderTemplate);
    expect(core.validateTemplate).toBe(validateTemplate);
  });
});
