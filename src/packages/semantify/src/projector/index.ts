import type {
  AdapterNode,
  AdapterOutput,
  ProfileHelperExtension,
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
const VALID_HELPER_KINDS = new Set([
  'candidate-provider',
  'definition-resolver',
  'hover-renderer',
  'diagnostic-planner',
  'semantic-token-provider',
  'formatting-orchestrator',
]);

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
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
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
  profile: ProfileDefinition;
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
      profileVersion: input.profile.version,
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
          profile: input.profile,
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
          profile: input.profile,
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

function validateProfileDefinition(profile: ProfileDefinition): ProjectionDiagnostic[] {
  const diagnostics: ProjectionDiagnostic[] = [];

  if (profile.schemaVersion !== SEMANTIFY_SCHEMA_VERSION) {
    diagnostics.push({
      severity: 'error',
      message: `Unsupported profile schema version: ${profile.schemaVersion}`,
    });
  }

  const semanticKinds = new Set<string>();
  for (const semanticKind of profile.semanticKinds) {
    if (!semanticKind.kind) {
      diagnostics.push({
        severity: 'error',
        message: 'Profile semantic kinds must include a non-empty kind value.',
      });
      continue;
    }

    if (semanticKinds.has(semanticKind.kind)) {
      diagnostics.push({
        severity: 'error',
        message: `Duplicate semantic kind definition: ${semanticKind.kind}`,
      });
      continue;
    }

    semanticKinds.add(semanticKind.kind);
  }

  const ruleIds = new Set<string>();
  for (const rule of profile.projectionRules) {
    if (rule.schemaVersion !== SEMANTIFY_SCHEMA_VERSION) {
      diagnostics.push({
        severity: 'error',
        message: `Projection rule ${rule.id} has unsupported schema version ${rule.schemaVersion}.`,
        projectionRuleId: rule.id,
      });
    }

    if (!rule.transformationSteps.length) {
      diagnostics.push({
        severity: 'error',
        message: `Projection rule ${rule.id} must declare at least one transformation step.`,
        projectionRuleId: rule.id,
      });
    }

    if (ruleIds.has(rule.id)) {
      diagnostics.push({
        severity: 'error',
        message: `Duplicate projection rule id: ${rule.id}`,
        projectionRuleId: rule.id,
      });
    }
    ruleIds.add(rule.id);

    if (!semanticKinds.has(rule.targetSemanticKind)) {
      diagnostics.push({
        severity: 'error',
        message: `Projection rule ${rule.id} targets unknown semantic kind ${rule.targetSemanticKind}.`,
        projectionRuleId: rule.id,
      });
    }
  }

  for (const helper of profile.helperExtensions ?? []) {
    diagnostics.push(...validateHelperExtension(profile, helper, semanticKinds));
  }

  return diagnostics;
}

function validateHelperExtension(
  profile: ProfileDefinition,
  helper: ProfileHelperExtension,
  semanticKinds: Set<string>
): ProjectionDiagnostic[] {
  const diagnostics: ProjectionDiagnostic[] = [];

  if (helper.schemaVersion !== SEMANTIFY_SCHEMA_VERSION) {
    diagnostics.push({
      severity: 'error',
      message: `Helper extension ${helper.id} has unsupported schema version ${helper.schemaVersion}.`,
    });
  }

  if (!VALID_HELPER_KINDS.has(helper.kind)) {
    diagnostics.push({
      severity: 'error',
      message: `Helper extension ${helper.id} has unsupported kind ${String(helper.kind)}.`,
    });
  }

  if (!helper.consumesSemanticKinds.length) {
    diagnostics.push({
      severity: 'error',
      message: `Helper extension ${helper.id} must consume at least one semantic kind.`,
    });
  }

  for (const kind of helper.consumesSemanticKinds) {
    if (!semanticKinds.has(kind)) {
      diagnostics.push({
        severity: 'error',
        message: `Helper extension ${helper.id} consumes unknown semantic kind ${kind}.`,
      });
    }
  }

  if (
    helper.provenance?.requireSourceSpan ||
    helper.provenance?.requireProfileVersionAttribute ||
    helper.provenance?.requireSourceNodeKindAttribute
  ) {
    const profileKinds = new Set(profile.semanticKinds.map((item) => item.kind));
    for (const consumedKind of helper.consumesSemanticKinds) {
      if (!profileKinds.has(consumedKind)) {
        diagnostics.push({
          severity: 'error',
          message: `Helper extension ${helper.id} declares provenance requirements for unknown semantic kind ${consumedKind}.`,
        });
      }
    }
  }

  return diagnostics;
}

function validateAdapterProfileCompatibility(
  adapterOutput: AdapterOutput,
  profile: ProfileDefinition
): ProjectionDiagnostic[] {
  const diagnostics: ProjectionDiagnostic[] = [];
  const adapterManifest = profile.defaultAdapters?.find(
    (entry) => entry.adapterId === adapterOutput.adapterId
  );

  if (profile.defaultAdapters?.length && !adapterManifest) {
    diagnostics.push({
      severity: 'error',
      message: `Profile ${profile.id} does not declare adapter ${adapterOutput.adapterId} in defaultAdapters.`,
      adapterId: adapterOutput.adapterId,
    });
    return diagnostics;
  }

  if (!adapterManifest) {
    return diagnostics;
  }

  const isVersionCompatible = (() => {
    const range = adapterManifest.adapterVersionRange.trim();
    const version = adapterOutput.adapterVersion.trim();

    if (!range || !version) {
      return false;
    }

    if (range.startsWith('^')) {
      const expectedMajor = Number.parseInt(range.slice(1).split('.')[0] ?? '', 10);
      const actualMajor = Number.parseInt(version.split('.')[0] ?? '', 10);
      return (
        Number.isFinite(expectedMajor) &&
        Number.isFinite(actualMajor) &&
        expectedMajor === actualMajor
      );
    }

    return range === version;
  })();

  if (!isVersionCompatible) {
    diagnostics.push({
      severity: 'error',
      message: `Adapter ${adapterOutput.adapterId} version ${adapterOutput.adapterVersion} does not satisfy profile adapterVersionRange ${adapterManifest.adapterVersionRange}.`,
      adapterId: adapterOutput.adapterId,
    });
  }

  const allowedNodeKinds = new Set(adapterManifest.sourceNodeKinds);
  for (const node of adapterOutput.nodes) {
    if (!allowedNodeKinds.has(node.kind)) {
      diagnostics.push({
        severity: 'error',
        message: `Adapter node kind ${node.kind} is not allowed by profile adapter manifest for ${adapterOutput.adapterId}.`,
        adapterId: adapterOutput.adapterId,
        sourceNodeKind: node.kind,
      });
    }
  }

  return diagnostics;
}

function validateProvenanceContracts(
  profile: ProfileDefinition,
  nodes: SemanticGraphNode[]
): ProjectionDiagnostic[] {
  const diagnostics: ProjectionDiagnostic[] = [];
  const helpers = profile.helperExtensions ?? [];

  for (const helper of helpers) {
    const requiresSourceSpan = helper.provenance?.requireSourceSpan ?? true;
    const requiresProfileVersion = helper.provenance?.requireProfileVersionAttribute ?? true;
    const requiresSourceNodeKind = helper.provenance?.requireSourceNodeKindAttribute ?? true;
    const consumedKinds = new Set(helper.consumesSemanticKinds);

    for (const node of nodes) {
      if (!consumedKinds.has(node.kind)) {
        continue;
      }

      if (!node.provenance) {
        diagnostics.push({
          severity: 'error',
          message: `Node ${node.id} (${node.kind}) consumed by helper ${helper.id} is missing provenance.`,
          sourceNodeKind: node.kind,
        });
        continue;
      }

      if (requiresSourceSpan && !node.provenance.sourceSpan) {
        diagnostics.push({
          severity: 'error',
          message: `Node ${node.id} (${node.kind}) consumed by helper ${helper.id} is missing provenance sourceSpan.`,
          sourceNodeKind: node.kind,
        });
      }

      if (requiresProfileVersion && !node.provenance.attributes?.profileVersion) {
        diagnostics.push({
          severity: 'error',
          message: `Node ${node.id} (${node.kind}) consumed by helper ${helper.id} is missing provenance attribute profileVersion.`,
          sourceNodeKind: node.kind,
        });
      }

      if (requiresSourceNodeKind && !node.provenance.attributes?.sourceNodeKind) {
        diagnostics.push({
          severity: 'error',
          message: `Node ${node.id} (${node.kind}) consumed by helper ${helper.id} is missing provenance attribute sourceNodeKind.`,
          sourceNodeKind: node.kind,
        });
      }
    }
  }

  return diagnostics;
}

function defaultProject(
  sourceNode: AdapterNode,
  context: ProjectionRuleContext
): ProjectionEntity[] {
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
      ...validateProfileDefinition(input.profile),
      ...validateAdapterProfileCompatibility(input.adapterOutput, input.profile),
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
        const entities =
          this.rules.get(rule.id)?.project(sourceNode, context) ??
          defaultProject(sourceNode, context);
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
      ...nodes
        .map((node) => node.provenance)
        .filter((item): item is SemanticGraphProvenance => !!item),
      ...edges
        .map((edge) => edge.provenance)
        .filter((item): item is SemanticGraphProvenance => !!item),
    ].sort((left, right) => left.targetId.localeCompare(right.targetId));

    diagnostics.push(...validateProvenanceContracts(input.profile, nodes));

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
