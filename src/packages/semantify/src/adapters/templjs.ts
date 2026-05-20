import {
  DEFAULT_DELIMITERS,
  SchemaValidator,
  extractTemplateBindings,
  resolveSemanticZone,
  type DelimiterConfig,
  type JSONSchema,
  type LexerOptions,
  type SemanticContextBlock,
  type TemplateBinding,
} from '@templjs/core';
import type {
  AdapterNode,
  AdapterOutput,
  DelimiterConfigInput,
  OffsetRange,
  ProfileDefinition,
  ProjectionRule,
  SemantifySchemaVersion,
} from '../model/public-types.js';

const SEMANTIFY_SCHEMA_VERSION: SemantifySchemaVersion = '1.0.0';
const TEMPLJS_TEMPLATE_ADAPTER_ID = 'templjs-template';
const TEMPLJS_SCHEMA_ADAPTER_ID = 'templjs-schema';
const TEMPLJS_AUTHORING_PROFILE_ID = 'templjs-authoring';

export interface TempljsTemplateAdapterInput {
  text: string;
  sourceDocId: string;
  sourceUri?: string;
  adapterVersion?: string;
  delimiters?: DelimiterConfigInput;
}

export interface TempljsSchemaAdapterInput {
  schema: JSONSchema;
  sourceDocId: string;
  sourceUri?: string;
  contextBlock?: SemanticContextBlock;
  adapterVersion?: string;
}

function normalizeRange(startOffset: number, endOffset: number): OffsetRange {
  return endOffset >= startOffset
    ? { startOffset, endOffset }
    : { startOffset: endOffset, endOffset: startOffset };
}

function toCoreDelimiters(input?: DelimiterConfigInput): DelimiterConfig | undefined {
  if (!input) {
    return undefined;
  }

  const statementStart = input.statementStart ?? DEFAULT_DELIMITERS.statement_start;
  const statementEnd = input.statementEnd ?? DEFAULT_DELIMITERS.statement_end;
  const expressionStart = input.expressionStart ?? DEFAULT_DELIMITERS.expression_start;
  const expressionEnd = input.expressionEnd ?? DEFAULT_DELIMITERS.expression_end;
  const commentStart = input.commentStart ?? DEFAULT_DELIMITERS.comment_start;
  const commentEnd = input.commentEnd ?? DEFAULT_DELIMITERS.comment_end;

  return {
    statement_start: statementStart,
    statement_end: statementEnd,
    statement: [statementStart, statementEnd],
    expression_start: expressionStart,
    expression_end: expressionEnd,
    expression: [expressionStart, expressionEnd],
    comment_start: commentStart,
    comment_end: commentEnd,
    comment: [commentStart, commentEnd],
  };
}

function toLexerOptions(delimiters?: DelimiterConfigInput): LexerOptions | undefined {
  const coreDelimiters = toCoreDelimiters(delimiters);
  return coreDelimiters ? { delimiters: coreDelimiters } : undefined;
}

function bindingSpan(binding: TemplateBinding): OffsetRange {
  return normalizeRange(
    binding.declarationStartOffset ?? binding.scopeStartOffset,
    binding.declarationEndOffset ?? binding.scopeEndOffset
  );
}

function bindingToNode(binding: TemplateBinding): AdapterNode {
  return {
    id: `binding:${binding.name}:${bindingSpan(binding).startOffset}`,
    kind: 'templjs.binding',
    sourceSpan: bindingSpan(binding),
    content: {
      name: binding.name,
      bindingKind: binding.kind,
      sourcePath: binding.sourcePath,
      sourceExpression: binding.sourceExpression,
      scopeStartOffset: binding.scopeStartOffset,
      scopeEndOffset: binding.scopeEndOffset,
    },
    metadata: {
      scopeRange: {
        startOffset: binding.scopeStartOffset,
        endOffset: binding.scopeEndOffset,
      },
    },
  };
}

function getParentPath(path: string): string {
  const lastDot = path.lastIndexOf('.');
  return lastDot === -1 ? '' : path.slice(0, lastDot);
}

function getLabel(path: string): string {
  const lastDot = path.lastIndexOf('.');
  const label = lastDot === -1 ? path : path.slice(lastDot + 1);
  return label.replace(/\[[^\]]+\]/g, '');
}

function contextBlockProfileId(contextBlock: SemanticContextBlock): string {
  return `schema-${contextBlock}`;
}

function walkEnumNodes(
  schema: JSONSchema,
  contextBlock: SemanticContextBlock,
  currentPath: string,
  nodes: AdapterNode[]
): void {
  if (currentPath && Array.isArray(schema.enum)) {
    for (const value of schema.enum) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        nodes.push({
          id: `schema-enum:${contextBlock}:${currentPath}:${String(value)}`,
          kind: 'templjs.schema-enum-value',
          sourceSpan: { startOffset: 0, endOffset: 0 },
          content: {
            contextBlock,
            label: String(value),
            path: currentPath,
            profileId: contextBlockProfileId(contextBlock),
            value,
          },
        });
      }
    }
  }

  if (!schema.properties) {
    return;
  }

  for (const [key, child] of Object.entries(schema.properties)) {
    walkEnumNodes(child, contextBlock, currentPath ? `${currentPath}.${key}` : key, nodes);
  }
}

function createProjectionRule(input: {
  id: string;
  sourceNodeKind: string;
  targetSemanticKind: string;
  description: string;
}): ProjectionRule {
  return {
    schemaVersion: SEMANTIFY_SCHEMA_VERSION,
    id: input.id,
    name: input.description,
    version: '1.0.0',
    sourceNodeKind: input.sourceNodeKind,
    targetSemanticKind: input.targetSemanticKind,
    deterministicBehavior: 'strict',
    transformationSteps: [
      {
        kind: 'canonicalize',
        description: input.description,
      },
    ],
  };
}

export function createTempljsTemplateAdapterOutput(
  input: TempljsTemplateAdapterInput
): AdapterOutput {
  const bindings = extractTemplateBindings(input.text, toLexerOptions(input.delimiters));
  const nodes = bindings.map(bindingToNode);
  const zone = resolveSemanticZone(input.text, 0);

  nodes.push({
    id: `zone:${zone.legacyContextBlock}`,
    kind: 'templjs.semantic-zone',
    sourceSpan: { startOffset: 0, endOffset: input.text.length },
    content: {
      contextBlock: zone.legacyContextBlock,
      profileId: zone.profileId,
      zoneKind: zone.kind,
    },
  });

  return {
    schemaVersion: SEMANTIFY_SCHEMA_VERSION,
    adapterId: TEMPLJS_TEMPLATE_ADAPTER_ID,
    adapterVersion: input.adapterVersion ?? '1.0.0',
    sourceDocId: input.sourceDocId,
    ...(input.sourceUri ? { sourceUri: input.sourceUri } : {}),
    nodes,
  };
}

export function createTempljsSchemaAdapterOutput(input: TempljsSchemaAdapterInput): AdapterOutput {
  const contextBlock = input.contextBlock ?? 'content';
  const validator = new SchemaValidator(input.schema);
  const metadata = validator.getMetadata();
  const nodes: AdapterNode[] = [];

  for (const [path, entry] of Object.entries(metadata)) {
    nodes.push({
      id: `schema-path:${contextBlock}:${path}`,
      kind: 'templjs.schema-path',
      sourceSpan: { startOffset: 0, endOffset: 0 },
      content: {
        contextBlock,
        description: entry.description,
        isDirectProperty: !path.includes('.') && !path.includes('['),
        isTopLevel: getParentPath(path) === '',
        label: getLabel(path),
        parentPath: getParentPath(path),
        path,
        profileId: contextBlockProfileId(contextBlock),
        type: entry.type,
      },
    });
  }

  walkEnumNodes(input.schema, contextBlock, '', nodes);

  return {
    schemaVersion: SEMANTIFY_SCHEMA_VERSION,
    adapterId: TEMPLJS_SCHEMA_ADAPTER_ID,
    adapterVersion: input.adapterVersion ?? '1.0.0',
    sourceDocId: input.sourceDocId,
    ...(input.sourceUri ? { sourceUri: input.sourceUri } : {}),
    nodes,
  };
}

export function createTempljsAuthoringProfile(): ProfileDefinition {
  return {
    schemaVersion: SEMANTIFY_SCHEMA_VERSION,
    id: TEMPLJS_AUTHORING_PROFILE_ID,
    version: '1.0.0',
    semanticKinds: [
      {
        kind: 'templjs.binding',
        description: 'Template local binding projected from parser scope facts.',
      },
      {
        kind: 'templjs.schema-path',
        description: 'Schema path available to template authoring features.',
      },
      {
        kind: 'templjs.schema-enum-value',
        description: 'Enum value available for a schema path.',
      },
      {
        kind: 'templjs.semantic-zone',
        description: 'Semantic zone for a source document.',
      },
    ],
    projectionRules: [
      createProjectionRule({
        id: 'templjs.binding.to-node',
        sourceNodeKind: 'templjs.binding',
        targetSemanticKind: 'templjs.binding',
        description: 'Project template binding observation to graph node.',
      }),
      createProjectionRule({
        id: 'templjs.schema-path.to-node',
        sourceNodeKind: 'templjs.schema-path',
        targetSemanticKind: 'templjs.schema-path',
        description: 'Project schema path observation to graph node.',
      }),
      createProjectionRule({
        id: 'templjs.schema-enum-value.to-node',
        sourceNodeKind: 'templjs.schema-enum-value',
        targetSemanticKind: 'templjs.schema-enum-value',
        description: 'Project schema enum observation to graph node.',
      }),
      createProjectionRule({
        id: 'templjs.semantic-zone.to-node',
        sourceNodeKind: 'templjs.semantic-zone',
        targetSemanticKind: 'templjs.semantic-zone',
        description: 'Project semantic zone observation to graph node.',
      }),
    ],
    helperExtensions: [
      {
        schemaVersion: SEMANTIFY_SCHEMA_VERSION,
        id: 'templjs.authoring.candidates',
        kind: 'candidate-provider',
        consumesSemanticKinds: ['templjs.binding', 'templjs.schema-path', 'templjs.schema-enum-value'],
        description: 'Language-service candidate provider over projected TemplJS authoring facts.',
      },
      {
        schemaVersion: SEMANTIFY_SCHEMA_VERSION,
        id: 'templjs.authoring.definition',
        kind: 'definition-resolver',
        consumesSemanticKinds: ['templjs.binding', 'templjs.schema-path'],
        description: 'Language-service definition resolver over projected TemplJS authoring facts.',
      },
      {
        schemaVersion: SEMANTIFY_SCHEMA_VERSION,
        id: 'templjs.authoring.hover',
        kind: 'hover-renderer',
        consumesSemanticKinds: ['templjs.binding', 'templjs.schema-path'],
        description: 'Language-service hover renderer over projected TemplJS authoring facts.',
      },
      {
        schemaVersion: SEMANTIFY_SCHEMA_VERSION,
        id: 'templjs.authoring.diagnostics',
        kind: 'diagnostic-planner',
        consumesSemanticKinds: ['templjs.binding', 'templjs.schema-path'],
        description: 'Language-service diagnostic planner over projected TemplJS authoring facts.',
      },
    ],
    defaultAdapters: [
      {
        adapterId: TEMPLJS_TEMPLATE_ADAPTER_ID,
        adapterVersionRange: '^1.0.0',
        sourceNodeKinds: ['templjs.binding', 'templjs.semantic-zone'],
      },
      {
        adapterId: TEMPLJS_SCHEMA_ADAPTER_ID,
        adapterVersionRange: '^1.0.0',
        sourceNodeKinds: ['templjs.schema-path', 'templjs.schema-enum-value'],
      },
    ],
  };
}
