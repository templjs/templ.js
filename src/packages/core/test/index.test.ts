import { describe, it, expect } from 'vitest';
import { version as packageVersion } from '../package.json';
import core, {
  createLexer,
  createParser,
  createRenderer,
  createQueryEngine,
  renderTemplate,
  validateTemplate,
  version,
} from '../src/index';
import { QueryEngine } from '../src/query-engine/query-engine';

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
    const result = renderer.render({ type: 'template', statements: [] }, {});
    expect(result).toHaveProperty('output');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('success');
  });

  it('creates query engine instance', () => {
    const engine = createQueryEngine();
    expect(engine).toBeInstanceOf(QueryEngine);
  });

  it('renders a simple template', () => {
    const result = renderTemplate('Hello {{name}}!', { name: 'World' });
    expect(result).toBe('Hello World!');
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
    expect(core.renderTemplate).toBe(renderTemplate);
    expect(core.validateTemplate).toBe(validateTemplate);
  });
});
