import { describe, expect, it } from 'vitest';
import { createSemantifyServices, semantifyTesting } from '../src/index.js';

describe('createSemantifyServices', () => {
  const services = createSemantifyServices({
    typeLookup: ({ expression }) => {
      if (expression === 'users') {
        return 'array<object>';
      }

      if (expression === 'page.title') {
        return 'string';
      }

      return undefined;
    },
  });

  it('resolves active in-scope template bindings', () => {
    const text = '{% for item in users %}{{ item.name }}{% endfor %}';
    const offset = text.indexOf('item.name') + 'item'.length;

    const context = services.resolveContext({ text, offset });

    expect(context.bindings.some((binding) => binding.name === 'item')).toBe(true);
  });

  it('supports custom delimiters when resolving bindings', () => {
    const text = '<% for row in rows %><< row.name >><% endfor %>';
    const offset = text.indexOf('row.name') + 'row'.length;

    const context = services.resolveContext({
      text,
      offset,
      delimiters: {
        statementStart: '<%',
        statementEnd: '%>',
        expressionStart: '<<',
        expressionEnd: '>>',
      },
    });

    expect(context.bindings.some((binding) => binding.name === 'row')).toBe(true);
  });

  it('recovers bindings from dangling expression delimiters', () => {
    const text = '{% for item in users %}{{ item.name';
    const offset = text.indexOf('item.name') + 'item'.length;

    const context = services.resolveContext({ text, offset });

    expect(context.bindings.some((binding) => binding.name === 'item')).toBe(true);
  });

  it('maps frontmatter offsets to metadata regions', () => {
    const text = ['---', 'title: hello', '---', '{{ title }}'].join('\n');
    const offset = text.indexOf('title:') + 1;

    const context = services.resolveContext({ text, offset });

    expect(context.activeRegion?.kind).toBe('metadata');
    expect(context.activeRegion?.metadata?.legacyContextBlock).toBe('frontmatter');
  });

  it('omits active region when queried offset is outside document bounds', () => {
    const text = '{{ value }}';
    const context = services.resolveContext({ text, offset: text.length + 20 });

    expect(context.activeRegion).toBeUndefined();
  });

  it('returns local-binding references based on in-scope symbols', () => {
    const text = '{% set title = page.title %}{{ title }}';
    const offset = text.lastIndexOf('title') + 'title'.length;

    const refs = services.resolveReferences({ text, offset });

    expect(refs.some((ref) => ref.kind === 'localBinding' && ref.rawPath === 'title')).toBe(true);
  });

  it('returns references sorted by declaration/scope offset', () => {
    const text = [
      '{% set title = page.title %}',
      '{% for item in users %}',
      '{{ item.name }}{{ title }}',
      '{% endfor %}',
    ].join('\n');
    const offset = text.indexOf('item.name') + 'item'.length;

    const refs = services.resolveReferences({ text, offset });

    expect(refs.map((ref) => ref.rawPath)).toEqual(['title', 'item']);
  });

  it('plans symbol and filter candidates from canonical semantify APIs', () => {
    const text = '{% for item in users %}{{ it }}{% endfor %}';
    const offset = text.lastIndexOf('it') + 'it'.length;

    const symbolCandidates = services.planCandidates(
      {
        type: 'symbolCandidates',
        typedPrefix: 'it',
      },
      { text, offset }
    );

    expect(symbolCandidates.some((item) => item.label === 'item')).toBe(true);

    const filterCandidates = services.planCandidates(
      {
        type: 'filterCandidates',
        typedPrefix: 'up',
      },
      { text, offset }
    );

    expect(filterCandidates.some((item) => item.label === 'upper')).toBe(true);
  });

  it('returns sorted symbol candidates with inferred type labels when no prefix is provided', () => {
    const text = [
      '{% set title = page.title %}',
      '{% for item in users %}',
      '{{ item.name }}{{ title }}',
      '{% endfor %}',
    ].join('\n');
    const offset = text.indexOf('item.name') + 'item'.length;

    const symbolCandidates = services.planCandidates(
      {
        type: 'symbolCandidates',
      },
      { text, offset }
    );

    expect(symbolCandidates.map((item) => item.label)).toEqual(['title', 'item']);
    expect(symbolCandidates.find((item) => item.label === 'title')?.detail).toBe('string');
  });

  it('labels for-alias candidates with inferred element types', () => {
    const text = '{% for item in users %}{{ item.name }}{% endfor %}';
    const offset = text.indexOf('item.name') + 'item'.length;

    const symbolCandidates = services.planCandidates(
      {
        type: 'symbolCandidates',
      },
      { text, offset }
    );

    expect(symbolCandidates.find((item) => item.label === 'item')?.detail).toBe('object');
  });

  it('infers local array set bindings and nested loop aliases without an external lookup', () => {
    const localServices = createSemantifyServices();
    const text = [
      '{% set collection = ["apple", "banana", "cantelope"] %}',
      '{% for item in collection %}',
      '{{ item }}',
      '{% endfor %}',
    ].join('\n');
    const offset = text.indexOf('item }}') + 'item'.length;

    const context = localServices.resolveContext({ text, offset });
    expect(context.bindings.find((binding) => binding.name === 'collection')?.typeLabel).toBe(
      'array<string>'
    );
    expect(context.bindings.find((binding) => binding.name === 'item')?.typeLabel).toBe('string');
  });

  it('returns empty candidates for unsupported intent types', () => {
    const text = '{% for item in users %}{{ item.name }}{% endfor %}';
    const offset = text.indexOf('item.name') + 'item'.length;

    const candidates = services.planCandidates(
      {
        type: 'propertyCandidates',
      },
      { text, offset }
    );

    expect(candidates).toEqual([]);
  });

  it('exposes stable utility helpers for range and delimiter normalization', () => {
    expect(semantifyTesting.normalizeRange(10, 3)).toEqual({
      startOffset: 3,
      endOffset: 10,
    });

    const delimiters = semantifyTesting.toCoreDelimiters({
      statementStart: '<%',
      statementEnd: '%>',
    });

    expect(delimiters?.statement_start).toBe('<%');
    expect(delimiters?.statement_end).toBe('%>');
    expect(delimiters?.expression_start).toBe('{{');
    expect(delimiters?.comment_end).toBe('#}');
    expect(semantifyTesting.toCoreDelimiters(undefined)).toBeUndefined();

    const defaults = semantifyTesting.toCoreDelimiters({});
    expect(defaults?.statement_start).toBe('{%');
    expect(defaults?.statement_end).toBe('%}');
  });

  it('honors fully custom delimiters across all delimiter families', () => {
    const custom = semantifyTesting.toCoreDelimiters({
      statementStart: '{%',
      statementEnd: '%}',
      expressionStart: '<<',
      expressionEnd: '>>',
      commentStart: '<#',
      commentEnd: '#>',
    });

    expect(custom).toEqual({
      statement_start: '{%',
      statement_end: '%}',
      statement: ['{%', '%}'],
      expression_start: '<<',
      expression_end: '>>',
      expression: ['<<', '>>'],
      comment_start: '<#',
      comment_end: '#>',
      comment: ['<#', '#>'],
    });
  });

  it('falls back declarationRange to scopeRange when declaration offsets are absent', () => {
    const mapped = semantifyTesting.mapBinding({
      kind: 'for-alias',
      name: 'item',
      scopeStartOffset: 12,
      scopeEndOffset: 28,
      sourcePath: 'users[0]',
      sourceExpression: 'users',
    });

    expect(mapped.declarationRange).toEqual({
      startOffset: 12,
      endOffset: 28,
    });
  });
});
