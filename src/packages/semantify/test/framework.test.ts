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

  it('plans definition targets for local bindings with custom delimiters', () => {
    const text = '<% set row = rows %><< ro >>';
    const offset = text.lastIndexOf('ro') + 'ro'.length;

    const candidates = services.planCandidates(
      {
        type: 'definitionTarget',
        metadata: {
          variablePath: 'ro',
        },
      },
      {
        text,
        offset,
        delimiters: {
          statementStart: '<%',
          statementEnd: '%>',
          expressionStart: '<<',
          expressionEnd: '>>',
        },
      }
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.label).toBe('row');
    expect(candidates[0]?.metadata).toMatchObject({
      alias: 'ro',
      isAliasTokenOnly: true,
    });
  });

  it('returns no definition target when alias prefix is ambiguous', () => {
    const text = '{% set item = users %}{% set issue = tickets %}{{ i }}';
    const offset = text.lastIndexOf('i') + 'i'.length;

    const candidates = services.planCandidates(
      {
        type: 'definitionTarget',
        metadata: {
          variablePath: 'i',
        },
      },
      { text, offset }
    );

    expect(candidates).toEqual([]);
  });

  it('plans hover payload for loop aliases', () => {
    const text = '{% for item in users %}{{ item }}{% endfor %}';
    const offset = text.lastIndexOf('item') + 'item'.length;

    const candidates = services.planCandidates(
      {
        type: 'hoverPayload',
        metadata: {
          variablePath: 'item',
        },
      },
      { text, offset }
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.label).toBe('item');
    expect(candidates[0]?.detail).toBe('local loop alias');
    expect(candidates[0]?.metadata).toMatchObject({
      alias: 'item',
      isAliasTokenOnly: true,
    });
  });

  it('derives hover payload directly from offset for schema paths before filters', () => {
    const text = '{% if items | length > 0 %}ok{% endif %}';
    const offset = text.indexOf('items') + 1;

    const candidates = services.planCandidates(
      {
        type: 'hoverPayload',
      },
      { text, offset }
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.metadata).toMatchObject({
      symbolKind: 'schemaPath',
      rawPath: 'items',
    });
  });

  it('derives hover payload directly from offset for member-access segments', () => {
    const text = '{% for item in users %}{{ item.name }}{% endfor %}';
    const itemOffset = text.indexOf('item.name') + 1;
    const nameOffset = text.indexOf('name') + 1;

    const itemCandidates = services.planCandidates(
      {
        type: 'hoverPayload',
      },
      { text, offset: itemOffset }
    );
    const nameCandidates = services.planCandidates(
      {
        type: 'hoverPayload',
      },
      { text, offset: nameOffset }
    );

    expect(itemCandidates[0]?.metadata).toMatchObject({
      symbolKind: 'schemaPath',
      rawPath: 'item.name',
    });
    expect(nameCandidates[0]?.metadata).toMatchObject({
      symbolKind: 'schemaPath',
      rawPath: 'item.name',
    });
  });

  it('derives hover payload directly from offset for filters', () => {
    const text = '{{ user.name | upper }}';
    const offset = text.indexOf('upper') + 1;

    const candidates = services.planCandidates(
      {
        type: 'hoverPayload',
      },
      { text, offset }
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      label: 'upper',
      kind: 'filter',
    });
    expect(candidates[0]?.metadata).toMatchObject({
      symbolKind: 'filterName',
      rawPath: 'upper',
    });
  });

  it('falls back to basePath metadata when variablePath is absent', () => {
    const text = '{% set title = page.title %}{{ title }}';
    const offset = text.lastIndexOf('title') + 'title'.length;

    const candidates = services.planCandidates(
      {
        type: 'hoverPayload',
        basePath: 'title',
      },
      { text, offset }
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.label).toBe('title');
    expect(candidates[0]?.detail).toBe('local template variable');
  });

  it('falls back to symbol.rawPath metadata when variablePath/basePath are absent', () => {
    const text = '{% set title = page.title %}{{ title }}';
    const offset = text.lastIndexOf('title') + 'title'.length;

    const candidates = services.planCandidates(
      {
        type: 'definitionTarget',
        symbol: {
          rawPath: 'title',
          resolvedPath: 'page.title',
          kind: 'localBinding',
          range: {
            startOffset: 0,
            endOffset: 5,
          },
        },
      },
      { text, offset }
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.label).toBe('title');
  });

  it('returns no local-binding target for non-token variable paths without exact alias match', () => {
    const text = '{% set issue = ticket %}{{ iss.name }}';
    const offset = text.lastIndexOf('iss.name') + 'iss.name'.length;

    const candidates = services.planCandidates(
      {
        type: 'definitionTarget',
        metadata: {
          variablePath: 'iss.name',
        },
      },
      { text, offset }
    );

    expect(candidates).toEqual([]);
  });

  it('handles empty custom expression delimiter tokens without throwing', () => {
    const text = 'plain text only';
    const offset = text.length;

    const context = services.resolveContext({
      text,
      offset,
      delimiters: {
        expressionStart: '',
        expressionEnd: '>>',
      },
    });

    expect(context.bindings).toEqual([]);
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

  it('returns no hover payload when there is no enclosing expression or statement at offset zero', () => {
    const text = 'plain text only';

    const candidates = services.planCandidates(
      {
        type: 'hoverPayload',
      },
      { text, offset: 0 }
    );

    expect(candidates).toEqual([]);
  });

  it('returns no hover payload when cursor is inside an empty template statement', () => {
    const text = '{%    %}';
    const offset = text.indexOf('%') + 2;

    const candidates = services.planCandidates(
      {
        type: 'hoverPayload',
      },
      { text, offset }
    );

    expect(candidates).toEqual([]);
  });

  it('returns no hover payload for statement keywords without an expression symbol', () => {
    const text = '{% endif %}';
    const offset = text.indexOf('endif') + 1;

    const candidates = services.planCandidates(
      {
        type: 'hoverPayload',
      },
      { text, offset }
    );

    expect(candidates).toEqual([]);
  });

  it('returns no hover payload on the trailing alias boundary in for-headers', () => {
    const text = '{% for item in items %}';
    const offset = 11;

    const candidates = services.planCandidates(
      {
        type: 'hoverPayload',
      },
      { text, offset }
    );

    expect(candidates).toEqual([]);
    expect(services.resolveReferences({ text, offset })).toEqual([]);
  });

  it('returns no hover payload or references for control keywords in statement headers', () => {
    const forText = '{% for item in items %}{{ item }}{% endfor %}';
    const forOffset = forText.indexOf('for') + 1;
    const inOffset = forText.indexOf(' in ') + 2;
    const ifText = '{% if items %}ok{% endif %}';
    const ifOffset = ifText.indexOf('if') + 1;

    expect(
      services.planCandidates(
        {
          type: 'hoverPayload',
        },
        { text: forText, offset: forOffset }
      )
    ).toEqual([]);
    expect(services.resolveReferences({ text: forText, offset: forOffset })).toEqual([]);

    expect(
      services.planCandidates(
        {
          type: 'hoverPayload',
        },
        { text: forText, offset: inOffset }
      )
    ).toEqual([]);
    expect(services.resolveReferences({ text: forText, offset: inOffset })).toEqual([]);

    expect(
      services.planCandidates(
        {
          type: 'hoverPayload',
        },
        { text: ifText, offset: ifOffset }
      )
    ).toEqual([]);
    expect(services.resolveReferences({ text: ifText, offset: ifOffset })).toEqual([]);
  });

  it('returns no hover payload for statement expressions that contain no symbol references', () => {
    const text = '{% if 1 %}ok{% endif %}';
    const offset = text.indexOf('1');

    const candidates = services.planCandidates(
      {
        type: 'hoverPayload',
      },
      { text, offset }
    );

    expect(candidates).toEqual([]);
  });

  it('supports filter hover when cursor is immediately after a single filter token', () => {
    const text = '{{ value | upper }}';
    const offset = text.indexOf('upper') + 'upper'.length;

    const candidates = services.planCandidates(
      {
        type: 'hoverPayload',
      },
      { text, offset }
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.kind).toBe('filter');
    expect(candidates[0]?.label).toBe('upper');
  });

  it('derives local-binding hover directly from for-alias position inside statement header', () => {
    const text = '{% for item in users %}ok{% endfor %}';
    const offset = text.indexOf('item') + 1;

    const candidates = services.planCandidates(
      {
        type: 'hoverPayload',
      },
      { text, offset }
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.label).toBe('item');
    expect(candidates[0]?.metadata).toMatchObject({
      symbolKind: 'localBinding',
      alias: 'item',
      isAliasTokenOnly: true,
    });
  });

  it('prefers root alias hover detail for iterable expression symbols in for-headers', () => {
    const text = '{% set users = data.users %}{% for item in users.list %}{{ item }}{% endfor %}';
    const offset = text.indexOf('users.list') + 1;

    const candidates = services.planCandidates(
      {
        type: 'hoverPayload',
      },
      { text, offset }
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.label).toBe('users');
    expect(candidates[0]?.detail).toBe('local template variable');
    expect(candidates[0]?.metadata).toMatchObject({
      symbolKind: 'localBinding',
      rawPath: 'users',
    });
  });

  it('resolves dotted-path hover when cursor lands on the dot separator', () => {
    const text = '{% for item in users %}{{ item.name }}{% endfor %}';
    const offset = text.indexOf('item.name') + 'item'.length;

    const candidates = services.planCandidates(
      {
        type: 'hoverPayload',
      },
      { text, offset }
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.metadata).toMatchObject({
      symbolKind: 'schemaPath',
      rawPath: 'item.name',
    });
  });

  it('handles bracketed member paths as schema-path hover candidates', () => {
    const text = '{% for item in users %}{{ item[0].name }}{% endfor %}';
    const offset = text.indexOf('item[0].name') + 'item[0]'.length + 1;

    const candidates = services.planCandidates(
      {
        type: 'hoverPayload',
      },
      { text, offset }
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.metadata).toMatchObject({
      symbolKind: 'schemaPath',
      rawPath: 'item[0].name',
    });
  });

  it('returns no definition target when variablePath resolves to an empty alias', () => {
    const text = '{% set value = page.value %}{{ value }}';
    const offset = text.indexOf('value') + 1;

    const candidates = services.planCandidates(
      {
        type: 'definitionTarget',
        metadata: {
          variablePath: '',
        },
      },
      { text, offset }
    );

    expect(candidates).toEqual([]);
  });
});
