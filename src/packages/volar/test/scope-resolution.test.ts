import { describe, expect, it } from 'vitest';
import {
  buildForScopesInText,
  getInferredLocalPropertyCompletions,
  resolveScopedPath,
  resolveScopedPathInText,
} from '../src/scope-resolution.js';

describe('scope-resolution', () => {
  it('returns the original path when the cursor is outside matching scopes', () => {
    const text = '{% for item in items %}\n{{ item.name }}\n{% endfor %}\n{{ item.name }}';
    const offset = text.lastIndexOf('item.name') + 2;

    expect(resolveScopedPathInText(text, 'item.name', offset)).toBe('item.name');
  });

  it('resolves bracket-notation alias access to iterable indices', () => {
    const text = '{% for item in items %}\n{{ item[0].title }}\n{% endfor %}';
    const offset = text.indexOf('item[0].title') + 3;
    const scopes = buildForScopesInText(text);

    expect(resolveScopedPath('item[0].title', offset, scopes)).toBe('items[0][0].title');
  });

  it('prefers the innermost scope when aliases are shadowed', () => {
    const text = [
      '{% for item in items %}',
      '  {% for item in item.children %}',
      '    {{ item.name }}',
      '  {% endfor %}',
      '{% endfor %}',
    ].join('\n');
    const offset = text.indexOf('item.name') + 2;

    expect(resolveScopedPathInText(text, 'item.name', offset)).toBe('items[0].children[0].name');
  });

  it('fully expands nested alias references through outer scopes', () => {
    const text = [
      '{% for item in items %}',
      '  {% for child in item.children %}',
      '    {{ child.name }}',
      '  {% endfor %}',
      '{% endfor %}',
    ].join('\n');
    const offset = text.indexOf('child.name') + 2;

    expect(resolveScopedPathInText(text, 'child.name', offset)).toBe('items[0].children[0].name');
  });

  it('captures full iterable expressions for for-scopes', () => {
    const text = '{% for item in items | reverse %}\n{{ item.name }}\n{% endfor %}';
    const scopes = buildForScopesInText(text);

    expect(scopes).toHaveLength(1);
    expect(scopes[0].iterablePath).toBe('items');
  });

  it('resolves alias paths from filtered iterable expressions', () => {
    const text = '{% for item in items | reverse %}\n{{ item.name }}\n{% endfor %}';
    const offset = text.indexOf('item.name') + 2;

    expect(resolveScopedPathInText(text, 'item.name', offset)).toBe('items[0].name');
  });

  it('resolves alias paths while typing in an unclosed expression', () => {
    const text = ['{% for item in items %}', '{{ item.n'].join('\n');
    const offset = text.lastIndexOf('item.n') + 'item.n'.length - 1;

    expect(resolveScopedPathInText(text, 'item.n', offset)).toBe('items[0].n');
  });

  it('ignores for-loops that appear inside comment blocks', () => {
    const text = [
      '{# {% for ignored in ignoredItems %} #}',
      '{% for item in items %}',
      '  {{ item.name }}',
      '{% endfor %}',
    ].join('\n');
    const scopes = buildForScopesInText(text);

    expect(scopes).toHaveLength(1);
    expect(scopes[0].alias).toBe('item');
    expect(scopes[0].iterablePath).toBe('items');
  });

  it('normalizes computed bracket index to [0] in scope iterable paths', () => {
    // Regression: {% for item in users[activeIndex + 1] %} must not truncate at space
    const text = '{% for item in users[activeIndex + 1] %}\n{{ item.name }}\n{% endfor %}';
    const scopes = buildForScopesInText(text);

    expect(scopes).toHaveLength(1);
    expect(scopes[0].iterablePath).toBe('users[0]');
  });

  it('preserves quoted string bracket segment in scope iterable paths', () => {
    // Regression: {% for item in users["full name"] %} must not truncate at space inside quotes
    const text = '{% for item in users["full name"] %}\n{{ item.name }}\n{% endfor %}';
    const scopes = buildForScopesInText(text);

    expect(scopes).toHaveLength(1);
    expect(scopes[0].iterablePath).toBe('users[full name]');
  });

  it('resolves iterable alias scopes with custom delimiters', () => {
    const text = '<< for item in items >>\n{{ item.name }}\n<< endfor >>';
    const delimiters = {
      statementStart: '<<',
      statementEnd: '>>',
      expressionStart: '{{',
      expressionEnd: '}}',
      commentStart: '<#',
      commentEnd: '#>',
    };
    const offset = text.indexOf('item.name') + 2;

    expect(resolveScopedPathInText(text, 'item.name', offset, delimiters)).toBe('items[0].name');
  });

  it('leaves path unchanged when scopes match offset but alias path does not match', () => {
    const scopes = [
      {
        alias: 'item',
        iterablePath: 'items',
        bodyStart: 0,
        bodyEnd: 100,
      },
    ];

    expect(resolveScopedPath('user.name', 5, scopes)).toBe('user.name');
  });

  it('preserves iterable paths that already end with an index segment', () => {
    const scopes = [
      {
        alias: 'item',
        iterablePath: 'items[2]',
        bodyStart: 0,
        bodyEnd: 100,
      },
    ];

    expect(resolveScopedPath('item.name', 10, scopes)).toBe('items[2].name');
  });

  it('falls back to raw iterable expression when no variable refs are found', () => {
    const scopes = [
      {
        alias: 'item',
        iterablePath: '42',
        bodyStart: 0,
        bodyEnd: 100,
      },
    ];

    expect(resolveScopedPath('item.name', 8, scopes)).toBe('42[0].name');
  });

  it('returns inferred local property completions from nested object literals', () => {
    const text = [
      '{% set profile = {',
      '  name: "Ada",',
      '  meta: { city: "London", country: "UK" },',
      '  tags: ["one", "two"],',
      '} %}',
      '{{ profile.meta. }}',
    ].join('\n');
    const offset = text.indexOf('profile.meta.') + 'profile.meta.'.length;

    expect(getInferredLocalPropertyCompletions(text, offset, 'profile.meta')).toEqual([
      'city',
      'country',
    ]);
    expect(getInferredLocalPropertyCompletions(text, offset, 'profile')).toEqual([
      'meta',
      'name',
      'tags',
    ]);
  });

  it('returns empty inferred completions when root binding source expression is not object-literal', () => {
    const text = '{% for item in items %}{{ item. }}{% endfor %}';
    const offset = text.indexOf('item.') + 'item.'.length;

    expect(getInferredLocalPropertyCompletions(text, offset, 'item')).toEqual([]);
  });

  it('returns inferred completions for single-alias for bindings with object-literal iterables', () => {
    const text =
      '{% for item in { name: "Ada", meta: { city: "London" } } %}{{ item. }}{% endfor %}';
    const offset = text.indexOf('item.') + 'item.'.length;

    expect(getInferredLocalPropertyCompletions(text, offset, 'item')).toEqual(['meta', 'name']);
  });

  it('excludes key aliases from inferred completions in key-value object-literal loops', () => {
    const text =
      '{% for key, value in { profile: { name: "Ada" } } %}{{ key. }}{{ value. }}{% endfor %}';
    const keyOffset = text.indexOf('key.') + 'key.'.length;
    const valueOffset = text.indexOf('value.') + 'value.'.length;

    expect(getInferredLocalPropertyCompletions(text, keyOffset, 'key')).toEqual([]);
    expect(getInferredLocalPropertyCompletions(text, valueOffset, 'value')).toEqual(['name']);
  });

  it('returns empty inferred completions when set expression is not an object literal', () => {
    const text = '{% set profile = user.profile %}{{ profile. }}';
    const offset = text.indexOf('profile.') + 'profile.'.length;

    expect(getInferredLocalPropertyCompletions(text, offset, 'profile')).toEqual([]);
  });

  it('ignores malformed object entries while preserving valid inferred members', () => {
    const text =
      '{% set profile = { "": "skip", meta: { city: "London", note: "A, B" }, valid: true } %}{{ profile. }}';
    const offset = text.indexOf('profile.') + 'profile.'.length;

    expect(getInferredLocalPropertyCompletions(text, offset, 'profile')).toEqual(['meta', 'valid']);
  });

  it('returns empty inferred completions when traversing through missing nested segments', () => {
    const text = '{% set profile = { meta: { city: "London" } } %}{{ profile.meta.country. }}';
    const offset = text.indexOf('profile.meta.country.') + 'profile.meta.country.'.length;

    expect(getInferredLocalPropertyCompletions(text, offset, 'profile.meta.country')).toEqual([]);
  });

  it('handles escaped quotes and commas in object values while inferring keys', () => {
    const text =
      '{% set profile = { meta: { city: "Lon\\"don, UK", note: "A, B" }, tags: ["x", "y"] } %}{{ profile.meta. }}';
    const offset = text.indexOf('profile.meta.') + 'profile.meta.'.length;

    expect(getInferredLocalPropertyCompletions(text, offset, 'profile.meta')).toEqual([
      'city',
      'note',
    ]);
  });

  it('returns empty inferred completions when final traversal target is not an object', () => {
    const text = '{% set profile = { name: "Ada" } %}{{ profile.name. }}';
    const offset = text.indexOf('profile.name.') + 'profile.name.'.length;

    expect(getInferredLocalPropertyCompletions(text, offset, 'profile.name')).toEqual([]);
  });
});
