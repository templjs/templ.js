import { describe, expect, it } from 'vitest';
import { createSemantifyServices, semantifyTesting } from '../src/index.js';

describe('createSemantifyServices', () => {
  const services = createSemantifyServices();

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

  it('returns sorted symbol candidates with set-variable detail when no prefix is provided', () => {
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
    expect(symbolCandidates.find((item) => item.label === 'title')?.detail).toBe(
      'local template variable'
    );
  });

  it('labels for-alias candidates as local loop aliases', () => {
    const text = '{% for item in users %}{{ item.name }}{% endfor %}';
    const offset = text.indexOf('item.name') + 'item'.length;

    const symbolCandidates = services.planCandidates(
      {
        type: 'symbolCandidates',
      },
      { text, offset }
    );

    expect(symbolCandidates.find((item) => item.label === 'item')?.detail).toBe('local loop alias');
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
});
