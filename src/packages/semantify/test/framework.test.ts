import { describe, expect, it } from 'vitest';
import { createSemantifyServices } from '../src/index.js';

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
});
