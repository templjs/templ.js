import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
import { afterEach, describe, expect, it } from 'vitest';
import { decodeJsonPointerSegment, schemaSourceResolutionTesting } from '../src/index.js';

const t = schemaSourceResolutionTesting;

const schemaText = JSON.stringify(
  {
    type: 'object',
    properties: {
      user: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            enum: ['Ada'],
          },
          tags: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
              },
            },
          },
          address: {
            $ref: 'defs.json#/$defs/address',
          },
          raw: true,
          status: {
            oneOf: [
              {
                properties: {
                  code: { type: 'string' },
                },
              },
              {
                type: 'object',
                properties: {
                  state: { type: 'string' },
                },
              },
            ],
          },
        },
      },
      alias: {
        $ref: '#/$defs/redirected',
      },
    },
    $defs: {
      local: {
        type: 'object',
        properties: {
          value: { type: 'string' },
        },
      },
      redirected: {
        $ref: '#/properties/user/properties/name',
      },
    },
  },
  null,
  2
);

describe('schema source resolution helpers', () => {
  let tempDir: string | undefined;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  it('parses schema references, offsets, brackets, strings, and values defensively', () => {
    expect(t.splitSchemaSourceReference(' ./schema.json#/$defs/item ')).toEqual({
      source: './schema.json',
      fragment: '#/$defs/item',
    });
    expect(t.splitSchemaSourceReference('schema.json')).toEqual({ source: 'schema.json' });
    expect(t.splitSchemaSourceReference('schema.json#')).toEqual({
      source: 'schema.json',
      fragment: '#',
    });
    expect(t.getPositionForOffset('a\nbc\n', -10)).toEqual({ line: 0, character: 0 });
    expect(t.getPositionForOffset('a\nbc\n', 5)).toEqual({ line: 2, character: 0 });

    expect(t.skipWhitespace(' \n\tvalue', 0)).toBe(3);
    expect(t.findStringEnd('"a\\"b"', 0)).toBe(5);
    expect(t.findStringEnd('"unterminated', 0)).toBe(-1);
    expect(t.findMatchingBracket('{"a":"}","b":{"c":1}}', 0, '{', '}')).toBe(20);
    expect(t.findMatchingBracket('{"a": 1', 0, '{', '}')).toBe(-1);

    const values = '{"object":{"a":1},"array":[{"a":1}],"string":"x","number":42}';
    expect(t.findValueRange(values, values.indexOf('{"a"'), values.length)).toEqual({
      start: values.indexOf('{"a"'),
      end: values.indexOf('},"array') + 1,
    });
    expect(t.findValueRange(values, values.indexOf('[{"a"'), values.length)).toEqual({
      start: values.indexOf('[{"a"'),
      end: values.indexOf('],"string') + 1,
    });
    expect(t.findValueRange(values, values.indexOf('"x"'), values.length)).toEqual({
      start: values.indexOf('"x"'),
      end: values.indexOf('"x"') + 3,
    });
    expect(t.findValueRange(values, values.indexOf('42'), values.length)).toEqual({
      start: values.indexOf('42'),
      end: values.indexOf('42') + 2,
    });
    expect(t.findValueRange(values, values.length, values.length)).toBeNull();
    expect(t.findValueRange('{"a": {"unterminated": 1', 6, 24)).toBeNull();
  });

  it('finds top-level properties, array object ranges, and schema structure matches', () => {
    const rootStart = t.skipWhitespace(schemaText, 0);
    const rootEnd = t.findMatchingBracket(schemaText, rootStart, '{', '}') + 1;
    const properties = t.findTopLevelPropertyInObjectRange(
      schemaText,
      'properties',
      rootStart,
      rootEnd
    );

    expect(properties).not.toBeNull();
    expect(t.findTopLevelPropertyInObjectRange('[]', 'properties', 0, 2)).toBeNull();
    expect(t.findTopLevelPropertyInObjectRange('{"unterminated: 1}', 'x', 0, 19)).toBeNull();
    expect(t.findTopLevelPropertyInObjectRange(schemaText, 'name', rootStart, rootEnd)).toBeNull();

    const status = t.findPropertyViaSchemaStructure(schemaText, 'user.status');
    const oneOfEntry = t.findTopLevelPropertyInObjectRange(
      schemaText,
      'oneOf',
      status?.valueStart ?? -1,
      status?.valueEnd ?? -1
    );
    const oneOfRanges = t.collectTopLevelObjectRangesInArray(
      schemaText,
      oneOfEntry?.valueStart ?? -1,
      oneOfEntry?.valueEnd ?? -1
    );
    expect(oneOfRanges).toHaveLength(2);
    expect(t.collectTopLevelObjectRangesInArray(schemaText, -1, 0)).toEqual([]);
    expect(t.collectTopLevelObjectRangesInArray('[{"a":1}, invalid]', 0, 18)).toHaveLength(1);

    const direct = t.findPropertyViaSchemaStructure(schemaText, 'user.name');
    const viaItems = t.findPropertyViaSchemaStructure(schemaText, 'user.tags.label');
    const viaCombinator = t.findPropertyViaSchemaStructure(schemaText, 'user.status.state');
    const viaCombinatorDirect = t.findPropertyViaCombinators(
      schemaText,
      'code',
      status?.valueStart ?? -1,
      status?.valueEnd ?? -1
    );

    expect(schemaText.slice(direct?.keyOffset, (direct?.keyOffset ?? 0) + 6)).toBe('"name"');
    expect(schemaText.slice(viaItems?.keyOffset, (viaItems?.keyOffset ?? 0) + 7)).toBe('"label"');
    expect(schemaText.slice(viaCombinator?.keyOffset, (viaCombinator?.keyOffset ?? 0) + 7)).toBe(
      '"state"'
    );
    expect(
      schemaText.slice(viaCombinatorDirect?.keyOffset, (viaCombinatorDirect?.keyOffset ?? 0) + 6)
    ).toBe('"code"');
    expect(t.findPropertyViaSchemaStructure('[]', 'user.name')).toBeNull();
    expect(t.findPropertyViaSchemaStructure('{"properties": {', 'user.name')).toBeNull();
    expect(t.findPropertyViaSchemaStructure(schemaText, '')).toBeNull();
  });

  it('computes best property ranges, path segments, JSON pointer ranges, and ref URIs', () => {
    const propertyRange = t.findBestPropertyRange(schemaText, 'user.name');
    const valueRange = t.findBestPropertyRange(schemaText, 'user.name', 'value', 'string');
    const missingValueRange = t.findBestPropertyRange(schemaText, 'user.name', 'value', 'missing');

    expect(propertyRange).toEqual({
      startOffset: schemaText.indexOf('"name"'),
      endOffset: schemaText.indexOf('"name"') + '"name"'.length,
    });
    expect(valueRange).toEqual({
      startOffset: schemaText.indexOf('"string"'),
      endOffset: schemaText.indexOf('"string"') + '"string"'.length,
    });
    expect(missingValueRange?.startOffset).toBe(schemaText.indexOf('"name"'));
    expect(t.findBestPropertyOffset(schemaText, 'missing')).toBe(0);

    expect(t.splitPropertyPath('user.tags[0].label')).toEqual(['user', 'tags', 'label']);
    expect(t.stripJsonQuotes(' "value" ')).toBe('value');
    expect(t.stripJsonQuotes('plain')).toBe('plain');
    expect(decodeJsonPointerSegment('a~1b~0c')).toBe('a/b~c');

    const rootRange = t.findObjectRangeByPointer(schemaText, '#');
    const localRange = t.findObjectRangeByPointer(schemaText, '#/$defs/local');
    const escapedSchema = '{"properties":{"a/b~c":{"type":"string"}}}';
    const escapedRange = t.findObjectRangeByPointer(escapedSchema, '#/properties/a~1b~0c');

    expect(rootRange).toEqual({ start: 0, end: schemaText.length });
    expect(schemaText.slice(localRange?.start, (localRange?.start ?? 0) + 1)).toBe('{');
    expect(escapedSchema.slice(escapedRange?.start, escapedRange?.end)).toContain('"string"');
    expect(t.findObjectRangeByPointer('[]', '#')).toBeNull();
    expect(t.findObjectRangeByPointer('{"a": {', '#')).toBeNull();
    expect(
      t.findObjectRangeByPointer(schemaText, '#/properties/user/properties/name/type')
    ).toBeNull();
    expect(t.findObjectRangeByPointer(schemaText, 'not-a-pointer')).toEqual(rootRange);

    const rootUri = 'file:///tmp/root/schema.json';
    expect(t.resolveRefTargetUri('https://example.com/schema.json', '#')).toBeNull();
    expect(t.resolveRefTargetUri(rootUri, '')).toBe(rootUri);
    expect(t.resolveRefTargetUri(rootUri, '#/$defs/local')).toBe(rootUri);
    expect(t.resolveRefTargetUri(rootUri, 'https://example.com/remote.json')).toBe(
      'https://example.com/remote.json'
    );
    expect(t.resolveRefTargetUri(rootUri, '../defs.json')).toBe('file:///tmp/defs.json');
    expect(t.resolveRefTargetUri('file:///tmp/%E0%A4%A', './defs.json')).toBeNull();
  });

  it('matches direct, combinator, and array-item properties within object ranges', () => {
    const rootStart = 0;
    const rootEnd = schemaText.length;

    const direct = t.findPropertyMatchInObjectRange(schemaText, 'user', rootStart, rootEnd);
    const tags = t.findPropertyViaSchemaStructure(schemaText, 'user.tags');
    const status = t.findPropertyViaSchemaStructure(schemaText, 'user.status');
    const item = t.findPropertyMatchInObjectRange(
      schemaText,
      'label',
      tags?.valueStart ?? -1,
      tags?.valueEnd ?? -1
    );
    const combinator = t.findPropertyMatchInObjectRange(
      schemaText,
      'state',
      status?.valueStart ?? -1,
      status?.valueEnd ?? -1
    );

    expect(schemaText.slice(direct?.keyOffset, (direct?.keyOffset ?? 0) + 6)).toBe('"user"');
    expect(schemaText.slice(item?.keyOffset, (item?.keyOffset ?? 0) + 7)).toBe('"label"');
    expect(schemaText.slice(combinator?.keyOffset, (combinator?.keyOffset ?? 0) + 7)).toBe(
      '"state"'
    );
    expect(t.findPropertyMatchInObjectRange(schemaText, 'missing', rootStart, rootEnd)).toBeNull();
    expect(
      t.findPropertyMatchInObjectRange('{"items":{"type":"string"}}', 'missing', 0, 27)
    ).toBeNull();
  });

  it('resolves path definitions across local, external, terminal, and recursive refs', () => {
    const rootUri = 'file:///tmp/project/root.schema.json';
    const defsUri = 'file:///tmp/project/defs.json';
    const defsText = JSON.stringify(
      {
        $defs: {
          address: {
            type: 'object',
            properties: {
              city: { type: 'string' },
              country: { $ref: 'more.json#/$defs/country' },
            },
          },
        },
      },
      null,
      2
    );
    const moreUri = 'file:///tmp/project/more.json';
    const moreText = JSON.stringify(
      {
        $defs: {
          country: {
            type: 'object',
            properties: {
              code: { type: 'string' },
            },
          },
        },
      },
      null,
      2
    );
    const files = new Map<string, string>([
      ['/tmp/project/root.schema.json', schemaText],
      ['/tmp/project/defs.json', defsText],
      ['/tmp/project/more.json', moreText],
    ]);
    const readFn = (filePath: string): string => {
      const text = files.get(filePath);
      if (!text) {
        throw new Error(`missing ${filePath}`);
      }
      return text;
    };

    expect(
      t.resolvePathDefinitionAcrossRefs(rootUri, '', 'property', undefined, 8, readFn)
    ).toEqual({
      uri: rootUri,
      startOffset: 0,
      pathAtTarget: '',
    });
    expect(
      t.resolvePathDefinitionAcrossRefs(
        'https://example.com/schema.json',
        'user.name',
        'property',
        undefined
      )
    ).toBeNull();
    expect(
      t.resolvePathDefinitionAcrossRefs(rootUri, 'user.name', 'value', 'string', 8, readFn)
    ).toMatchObject({
      uri: rootUri,
      startOffset: schemaText.indexOf('"string"'),
      pathAtTarget: 'user.name',
    });
    expect(
      t.resolvePathDefinitionAcrossRefs(
        rootUri,
        'user.address.city',
        'property',
        undefined,
        8,
        readFn
      )
    ).toMatchObject({
      uri: defsUri,
      startOffset: defsText.indexOf('"city"'),
      pathAtTarget: 'city',
    });
    expect(
      t.resolvePathDefinitionAcrossRefs(
        rootUri,
        'user.address.country.code',
        'property',
        undefined,
        8,
        readFn
      )
    ).toMatchObject({
      uri: moreUri,
      startOffset: moreText.indexOf('"code"'),
      pathAtTarget: 'code',
    });
    expect(
      t.resolvePathDefinitionAcrossRefs(rootUri, 'user.address', 'property', undefined, 8, readFn)
    ).toMatchObject({
      uri: defsUri,
      startOffset: defsText.indexOf('{', defsText.indexOf('"address"')),
      pathAtTarget: '',
    });
    expect(
      t.resolvePathDefinitionAcrossRefs(rootUri, 'alias', 'property', undefined, 8, readFn)
    ).toMatchObject({
      uri: rootUri,
      startOffset: schemaText.indexOf('{', schemaText.indexOf('"name"')),
      pathAtTarget: '',
    });
    expect(
      t.resolvePathDefinitionAcrossRefs(rootUri, 'user.missing', 'property', undefined, 8, readFn)
    ).toBeNull();
    expect(
      t.resolvePathDefinitionAcrossRefs(
        rootUri,
        'user.name.extra',
        'property',
        undefined,
        8,
        readFn
      )
    ).toBeNull();
    expect(
      t.resolvePathDefinitionAcrossRefs(rootUri, 'user.raw.extra', 'property', undefined, 8, readFn)
    ).toMatchObject({
      uri: rootUri,
      startOffset: schemaText.indexOf('"raw"'),
      pathAtTarget: 'user.raw',
    });
    expect(
      t.resolvePathDefinitionAcrossRefs(
        rootUri,
        'user.address.country.code',
        'property',
        undefined,
        0,
        readFn
      )
    ).toBeNull();
    expect(
      t.resolvePathDefinitionAcrossRefs(
        rootUri,
        'user.address.city',
        'property',
        undefined,
        8,
        () => {
          throw new Error('read failed');
        }
      )
    ).toBeNull();
    expect(
      t.resolvePathDefinitionAcrossRefs(rootUri, 'user.name', 'property', undefined, 8, () => '[]')
    ).toBeNull();
  });

  it('uses the default file reader for file-backed schema path resolution', () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'templjs-semantify-schema-'));
    const schemaPath = path.join(tempDir, 'schema.json');
    writeFileSync(schemaPath, schemaText, 'utf8');

    const resolved = t.resolvePathDefinitionAcrossRefs(
      pathToFileURL(schemaPath).toString(),
      'user.name',
      'property',
      undefined
    );

    expect(resolved).toMatchObject({
      uri: pathToFileURL(schemaPath).toString(),
      startOffset: schemaText.indexOf('"name"'),
      pathAtTarget: 'user.name',
    });
  });
});
