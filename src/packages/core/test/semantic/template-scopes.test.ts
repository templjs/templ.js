import { describe, expect, it } from 'vitest';
import { extractTemplateScopeBindings } from '../../src/index.js';
import { pathSegmentToString } from '../../src/semantic/template-scopes.js';

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

  it('uses declaration offsets when a for-loop body is empty', () => {
    const template = '{% for item in items %}{% endfor %}';

    const bindings = extractTemplateScopeBindings(template);

    expect(bindings).toHaveLength(1);
    expect(bindings[0].declarationStartOffset).toBeDefined();
    expect(bindings[0].declarationEndOffset).toBeDefined();
    expect(bindings[0].scopeStartOffset).toBe(bindings[0].declarationEndOffset);
  });

  it('collects bindings nested under conditional branches', () => {
    const template = [
      '{% if shouldRender %}',
      '  {% for item in items %}',
      '    {{ item.name }}',
      '  {% endfor %}',
      '{% else %}',
      '  {% for project in projects %}',
      '    {{ project.title }}',
      '  {% endfor %}',
      '{% endif %}',
    ].join('\n');

    const bindings = extractTemplateScopeBindings(template);

    expect(bindings).toHaveLength(2);
    expect(bindings.map((binding) => binding.alias)).toEqual(['item', 'project']);
  });

  it('normalizes property, literal, string, and computed path segments', () => {
    expect(pathSegmentToString({ type: 'property', value: 'title' })).toBe('.title');
    expect(pathSegmentToString({ type: 'index', value: 'slug' })).toBe('[slug]');
    expect(
      pathSegmentToString({ type: 'index', value: { type: 'literal', value: 2 } as never })
    ).toBe('[2]');
    expect(
      pathSegmentToString({
        type: 'index',
        value: { type: 'variable', name: 'idx', path: [] } as never,
      })
    ).toBe('[0]');
  });

  it('extracts iterable paths through paren and filter expressions', () => {
    const template = '{% for item in (items | default([])) %}{{ item.name }}{% endfor %}';

    const bindings = extractTemplateScopeBindings(template);

    expect(bindings).toHaveLength(1);
    expect(bindings[0]).toMatchObject({ alias: 'item', iterablePath: 'items' });
  });
});
