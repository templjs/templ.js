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

  it('declares helper extension metadata without executing editor policy', () => {
    const profile = createTempljsAuthoringProfile();

    expect(profile.helperExtensions?.map((helper) => helper.kind).sort()).toEqual([
      'candidate-provider',
      'definition-resolver',
      'diagnostic-planner',
      'hover-renderer',
    ]);
  });
});
