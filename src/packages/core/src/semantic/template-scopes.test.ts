import { describe, expect, it } from 'vitest';
import { analyzeForStatementHeader } from '../index.js';
import { analyzeSetStatementHeader } from '../index.js';
import { extractTemplateBindings } from '../index.js';
import { getTemplateBindingsAtOffset } from '../index.js';
import { isCursorOnStatementKeyword } from '../index.js';
import { pathSegmentToString } from './template-scopes.js';

describe('extractTemplateBindings', () => {
  it('returns an empty array for an empty template', () => {
    expect(extractTemplateBindings('')).toEqual([]);
  });

  it('returns an empty array when no for-loops are present', () => {
    expect(extractTemplateBindings('{{ name }}')).toEqual([]);
  });

  it('extracts for-loop aliases with iterable paths', () => {
    const template = '{% for relationship in relationships %}{{ relationship.target }}{% endfor %}';

    const bindings = extractTemplateBindings(template);

    expect(bindings).toHaveLength(1);
    expect(bindings[0]).toMatchObject({
      name: 'relationship',
      sourcePath: 'relationships',
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

    const bindings = extractTemplateBindings(template);

    expect(bindings).toHaveLength(2);
    expect(bindings[0].sourcePath).toBe('items');
    expect(bindings[1].sourcePath).toBe('item.children');
    expect(bindings[1].scopeStartOffset).toBeGreaterThan(bindings[0].scopeStartOffset);
  });

  it('returns an empty array for invalid templates', () => {
    expect(extractTemplateBindings('{% for item in %}')).toEqual([]);
  });

  it('recovers scope bindings for unclosed for-loops', () => {
    const template = ['{% for x in collection %}', '{{ x }}'].join('\n');

    const bindings = extractTemplateBindings(template);

    expect(bindings).toHaveLength(1);
    expect(bindings[0]).toMatchObject({ name: 'x', sourcePath: 'collection' });
    expect(bindings[0].scopeEndOffset).toBeGreaterThanOrEqual(bindings[0].scopeStartOffset);
  });

  it('recovers for-alias bindings with trim markers when template contains parse errors', () => {
    const template = [
      '---',
      'invalid: bar: [{% if %}foo {% endif %}]',
      '---',
      '{% set collection = ["a", "b"] %}',
      '{% for x in collection -%}',
      '{{ x }}',
    ].join('\n');

    const bindings = extractTemplateBindings(template);

    expect(bindings.some((binding) => binding.kind === 'for-alias' && binding.name === 'x')).toBe(
      true
    );
    expect(
      bindings.some((binding) => binding.kind === 'set-variable' && binding.name === 'collection')
    ).toBe(true);
  });

  it('recovers for-alias bindings with leading trim markers in malformed templates', () => {
    const template = [
      '---',
      'invalid: bar: [{% if %}foo {% endif %}]',
      '---',
      '{%- for item in items %}',
      '{{ item.name }}',
    ].join('\n');

    const bindings = extractTemplateBindings(template);
    const aliasBinding = bindings.find(
      (binding) => binding.kind === 'for-alias' && binding.name === 'item'
    );

    expect(aliasBinding).toBeDefined();
    expect(aliasBinding?.sourcePath).toBe('items');
    expect(aliasBinding?.scopeEndOffset).toBe(template.length);
  });

  it('recovers scope bindings when unrelated statement syntax is malformed', () => {
    const template = [
      'id: "{% set id = "yaml-block" %}{{ id }}"',
      '{% for c in id %}',
      '{{ c }}',
      '{% endfor %}',
    ].join('\n');

    const bindings = extractTemplateBindings(template);

    expect(bindings.some((binding) => binding.name === 'c' && binding.sourcePath === 'id')).toBe(
      true
    );
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

    const bindings = extractTemplateBindings(template);

    expect(bindings).toHaveLength(2);
    expect(bindings[0]).toMatchObject({ name: 'user', sourcePath: 'users' });
    expect(bindings[1]).toMatchObject({ name: 'project', sourcePath: 'projects' });
  });

  it('starts empty for-loop scope at the opening-tag boundary', () => {
    const template = '{% for item in items %}{% endfor %}';

    const bindings = extractTemplateBindings(template);

    expect(bindings).toHaveLength(1);
    expect(bindings[0].declarationStartOffset).toBeDefined();
    expect(bindings[0].declarationEndOffset).toBeDefined();
    expect(bindings[0].scopeStartOffset).toBe(template.indexOf('%}') + 2);
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

    const bindings = extractTemplateBindings(template);

    expect(bindings).toHaveLength(2);
    expect(bindings.map((binding) => binding.name)).toEqual(['item', 'project']);
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

    const bindings = extractTemplateBindings(template);

    expect(bindings).toHaveLength(1);
    expect(bindings[0]).toMatchObject({ name: 'item', sourcePath: 'items' });
  });

  it('normalizes computed bracket index expressions to [0] in iterable paths', () => {
    // Regression: users[activeIndex + 1] must not be truncated at the space
    const template = '{% for item in users[activeIndex + 1] %}{{ item.name }}{% endfor %}';

    const bindings = extractTemplateBindings(template);

    expect(bindings).toHaveLength(1);
    expect(bindings[0]).toMatchObject({ name: 'item', sourcePath: 'users[0]' });
  });

  it('preserves quoted string bracket segments in iterable paths', () => {
    // Regression: users["full name"] must not be truncated at the space inside quotes
    const template = '{% for item in users["full name"] %}{{ item.name }}{% endfor %}';

    const bindings = extractTemplateBindings(template);

    expect(bindings).toHaveLength(1);
    expect(bindings[0].sourcePath).toBe('users[full name]');
  });

  it('extracts bindings when custom delimiters are configured', () => {
    const template = '<< for item in items >>\n  {{ item.name }}\n<< endfor >>';

    const bindings = extractTemplateBindings(template, {
      delimiters: {
        statement_start: '<<',
        statement_end: '>>',
        expression_start: '{{',
        expression_end: '}}',
        comment_start: '<#',
        comment_end: '#>',
      },
    });

    expect(bindings).toHaveLength(1);
    expect(bindings[0]).toMatchObject({ name: 'item', sourcePath: 'items' });
  });

  it('computes correct name declaration offsets with custom delimiters', () => {
    const template = '<< for item in items >>';

    const bindings = extractTemplateBindings(template, {
      delimiters: {
        statement_start: '<<',
        statement_end: '>>',
        expression_start: '{{',
        expression_end: '}}',
        comment_start: '<#',
        comment_end: '#>',
      },
    });

    expect(bindings).toHaveLength(1);
    const [binding] = bindings;
    expect(binding.declarationStartOffset).toBeDefined();
    expect(binding.declarationEndOffset).toBeDefined();
    // The name "item" must be identifiable in the source
    expect(template.slice(binding.declarationStartOffset!, binding.declarationEndOffset!)).toBe(
      'item'
    );
  });

  it('remaps declaration offsets when statement delimiters change length', () => {
    const template = '[[[ for item in items ]]]';

    const bindings = extractTemplateBindings(template, {
      delimiters: {
        statement_start: '[[[',
        statement_end: ']]]',
      },
    });

    expect(bindings).toHaveLength(1);
    const [binding] = bindings;
    expect(binding.declarationStartOffset).toBeDefined();
    expect(binding.declarationEndOffset).toBeDefined();
    expect(template.slice(binding.declarationStartOffset!, binding.declarationEndOffset!)).toBe(
      'item'
    );
  });

  it('filters and sorts active bindings at an offset by innermost scope first', () => {
    const template = [
      '{% for item in items %}',
      '  {% for child in item.children %}',
      '    {{ child.name }}',
      '  {% endfor %}',
      '{% endfor %}',
    ].join('\n');

    const bindings = extractTemplateBindings(template);
    const active = getTemplateBindingsAtOffset(bindings, template.indexOf('child.name'));

    expect(active).toHaveLength(2);
    expect(active[0].name).toBe('child');
    expect(active[1].name).toBe('item');
  });

  it('treats scope end offsets as exclusive in active-binding lookups', () => {
    const template = '{% for item in items %}{{ item.name }}{% endfor %}';
    const bindings = extractTemplateBindings(template);
    const binding = bindings[0];

    expect(getTemplateBindingsAtOffset(bindings, binding.scopeEndOffset)).toEqual([]);
  });

  it('does not surface malformed for-loop aliases from fallback statement shapes', () => {
    const template = [
      '{% for 1item in users %}{% endfor %}',
      '{% for key, in users %}{% endfor %}',
      '{% for item users %}{% endfor %}',
      '{% for item in   %}{% endfor %}',
      '{% set = users %}',
      '{% set local users %}',
      '{% set local =   %}',
    ].join('\n');

    const bindings = extractTemplateBindings(template);
    expect(
      bindings.filter(
        (binding) => binding.kind === 'for-alias' || binding.kind === 'for-value-alias'
      )
    ).toEqual([]);
  });

  it('deduplicates recovered fallback bindings when parser recovery emits overlapping scopes', () => {
    const template = [
      '{% for item in items %}',
      '{% if %}',
      '{{ item.name }}',
      '{% endfor %}',
    ].join('\n');

    const bindings = extractTemplateBindings(template);
    const itemBindings = bindings.filter((binding) => binding.name === 'item');

    expect(itemBindings).toHaveLength(1);
    expect(itemBindings[0].sourcePath).toBe('items');
  });

  it('analyzes for statement headers with trim markers', () => {
    const parsed = analyzeForStatementHeader('- for item in item.name -');

    expect(parsed).toMatchObject({
      aliasName: 'item',
      iterableExpression: 'item.name',
    });
    expect(parsed?.aliasStart).toBeGreaterThanOrEqual(0);
    expect(parsed?.iterableStart).toBeGreaterThan(parsed?.aliasEnd ?? 0);
  });

  it('analyzes set statement headers with trim markers', () => {
    const parsed = analyzeSetStatementHeader('- set collection = ["a", "b"] -');

    expect(parsed).toMatchObject({
      variableName: 'collection',
    });
    expect(parsed?.variableStart).toBeGreaterThanOrEqual(0);
    expect(parsed?.variableEnd).toBeGreaterThan(parsed?.variableStart ?? 0);
  });

  it('detects cursor locations on statement keywords', () => {
    const statement = '- for item in items -';
    const keywords = new Set(['for', 'in']);

    const onFor = isCursorOnStatementKeyword(statement, statement.indexOf('for') + 1, keywords);
    const onIn = isCursorOnStatementKeyword(statement, statement.indexOf(' in ') + 2, keywords);
    const onAlias = isCursorOnStatementKeyword(statement, statement.indexOf('item') + 1, keywords);

    expect(onFor).toBe(true);
    expect(onIn).toBe(true);
    expect(onAlias).toBe(false);
  });
});
