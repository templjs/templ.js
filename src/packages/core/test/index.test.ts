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

  it('creates lexer placeholder with tokenize function', () => {
    const lexer = createLexer();
    expect(typeof lexer.tokenize).toBe('function');
    expect(lexer.tokenize('any input')).toEqual([]);
  });

  it('creates parser placeholder with parse function', () => {
    const parser = createParser();
    expect(typeof parser.parse).toBe('function');
    expect(parser.parse([])).toBeNull();
  });

  it('creates renderer placeholder with render function', () => {
    const renderer = createRenderer();
    expect(typeof renderer.render).toBe('function');
    expect(renderer.render({}, {})).toBe('');
  });

  it('creates query engine instance', () => {
    const engine = createQueryEngine();
    expect(engine).toBeInstanceOf(QueryEngine);
  });

  it('throws for renderTemplate until implemented', () => {
    expect(() => renderTemplate('hello', {})).toThrow(
      'renderTemplate not yet implemented - implement in Phase 2 (WI-007)'
    );
  });

  it('throws for validateTemplate until implemented', () => {
    expect(() => validateTemplate('hello')).toThrow(
      'validateTemplate not yet implemented - implement in Phase 2 (WI-006, WI-025)'
    );
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
