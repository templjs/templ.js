import type {
  AdapterNode,
  AdapterOutput,
  ProjectionDiagnostic,
  ProjectionEntity,
  ProjectionResult,
  ProjectionRule,
  ProjectionRuleContext,
  ProjectionRuntimeInput,
  ProjectionRuntimeOptions,
  ProfileDefinition,
  SemanticGraphEdge,
  SemanticGraphNode,
  SemanticGraphProvenance,
  SemantifySchemaVersion,
  TypedProjectionRule,
} from '../model/public-types.js';
import type { JsonObject, JsonValue } from '@templjs/context-graph';

const SEMANTIFY_SCHEMA_VERSION: SemantifySchemaVersion = '1.0.0';
const GRAPH_CONTRACT_VERSION = 'v1' as const;

function stableNormalize(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => stableNormalize(item));
  }

  const record = value as Record<string, unknown>;
  const normalized: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    const item = record[key];
    if (item !== undefined) {
      normalized[key] = stableNormalize(item);
    }
  }
  return normalized;
}

function stableSerialize(value: unknown): string {
  return JSON.stringify(stableNormalize(value)) ?? 'null';
}

function hashString(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function sanitizeJsonValue(value: unknown): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeJsonValue(item));
  }

  if (value && typeof value === 'object') {
    return toJsonObject(value as Record<string, unknown>);
  }

  return String(value);
}

function toJsonObject(value: Record<string, unknown>): JsonObject {
  const result: JsonObject = {};
  for (const key of Object.keys(value).sort()) {
    const item = value[key];
    if (item !== undefined) {
      result[key] = sanitizeJsonValue(item);
    }
  }
  return result;
}

function getNodeOrderKey(node: AdapterNode): string {
  return [
    String(node.sourceSpan.startOffset).padStart(12, '0'),
    String(node.sourceSpan.endOffset).padStart(12, '0'),
    node.kind,
    node.id ?? '',
    stableSerialize(node.content),
  ].join('\u0000');
}

function createStableId(input: {
  profile: ProfileDefinition;
  adapterOutput: AdapterOutput;
  rule: ProjectionRule;
  sourceNode: AdapterNode;
  idSuffix?: string;
  entityType: 'node' | 'edge';
}): string {
  const payload = stableSerialize({
    adapterId: input.adapterOutput.adapterId,
    entityType: input.entityType,
    idSuffix: input.idSuffix,
    profileId: input.profile.id,
    profileVersion: input.profile.version,
    ruleId: input.rule.id,
    ruleVersion: input.rule.version,
    sourceDocId: input.adapterOutput.sourceDocId,
    sourceNodeId: input.sourceNode.id,
    sourceNodeKind: input.sourceNode.kind,
    sourceSpan: input.sourceNode.sourceSpan,
    content: input.sourceNode.content,
  });
  return `${input.profile.id}:${input.entityType}:${hashString(payload)}`;
}

function createProvenance(input: {
  adapterOutput: AdapterOutput;
  sourceNode: AdapterNode;
  rule: ProjectionRule;
  targetId: string;
  confidence?: SemanticGraphProvenance['confidence'];
}): SemanticGraphProvenance {
  return {
    version: GRAPH_CONTRACT_VERSION,
    providerId: input.adapterOutput.adapterId,
    providerVersion: input.adapterOutput.adapterVersion,
    sourceDocId: input.adapterOutput.sourceDocId,
    ...(input.adapterOutput.sourceUri ? { sourceUri: input.adapterOutput.sourceUri } : {}),
    sourceSpan: input.sourceNode.sourceSpan,
    ...(input.sourceNode.sourceLoc ? { sourceLoc: input.sourceNode.sourceLoc } : {}),
    projectionRuleId: input.rule.id,
    confidence: input.confidence ?? 'definite',
    targetId: input.targetId,
    attributes: {
      profileVersion: input.rule.version,
      sourceNodeKind: input.sourceNode.kind,
    },
  };
}

function createRuleContext(input: {
  adapterOutput: AdapterOutput;
  profile: ProfileDefinition;
  rule: ProjectionRule;
}): ProjectionRuleContext {
  return {
    adapterOutput: input.adapterOutput,
    profile: input.profile,
    rule: input.rule,
    createNode: ({ sourceNode, kind, content, idSuffix, attributes, confidence }) => {
      const id = createStableId({
        adapterOutput: input.adapterOutput,
        entityType: 'node',
        idSuffix,
        profile: input.profile,
        rule: input.rule,
        sourceNode,
      });
      return {
        id,
        profileId: input.profile.id,
        kind: kind ?? input.rule.targetSemanticKind,
        attributes: attributes ?? toJsonObject(content ?? sourceNode.content),
        provenance: createProvenance({
          adapterOutput: input.adapterOutput,
          confidence,
          rule: input.rule,
          sourceNode,
          targetId: id,
        }),
      };
    },
    createEdge: ({ sourceNode, from, to, kind, content, idSuffix, attributes, confidence }) => {
      const id = createStableId({
        adapterOutput: input.adapterOutput,
        entityType: 'edge',
        idSuffix: idSuffix ?? `${from}:${to}`,
        profile: input.profile,
        rule: input.rule,
        sourceNode,
      });
      return {
        id,
        profileId: input.profile.id,
        from,
        to,
        kind: kind ?? input.rule.targetSemanticKind,
        attributes: attributes ?? toJsonObject(content ?? sourceNode.content),
        provenance: createProvenance({
          adapterOutput: input.adapterOutput,
          confidence,
          rule: input.rule,
          sourceNode,
          targetId: id,
        }),
      };
    },
    toJsonObject,
  };
}

function validateAdapterOutput(adapterOutput: AdapterOutput): ProjectionDiagnostic[] {
  const diagnostics: ProjectionDiagnostic[] = [];

  if (adapterOutput.schemaVersion !== SEMANTIFY_SCHEMA_VERSION) {
    diagnostics.push({
      severity: 'error',
      message: `Unsupported adapter schema version: ${adapterOutput.schemaVersion}`,
      adapterId: adapterOutput.adapterId,
    });
  }

  for (const node of adapterOutput.nodes) {
    if (node.sourceSpan.endOffset < node.sourceSpan.startOffset) {
      diagnostics.push({
        severity: 'error',
        message: `Adapter node ${node.kind} has an invalid source span.`,
        adapterId: adapterOutput.adapterId,
        sourceNodeKind: node.kind,
        span: node.sourceSpan,
      });
    }
  }

  return diagnostics;
}

function defaultProject(sourceNode: AdapterNode, context: ProjectionRuleContext): ProjectionEntity[] {
  return [
    {
      type: 'node',
      node: context.createNode({
        sourceNode,
      }),
    },
  ];
}

function compareNodes(left: SemanticGraphNode, right: SemanticGraphNode): number {
  return (
    left.id.localeCompare(right.id) ||
    left.profileId.localeCompare(right.profileId) ||
    left.kind.localeCompare(right.kind)
  );
}

function compareEdges(left: SemanticGraphEdge, right: SemanticGraphEdge): number {
  return (
    left.id.localeCompare(right.id) ||
    left.profileId.localeCompare(right.profileId) ||
    left.from.localeCompare(right.from) ||
    left.to.localeCompare(right.to) ||
    left.kind.localeCompare(right.kind)
  );
}

export class SemantifyProjectionRuntime {
  private readonly rules = new Map<string, TypedProjectionRule>();

  constructor(options: ProjectionRuntimeOptions = {}) {
    for (const rule of options.rules ?? []) {
      this.rules.set(rule.ruleId, rule);
    }
  }

  project(input: ProjectionRuntimeInput): ProjectionResult {
    const diagnostics = [
      ...validateAdapterOutput(input.adapterOutput),
      ...(input.adapterOutput.diagnostics ?? []),
    ];
    const nodes: SemanticGraphNode[] = [];
    const edges: SemanticGraphEdge[] = [];
    const sortedSourceNodes = [...input.adapterOutput.nodes].sort((left, right) =>
      getNodeOrderKey(left).localeCompare(getNodeOrderKey(right))
    );
    const sortedRules = [...input.profile.projectionRules].sort((left, right) =>
      left.id.localeCompare(right.id)
    );

    for (const sourceNode of sortedSourceNodes) {
      for (const rule of sortedRules) {
        if (rule.sourceNodeKind !== sourceNode.kind) {
          continue;
        }

        const context = createRuleContext({
          adapterOutput: input.adapterOutput,
          profile: input.profile,
          rule,
        });
        const entities = this.rules.get(rule.id)?.project(sourceNode, context) ?? defaultProject(sourceNode, context);
        for (const entity of entities) {
          if (entity.type === 'node') {
            nodes.push(entity.node);
          } else {
            edges.push(entity.edge);
          }
        }
      }
    }

    nodes.sort(compareNodes);
    edges.sort(compareEdges);

    const provenance = [
      ...nodes.map((node) => node.provenance).filter((item): item is SemanticGraphProvenance => !!item),
      ...edges.map((edge) => edge.provenance).filter((item): item is SemanticGraphProvenance => !!item),
    ].sort((left, right) => left.targetId.localeCompare(right.targetId));

    return {
      schemaVersion: SEMANTIFY_SCHEMA_VERSION,
      graph: {
        version: GRAPH_CONTRACT_VERSION,
        revision: 1,
        nodes,
        edges,
      },
      diagnostics,
      provenance,
    };
  }
}

export function createProjectionRuntime(
  options: ProjectionRuntimeOptions = {}
): SemantifyProjectionRuntime {
  return new SemantifyProjectionRuntime(options);
}

export function projectSemanticGraph(
  input: ProjectionRuntimeInput,
  options: ProjectionRuntimeOptions = {}
): ProjectionResult {
  return createProjectionRuntime(options).project(input);
}

export const semantifyProjectionTesting = {
  stableSerialize,
  toJsonObject,
};
