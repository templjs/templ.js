import { describe, expect, it } from 'vitest';
import { extractTemplateScopeBindings } from '../../src/index.js';

describe('extractTemplateScopeBindings', () => {
  it('extracts for-loop aliases with iterable paths', () => {
    const template = '{% for relationship in relationships %}{{ relationship.target }}{% endfor %}';

    const bindings = extractTemplateScopeBindings(template);

    expect(bindings).toHaveLength(1);
    expect(bindings[0]).toMatchObject({
      alias: 'relationship',
      iterablePath: 'relationships',
    });
    expect(bindings[0].scopeEndOffset).toBeGreaterThan(bindings[0].scopeStartOffset);
  });

  it('preserves nested scope ordering for shadowed aliases', () => {
    const template = [
      '{% for item in items %}',
      '  {% for item in item.children %}',
      '    {{ item.name }}',
      '  {% endfor %}',
      '{% endfor %}',
    ].join('\n');

    const bindings = extractTemplateScopeBindings(template);

    expect(bindings).toHaveLength(2);
    expect(bindings[0].iterablePath).toBe('items');
    expect(bindings[1].iterablePath).toBe('item.children');
    expect(bindings[1].scopeStartOffset).toBeGreaterThan(bindings[0].scopeStartOffset);
  });

  it('returns an empty array for invalid templates', () => {
    expect(extractTemplateScopeBindings('{% for item in %}')).toEqual([]);
  });
});
