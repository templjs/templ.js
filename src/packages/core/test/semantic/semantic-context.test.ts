import { describe, expect, it } from 'vitest';
import {
  detectFrontmatterRange,
  getFrontmatterSchemaReferenceAtOffset,
  getFrontmatterSchemaAliases,
  getSemanticProfileId,
  resolveSemanticHostLanguage,
  resolveSemanticContextBlock,
  resolveSemanticZone,
  resolveSemanticZoneByHostLanguage,
  toSemanticZone,
  type SemanticRequest,
  type SemanticResponse,
} from '../../src/index.js';

describe('semantic-context core helpers', () => {
  it('resolves frontmatter/content context blocks from location and aliases', () => {
    const text = [
      '---',
      '$schema: ./frontmatter.json',
      '$content_schema: ./content.json',
      'type: project',
      '---',
      '{{ contentData.heading }}',
    ].join('\n');

    const frontmatterOffset = text.indexOf('type:') + 1;
    const contentAliasOffset = text.indexOf('$content_schema') + 3;
    const bodyOffset = text.indexOf('contentData') + 2;

    expect(resolveSemanticContextBlock(text, frontmatterOffset)).toBe('frontmatter');
    expect(resolveSemanticContextBlock(text, contentAliasOffset)).toBe('content');
    expect(resolveSemanticContextBlock(text, bodyOffset)).toBe('content');
  });

  it('extracts schema aliases from frontmatter without Volar helpers', () => {
    const text = [
      '---',
      '$templ-schema: ./frontmatter.json',
      '$content-schema: ./content.json',
      '---',
      'body',
    ].join('\n');

    const aliases = getFrontmatterSchemaAliases(text);
    expect(aliases.templSchema).toBe('./frontmatter.json');
    expect(aliases.contentSchema).toBe('./content.json');
  });

  it('detects frontmatter and schema aliases with CRLF line endings', () => {
    const text = [
      '---',
      '$schema: ./frontmatter-crlf.json',
      '$content_schema: ./content-crlf.json',
      '---',
      'body',
    ].join('\r\n');

    const range = detectFrontmatterRange(text);
    const aliases = getFrontmatterSchemaAliases(text);

    expect(range).toBeDefined();
    expect(range?.start).toBe(0);
    expect(range?.end ?? 0).toBeGreaterThan(0);
    expect(aliases.templSchema).toBe('./frontmatter-crlf.json');
    expect(aliases.contentSchema).toBe('./content-crlf.json');
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

  it('keeps semantic request/response contracts serializable for all operations', () => {
    const request: SemanticRequest = {
      version: 'v1',
      operation: 'diagnostics',
      contextBlock: 'content',
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
      contextBlock: 'content',
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
    expect(getSemanticProfileId('frontmatter')).toBe('schema-frontmatter');
    expect(getSemanticProfileId('content')).toBe('schema-content');

    expect(toSemanticZone('frontmatter')).toEqual({
      kind: 'metadata',
      profileId: 'schema-frontmatter',
      legacyContextBlock: 'frontmatter',
    });

    expect(toSemanticZone('content')).toEqual({
      kind: 'body',
      profileId: 'schema-content',
      legacyContextBlock: 'content',
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
      profileId: 'schema-frontmatter',
      legacyContextBlock: 'frontmatter',
    });
    expect(resolveSemanticZone(text, bodyOffset)).toEqual({
      kind: 'body',
      profileId: 'schema-content',
      legacyContextBlock: 'content',
    });
  });

  it('detects host language from templ document URI', () => {
    expect(resolveSemanticHostLanguage('file:///workspace/note.md.templ')).toBe('markdown');
    expect(resolveSemanticHostLanguage('file:///workspace/spec.yaml.templ')).toBe('yaml');
    expect(resolveSemanticHostLanguage('file:///workspace/data.json.templ')).toBe('json');
    expect(resolveSemanticHostLanguage('file:///workspace/template.html.templ')).toBe('html');
    expect(resolveSemanticHostLanguage('file:///workspace/config.toml.templ')).toBe('toml');
    expect(resolveSemanticHostLanguage('file:///workspace/layout.xml.templ')).toBe('xml');
  });

  it('uses host language to resolve semantic zone with markdown compatibility', () => {
    const text = ['---', '$schema: ./frontmatter.json', '---', 'body'].join('\n');
    const metadataOffset = text.indexOf('$schema') + 2;

    expect(resolveSemanticZoneByHostLanguage(text, metadataOffset, 'markdown')).toEqual({
      kind: 'metadata',
      profileId: 'schema-frontmatter',
      legacyContextBlock: 'frontmatter',
    });
    expect(resolveSemanticZoneByHostLanguage(text, metadataOffset, 'yaml')).toEqual({
      kind: 'body',
      profileId: 'schema-content',
      legacyContextBlock: 'content',
    });
  });
});
