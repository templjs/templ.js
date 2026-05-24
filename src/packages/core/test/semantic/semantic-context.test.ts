import { describe, expect, it } from 'vitest';
import {
  detectFrontmatterRange,
  getFrontmatterKeyValueAtOffset,
  getFrontmatterSchemaReferenceAtOffset,
  getFrontmatterSchemaSources,
  getSemanticProfileId,
  getTokenAtOffset,
  isOffsetInFrontmatter,
  resolveSemanticHostLanguage,
  resolveSemanticZoneSegment,
  resolveSemanticZone,
  resolveSemanticZoneByHostLanguage,
  toSemanticZone,
  type SemanticRequest,
  type SemanticResponse,
} from '../../src/index.js';

describe('semantic-context core helpers', () => {
  it('resolves metadata/content zone segments from location and canonical schema keys', () => {
    const text = [
      '---',
      '$schema: ./frontmatter.json',
      '$content-schema: ./content.json',
      'type: project',
      '---',
      '{{ contentData.heading }}',
    ].join('\n');

    const frontmatterOffset = text.indexOf('type:') + 1;
    const contentAliasOffset = text.indexOf('$content-schema') + 3;
    const bodyOffset = text.indexOf('contentData') + 2;

    expect(resolveSemanticZoneSegment(text, frontmatterOffset)).toBe('metadata');
    expect(resolveSemanticZoneSegment(text, contentAliasOffset)).toBe('content');
    expect(resolveSemanticZoneSegment(text, bodyOffset)).toBe('content');
  });

  it('extracts schema sources from frontmatter without Volar helpers', () => {
    const text = [
      '---',
      '$schema: ./frontmatter.json',
      '$content-schema: ./content.json',
      '---',
      'body',
    ].join('\n');

    const sources = getFrontmatterSchemaSources(text);
    expect(sources.schemaPath).toBe('./frontmatter.json');
    expect(sources.contentSchemaPath).toBe('./content.json');
  });

  it('preserves schema fragments in frontmatter schema sources', () => {
    const text = [
      '---',
      '$schema: ./frontmatter.json#/$defs/workItem',
      '$content-schema: "./content.json#/$defs/body" # fixture comment',
      '---',
      'body',
    ].join('\n');

    const sources = getFrontmatterSchemaSources(text);

    expect(sources.schemaPath).toBe('./frontmatter.json#/$defs/workItem');
    expect(sources.contentSchemaPath).toBe('./content.json#/$defs/body');
  });

  it('detects frontmatter and schema sources with CRLF line endings', () => {
    const text = [
      '---',
      '$schema: ./frontmatter-crlf.json',
      '$content-schema: ./content-crlf.json',
      '---',
      'body',
    ].join('\r\n');

    const range = detectFrontmatterRange(text);
    const sources = getFrontmatterSchemaSources(text);

    expect(range).toBeDefined();
    expect(range?.start).toBe(0);
    expect(range?.end ?? 0).toBeGreaterThan(0);
    expect(sources.schemaPath).toBe('./frontmatter-crlf.json');
    expect(sources.contentSchemaPath).toBe('./content-crlf.json');
  });

  it('resolves schema key/value references at offsets with CRLF line endings', () => {
    const text = ['---', '$schema: ./frontmatter-crlf.json', '---', 'body'].join('\r\n');

    const keyOffset = text.indexOf('$schema') + 2;
    const valueOffset = text.indexOf('./frontmatter-crlf.json') + 5;

    expect(getFrontmatterSchemaReferenceAtOffset(text, keyOffset)).toEqual({
      value: './frontmatter-crlf.json',
    });
    expect(getFrontmatterSchemaReferenceAtOffset(text, valueOffset)).toEqual({
      value: './frontmatter-crlf.json',
    });
  });

  it('resolves schema references with fragments and trailing comments', () => {
    const text = [
      '---',
      '$content-schema: ./content.json#/$defs/body # benchmark fixture',
      '---',
      'body',
    ].join('\n');

    const keyOffset = text.indexOf('$content-schema') + 3;
    const valueOffset = text.indexOf('./content.json#/$defs/body') + 10;

    expect(getFrontmatterSchemaReferenceAtOffset(text, keyOffset)).toEqual({
      value: './content.json#/$defs/body',
    });
    expect(getFrontmatterSchemaReferenceAtOffset(text, valueOffset)).toEqual({
      value: './content.json#/$defs/body',
    });
  });

  it('extracts key/value tokens and frontmatter membership at offsets', () => {
    const text = ['---', 'assetPath: ./docs/spec.json', '---', '{{ assetPath }}'].join('\n');
    const keyOffset = text.indexOf('assetPath') + 2;
    const valueOffset = text.indexOf('./docs/spec.json') + 5;
    const bodyOffset = text.lastIndexOf('assetPath') + 2;

    expect(getFrontmatterKeyValueAtOffset(text, valueOffset)).toEqual({
      key: 'assetPath',
      valueToken: './docs/spec.json',
    });
    expect(getTokenAtOffset(text, valueOffset)).toEqual(
      expect.objectContaining({ token: './docs/spec.json' })
    );
    expect(isOffsetInFrontmatter(text, keyOffset)).toBe(true);
    expect(isOffsetInFrontmatter(text, bodyOffset)).toBe(false);
  });

  it('returns undefined key/value pairs outside frontmatter lines', () => {
    const text = ['---', 'title: Example', '---', 'body text'].join('\n');
    const bodyOffset = text.indexOf('body') + 1;

    expect(getFrontmatterKeyValueAtOffset(text, bodyOffset)).toBeNull();
    expect(getTokenAtOffset(text, bodyOffset)).toEqual(expect.objectContaining({ token: 'body' }));
  });

  it('handles missing frontmatter fences and invalid offsets safely', () => {
    const text = 'plain body text';

    expect(detectFrontmatterRange(text)).toBeUndefined();
    expect(isOffsetInFrontmatter(text, 0)).toBe(false);
    expect(getFrontmatterSchemaSources(text)).toEqual({});
    expect(getFrontmatterSchemaReferenceAtOffset(text, 999)).toBeNull();
    expect(getFrontmatterKeyValueAtOffset(text, -1)).toBeNull();
    expect(getTokenAtOffset(text, -1)).toBeUndefined();
    expect(getTokenAtOffset(text, text.length + 1)).toBeUndefined();
  });

  it('treats unterminated frontmatter as absent', () => {
    const text = ['---', '$schema: ./frontmatter.json', 'title: Example'].join('\n');

    expect(detectFrontmatterRange(text)).toBeUndefined();
    expect(getFrontmatterSchemaSources(text)).toEqual({});
    expect(getFrontmatterSchemaReferenceAtOffset(text, text.indexOf('$schema') + 2)).toBeNull();
  });

  it('handles token lookup on token boundaries and whitespace', () => {
    const text = 'alpha beta';

    expect(getTokenAtOffset(text, text.indexOf('alpha') + 'alpha'.length)).toEqual({
      token: 'alpha',
      start: 0,
      end: 5,
    });
    expect(getTokenAtOffset(text, text.indexOf(' '))).toEqual({ token: 'alpha', start: 0, end: 5 });
    expect(getTokenAtOffset(text, text.length)).toEqual({ token: 'beta', start: 6, end: 10 });
  });

  it('returns undefined for token lookup when no token characters are present', () => {
    expect(getTokenAtOffset(',', 0)).toBeUndefined();
    expect(getTokenAtOffset('   ', 1)).toBeUndefined();
  });

  it('walks backward from punctuation offsets to the previous token', () => {
    const text = 'alpha,beta';
    const commaOffset = text.indexOf(',');

    expect(getTokenAtOffset(text, commaOffset)).toEqual({ token: 'alpha', start: 0, end: 5 });
  });

  it('returns undefined when only an opening frontmatter fence is present', () => {
    const text = '---\n$schema: ./schema.json\nbody';
    expect(detectFrontmatterRange(text)).toBeUndefined();
  });

  it('extracts quoted schema sources and ignores unrelated frontmatter keys', () => {
    const text = [
      '---',
      '"$schema": "./quoted-frontmatter.json"',
      "'$content-schema': './quoted-content.json'",
      'title: Example',
      '---',
    ].join('\n');

    expect(getFrontmatterSchemaSources(text)).toEqual({
      schemaPath: './quoted-frontmatter.json',
      contentSchemaPath: './quoted-content.json',
    });
    expect(getFrontmatterSchemaReferenceAtOffset(text, text.indexOf('title:') + 2)).toBeNull();
  });

  it('prefers the first matching schema sources and ignores empty values', () => {
    const text = [
      '---',
      '$schema: ./first.json',
      '$schema: ./second.json',
      '$content-schema: ',
      '$content-schema: ./content.json',
      '---',
    ].join('\n');

    expect(getFrontmatterSchemaSources(text)).toEqual({
      schemaPath: './first.json',
      contentSchemaPath: './content.json',
    });
  });

  it('returns null for offsets before a frontmatter value begins', () => {
    const text = ['---', 'title: Example', '---'].join('\n');
    const keyOffset = text.indexOf('title') + 2;

    expect(getFrontmatterKeyValueAtOffset(text, keyOffset)).toBeNull();
  });

  it('returns null for frontmatter lines that do not match key/value shape', () => {
    const text = ['---', '- invalid', '---'].join('\n');
    const offset = text.indexOf('- invalid') + 2;

    expect(getFrontmatterKeyValueAtOffset(text, offset)).toBeNull();
  });

  it('returns null when querying key/value outside frontmatter on terminal lines', () => {
    const text = ['---', 'asset: ./docs/spec.json', '---', 'title: Example'].join('\n');
    const offset = text.lastIndexOf('Example') + 2;

    expect(getFrontmatterKeyValueAtOffset(text, offset)).toBeNull();
  });

  it('parses quoted frontmatter keys and rejects empty values', () => {
    const text = ['---', '"asset-path": "./docs/spec.json"', "subtitle: ''", '---'].join('\n');
    const valueOffset = text.indexOf('./docs/spec.json') + 4;
    const emptyValueOffset = text.indexOf("''") + 1;

    expect(getFrontmatterKeyValueAtOffset(text, valueOffset)).toEqual({
      key: 'asset-path',
      valueToken: './docs/spec.json',
    });
    expect(getFrontmatterKeyValueAtOffset(text, emptyValueOffset)).toBeNull();
  });

  it('falls back to token-based detection for content schema references', () => {
    const text = ['---', 'reference: $content-schema', '---', 'body'].join('\n');
    const tokenOffset = text.indexOf('$content-schema') + 3;

    expect(resolveSemanticZoneSegment(text, tokenOffset)).toBe('content');
  });

  it('keeps semantic request/response contracts serializable for all operations', () => {
    const request: SemanticRequest = {
      version: 'v1',
      operation: 'diagnostics',
      segment: 'content',
      location: {
        documentUri: 'file:///workspace/doc.md.tpl',
        line: 16,
        character: 4,
        offset: 220,
      },
    };

    const response: SemanticResponse = {
      version: 'v1',
      revision: 2,
      operation: 'diagnostics',
      segment: 'content',
      diagnostics: [
        {
          message: 'Variable "foo" not found in schema',
          severity: 1,
          code: 'templjs.undefinedVariable',
          source: 'templjs',
          range: {
            start: { line: 16, character: 4 },
            end: { line: 16, character: 7 },
          },
        },
      ],
    };

    expect(JSON.parse(JSON.stringify(request))).toEqual(request);
    expect(JSON.parse(JSON.stringify(response))).toEqual(response);
  });

  it('maps legacy context blocks to generic semantic zones', () => {
    expect(getSemanticProfileId('metadata')).toBe('schema-metadata');
    expect(getSemanticProfileId('content')).toBe('schema-content');

    expect(toSemanticZone('metadata')).toEqual({
      kind: 'metadata',
      profileId: 'schema-metadata',
      segment: 'metadata',
    });

    expect(toSemanticZone('content')).toEqual({
      kind: 'content',
      profileId: 'schema-content',
      segment: 'content',
    });
  });

  it('resolves semantic zone from text position', () => {
    const text = ['---', '$schema: ./frontmatter.json', '---', '{{ contentData.heading }}'].join(
      '\n'
    );

    const metadataOffset = text.indexOf('$schema') + 2;
    const bodyOffset = text.indexOf('contentData') + 2;

    expect(resolveSemanticZone(text, metadataOffset)).toEqual({
      kind: 'metadata',
      profileId: 'schema-metadata',
      segment: 'metadata',
    });
    expect(resolveSemanticZone(text, bodyOffset)).toEqual({
      kind: 'content',
      profileId: 'schema-content',
      segment: 'content',
    });
  });

  it('detects host language from templ document URI', () => {
    expect(resolveSemanticHostLanguage('file:///workspace/note.md.templ')).toBe('markdown');
    expect(resolveSemanticHostLanguage('file:///workspace/note.templ.md')).toBe('markdown');
    expect(resolveSemanticHostLanguage('file:///workspace/spec.yaml.templ')).toBe('yaml');
    expect(resolveSemanticHostLanguage('file:///workspace/spec.templ.yml')).toBe('yaml');
    expect(resolveSemanticHostLanguage('file:///workspace/data.json.templ')).toBe('json');
    expect(resolveSemanticHostLanguage('file:///workspace/data.templ.json')).toBe('json');
    expect(resolveSemanticHostLanguage('file:///workspace/template.html.templ')).toBe('html');
    expect(resolveSemanticHostLanguage('file:///workspace/template.templ.html')).toBe('html');
    expect(resolveSemanticHostLanguage('file:///workspace/config.toml.templ')).toBe('toml');
    expect(resolveSemanticHostLanguage('file:///workspace/config.templ.toml')).toBe('toml');
    expect(resolveSemanticHostLanguage('file:///workspace/layout.xml.templ')).toBe('xml');
    expect(resolveSemanticHostLanguage('file:///workspace/layout.templ.xml')).toBe('xml');
    expect(resolveSemanticHostLanguage(undefined)).toBe('plaintext');
    expect(resolveSemanticHostLanguage('file:///workspace/file.templ')).toBe('plaintext');
  });

  it('detects host language from tmpl document URI', () => {
    expect(resolveSemanticHostLanguage('file:///workspace/note.md.tmpl')).toBe('markdown');
    expect(resolveSemanticHostLanguage('file:///workspace/note.tmpl.md')).toBe('markdown');
    expect(resolveSemanticHostLanguage('file:///workspace/spec.yaml.tmpl')).toBe('yaml');
    expect(resolveSemanticHostLanguage('file:///workspace/spec.yml.tmpl')).toBe('yaml');
    expect(resolveSemanticHostLanguage('file:///workspace/spec.tmpl.yml')).toBe('yaml');
    expect(resolveSemanticHostLanguage('file:///workspace/data.json.tmpl')).toBe('json');
    expect(resolveSemanticHostLanguage('file:///workspace/data.tmpl.json')).toBe('json');
    expect(resolveSemanticHostLanguage('file:///workspace/template.html.tmpl')).toBe('html');
    expect(resolveSemanticHostLanguage('file:///workspace/template.tmpl.html')).toBe('html');
    expect(resolveSemanticHostLanguage('file:///workspace/config.toml.tmpl')).toBe('toml');
    expect(resolveSemanticHostLanguage('file:///workspace/config.tmpl.toml')).toBe('toml');
    expect(resolveSemanticHostLanguage('file:///workspace/layout.xml.tmpl')).toBe('xml');
    expect(resolveSemanticHostLanguage('file:///workspace/layout.tmpl.xml')).toBe('xml');
    expect(resolveSemanticHostLanguage('file:///workspace/file.tmpl')).toBe('plaintext');
  });

  it('detects host language from tpl document URI', () => {
    expect(resolveSemanticHostLanguage('file:///workspace/note.md.tpl')).toBe('markdown');
    expect(resolveSemanticHostLanguage('file:///workspace/note.tpl.md')).toBe('markdown');
    expect(resolveSemanticHostLanguage('file:///workspace/spec.yaml.tpl')).toBe('yaml');
    expect(resolveSemanticHostLanguage('file:///workspace/spec.yml.tpl')).toBe('yaml');
    expect(resolveSemanticHostLanguage('file:///workspace/spec.tpl.yml')).toBe('yaml');
    expect(resolveSemanticHostLanguage('file:///workspace/data.json.tpl')).toBe('json');
    expect(resolveSemanticHostLanguage('file:///workspace/data.tpl.json')).toBe('json');
    expect(resolveSemanticHostLanguage('file:///workspace/template.html.tpl')).toBe('html');
    expect(resolveSemanticHostLanguage('file:///workspace/template.tpl.html')).toBe('html');
    expect(resolveSemanticHostLanguage('file:///workspace/config.toml.tpl')).toBe('toml');
    expect(resolveSemanticHostLanguage('file:///workspace/config.tpl.toml')).toBe('toml');
    expect(resolveSemanticHostLanguage('file:///workspace/layout.xml.tpl')).toBe('xml');
    expect(resolveSemanticHostLanguage('file:///workspace/layout.tpl.xml')).toBe('xml');
    expect(resolveSemanticHostLanguage('file:///workspace/file.tpl')).toBe('plaintext');
  });

  it('uses host language to resolve semantic zone with markdown compatibility', () => {
    const text = ['---', '$schema: ./frontmatter.json', '---', 'body'].join('\n');
    const metadataOffset = text.indexOf('$schema') + 2;

    expect(resolveSemanticZoneByHostLanguage(text, metadataOffset, 'markdown')).toEqual({
      kind: 'metadata',
      profileId: 'schema-metadata',
      segment: 'metadata',
    });
    expect(resolveSemanticZoneByHostLanguage(text, metadataOffset, 'yaml')).toEqual({
      kind: 'content',
      profileId: 'schema-content',
      segment: 'content',
    });
  });
});
