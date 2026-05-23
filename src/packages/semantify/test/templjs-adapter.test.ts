import { describe, expect, it } from 'vitest';
import {
  createTempljsAuthoringProfile,
  createTempljsSchemaAdapterOutput,
  createTempljsTemplateAdapterOutput,
  projectSemanticGraph,
} from '../src/index.js';

describe('TemplJS adapters and authoring profile', () => {
  it('projects template bindings through the authoring profile', () => {
    const adapterOutput = createTempljsTemplateAdapterOutput({
      sourceDocId: 'file:///example.md.tpl',
      text: '{% for item in users %}{{ item.name }}{% endfor %}',
    });
    const profile = createTempljsAuthoringProfile();

    const result = projectSemanticGraph({ adapterOutput, profile });

    expect(adapterOutput.nodes.some((node) => node.kind === 'templjs.binding')).toBe(true);
    expect(result.graph.nodes.some((node) => node.kind === 'templjs.binding')).toBe(true);
    expect(result.graph.nodes.find((node) => node.kind === 'templjs.binding')).toMatchObject({
      attributes: {
        name: 'item',
        bindingKind: 'for-alias',
      },
      provenance: {
        providerId: 'templjs-template',
        projectionRuleId: 'templjs.binding.to-node',
      },
    });
  });

  it('projects schema paths and enum values through the authoring profile', () => {
    const adapterOutput = createTempljsSchemaAdapterOutput({
      sourceDocId: 'file:///example.schema.json',
      schema: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            description: 'Current status.',
            enum: ['draft', 'ready'],
          },
        },
      },
    });
    const profile = createTempljsAuthoringProfile();

    const result = projectSemanticGraph({ adapterOutput, profile });

    expect(result.graph.nodes.map((node) => node.kind).sort()).toEqual([
      'templjs.schema-enum-value',
      'templjs.schema-enum-value',
      'templjs.schema-path',
    ]);
    expect(result.graph.nodes.find((node) => node.kind === 'templjs.schema-path')).toMatchObject({
      attributes: {
        label: 'status',
        path: 'status',
        type: 'string',
      },
      provenance: {
        providerId: 'templjs-schema',
        projectionRuleId: 'templjs.schema-path.to-node',
      },
    });
  });

  it('projects schema source spans from schema text into graph provenance', () => {
    const schemaText = [
      '{',
      '  "type": "object",',
      '  "properties": {',
      '    "status": {',
      '      "type": "string",',
      '      "enum": ["draft", "ready"]',
      '    }',
      '  }',
      '}',
    ].join('\n');
    const adapterOutput = createTempljsSchemaAdapterOutput({
      sourceDocId: 'file:///example.schema.json',
      sourceUri: 'file:///example.schema.json',
      schemaText,
      schema: JSON.parse(schemaText) as object,
    });
    const profile = createTempljsAuthoringProfile();

    const result = projectSemanticGraph({ adapterOutput, profile });
    const statusNode = result.graph.nodes.find(
      (node) => node.kind === 'templjs.schema-path' && node.attributes?.path === 'status'
    );
    const draftNode = result.graph.nodes.find(
      (node) => node.kind === 'templjs.schema-enum-value' && node.attributes?.label === 'draft'
    );

    expect(statusNode?.provenance?.sourceSpan).toEqual({
      startOffset: schemaText.indexOf('"status"'),
      endOffset: schemaText.indexOf('"status"') + '"status"'.length,
    });
    expect(draftNode?.provenance?.sourceSpan).toEqual({
      startOffset: schemaText.indexOf('"draft"'),
      endOffset: schemaText.indexOf('"draft"') + '"draft"'.length,
    });
  });

  it('declares helper extension metadata without executing editor policy', () => {
    const profile = createTempljsAuthoringProfile();

    expect(profile.helperExtensions?.map((helper) => helper.kind).sort()).toEqual([
      'candidate-provider',
      'definition-resolver',
      'diagnostic-provider',
      'formatting-orchestrator',
      'hover-renderer',
      'semantic-token-provider',
    ]);

    expect(
      profile.helperExtensions?.every((helper) => helper.consumesSemanticKinds.length > 0)
    ).toBe(true);
  });

  it('supports partial custom delimiters and adapter metadata defaults', () => {
    const adapterOutput = createTempljsTemplateAdapterOutput({
      sourceDocId: 'file:///custom.tpl',
      sourceUri: 'file:///custom.tpl',
      adapterVersion: '2.0.0',
      delimiters: {
        expressionStart: '[[',
        expressionEnd: ']]',
      },
      text: '{% set user = {"name": "Ada"} %}[[ user.name ]]',
    });

    expect(adapterOutput.adapterVersion).toBe('2.0.0');
    expect(adapterOutput.sourceUri).toBe('file:///custom.tpl');
    expect(adapterOutput.nodes.some((node) => node.kind === 'templjs.semantic-zone')).toBe(true);
    expect(adapterOutput.nodes.some((node) => node.kind === 'templjs.binding')).toBe(true);
  });

  it('builds schema nodes for nested paths and filters enum values to primitive scalars', () => {
    const adapterOutput = createTempljsSchemaAdapterOutput({
      sourceDocId: 'file:///nested.schema.json',
      sourceUri: 'file:///nested.schema.json',
      zoneSegment: 'metadata',
      adapterVersion: '2.0.0',
      schema: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['Ada', 'Grace', { unsupported: true }],
          },
        },
      },
    });

    const schemaPathNode = adapterOutput.nodes.find(
      (node) => node.kind === 'templjs.schema-path' && String(node.id).includes('status')
    );
    const enumNodes = adapterOutput.nodes.filter(
      (node) => node.kind === 'templjs.schema-enum-value'
    );

    expect(adapterOutput.adapterVersion).toBe('2.0.0');
    expect(adapterOutput.sourceUri).toBe('file:///nested.schema.json');
    expect(schemaPathNode?.content.profileId).toBe('schema-metadata');
    expect(enumNodes.map((node) => node.content.value).sort()).toEqual(['Ada', 'Grace']);
  });

  it('handles schemas without properties by returning no projected schema nodes', () => {
    const adapterOutput = createTempljsSchemaAdapterOutput({
      sourceDocId: 'file:///scalar.schema.json',
      schema: {
        type: 'string',
      },
    });

    expect(adapterOutput.nodes).toEqual([]);
  });

  it('supports statement-only custom delimiters while preserving default expression delimiters', () => {
    const adapterOutput = createTempljsTemplateAdapterOutput({
      sourceDocId: 'file:///statement-delims.tpl',
      delimiters: {
        statementStart: '<%',
        statementEnd: '%>',
      },
      text: '<% set title = page.title %>{{ title }}',
    });

    const bindingNode = adapterOutput.nodes.find((node) => node.kind === 'templjs.binding');
    expect(bindingNode?.content.name).toBe('title');
  });

  it('projects nested schema metadata paths using dotted parent relationships', () => {
    const adapterOutput = createTempljsSchemaAdapterOutput({
      sourceDocId: 'file:///nested-paths.schema.json',
      schema: {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              profile: {
                type: 'object',
                properties: {
                  displayName: {
                    type: 'string',
                  },
                },
              },
            },
          },
        },
      },
    });

    const nestedPathNode = adapterOutput.nodes.find(
      (node) =>
        node.kind === 'templjs.schema-path' && node.content.path === 'user.profile.displayName'
    );

    expect(nestedPathNode).toMatchObject({
      content: {
        label: 'displayName',
        parentPath: 'user.profile',
        isTopLevel: false,
      },
    });
  });
});
