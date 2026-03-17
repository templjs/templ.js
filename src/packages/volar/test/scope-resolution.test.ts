import { describe, expect, it } from 'vitest';
import {
  buildForScopesInText,
  findLocalAliasDefinitionInText,
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

  it('finds local alias definitions for property access', () => {
    const text = '{% for item in items %}\n{{ item.name }}\n{% endfor %}';
    const offset = text.indexOf('item.name') + 2;
    const aliasStart = text.indexOf('item in items');

    expect(findLocalAliasDefinitionInText(text, 'item.name', offset)).toEqual({
      start: aliasStart,
      end: aliasStart + 'item'.length,
    });
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

  it('reuses precomputed scopes when resolving and finding aliases', () => {
    const text = '{% for item in items %}\n{{ item.name }}\n{% endfor %}';
    const offset = text.indexOf('item.name') + 2;
    const scopes = buildForScopesInText(text);
    const aliasStart = text.indexOf('item in items');

    expect(resolveScopedPathInText(text, 'item.name', offset, undefined, scopes)).toBe(
      'items[0].name'
    );
    expect(findLocalAliasDefinitionInText(text, 'item.name', offset, undefined, scopes)).toEqual({
      start: aliasStart,
      end: aliasStart + 'item'.length,
    });
  });

  it('captures full iterable expressions for for-scopes', () => {
    const text = '{% for item in items | reverse %}\n{{ item.name }}\n{% endfor %}';
    const scopes = buildForScopesInText(text);

    expect(scopes).toHaveLength(1);
    expect(scopes[0].iterablePath).toBe('items | reverse');
  });
});
