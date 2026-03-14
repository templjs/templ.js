import { describe, expect, it } from 'vitest';
import { extractTemplateScopeBindings } from '../../src/index.js';

describe('extractTemplateScopeBindings', () => {
  it('returns an empty array for an empty template', () => {
    expect(extractTemplateScopeBindings('')).toEqual([]);
  });

  it('returns an empty array when no for-loops are present', () => {
    expect(extractTemplateScopeBindings('{{ name }}')).toEqual([]);
  });

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

  it('extracts bindings from multiple independent non-nested for-loops', () => {
    const template = [
      '{% for user in users %}',
      '  {{ user.name }}',
      '{% endfor %}',
      '{% for project in projects %}',
      '  {{ project.title }}',
      '{% endfor %}',
    ].join('\n');

    const bindings = extractTemplateScopeBindings(template);

    expect(bindings).toHaveLength(2);
    expect(bindings[0]).toMatchObject({ alias: 'user', iterablePath: 'users' });
    expect(bindings[1]).toMatchObject({ alias: 'project', iterablePath: 'projects' });
  });
});
