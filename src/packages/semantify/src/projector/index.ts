import type {
  AdapterNode,
  AdapterOutput,
  DiagnosticSeverity,
  ProfileHelperExtension,
  SemanticDiagnosticRecord,
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
import { satisfies, valid } from 'semver';

const SEMANTIFY_SCHEMA_VERSION: SemantifySchemaVersion = '1.0.0';
const GRAPH_CONTRACT_VERSION = 'v1' as const;
const DIAGNOSTIC_SEVERITY_ERROR: DiagnosticSeverity = 1;
const VALID_HELPER_KINDS = new Set([
  'candidate-provider',
  'definition-resolver',
  'hover-renderer',
  'diagnostic-provider',
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

function validateAdapterOutput(adapterOutput: AdapterOutput): SemanticDiagnosticRecord[] {
  const diagnostics: SemanticDiagnosticRecord[] = [];

  if (adapterOutput.schemaVersion !== SEMANTIFY_SCHEMA_VERSION) {
    diagnostics.push({
      severity: DIAGNOSTIC_SEVERITY_ERROR,
      message: `Unsupported adapter schema version: ${adapterOutput.schemaVersion}`,
      adapterId: adapterOutput.adapterId,
    });
  }

  for (const node of adapterOutput.nodes) {
    if (node.sourceSpan.endOffset < node.sourceSpan.startOffset) {
      diagnostics.push({
        severity: DIAGNOSTIC_SEVERITY_ERROR,
        message: `Adapter node ${node.kind} has an invalid source span.`,
        adapterId: adapterOutput.adapterId,
        sourceNodeKind: node.kind,
        span: node.sourceSpan,
      });
    }
  }

  return diagnostics;
}

function validateProfileDefinition(profile: ProfileDefinition): SemanticDiagnosticRecord[] {
  const diagnostics: SemanticDiagnosticRecord[] = [];

  if (profile.schemaVersion !== SEMANTIFY_SCHEMA_VERSION) {
    diagnostics.push({
      severity: DIAGNOSTIC_SEVERITY_ERROR,
      message: `Unsupported profile schema version: ${profile.schemaVersion}`,
    });
  }

  const semanticKinds = new Set<string>();
  for (const semanticKind of profile.semanticKinds) {
    if (!semanticKind.kind) {
      diagnostics.push({
        severity: DIAGNOSTIC_SEVERITY_ERROR,
        message: 'Profile semantic kinds must include a non-empty kind value.',
      });
      continue;
    }

    if (semanticKinds.has(semanticKind.kind)) {
      diagnostics.push({
        severity: DIAGNOSTIC_SEVERITY_ERROR,
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
        severity: DIAGNOSTIC_SEVERITY_ERROR,
        message: `Projection rule ${rule.id} has unsupported schema version ${rule.schemaVersion}.`,
        projectionRuleId: rule.id,
      });
    }

    if (!rule.transformationSteps.length) {
      diagnostics.push({
        severity: DIAGNOSTIC_SEVERITY_ERROR,
        message: `Projection rule ${rule.id} must declare at least one transformation step.`,
        projectionRuleId: rule.id,
      });
    }

    if (ruleIds.has(rule.id)) {
      diagnostics.push({
        severity: DIAGNOSTIC_SEVERITY_ERROR,
        message: `Duplicate projection rule id: ${rule.id}`,
        projectionRuleId: rule.id,
      });
    }
    ruleIds.add(rule.id);

    if (!semanticKinds.has(rule.targetSemanticKind)) {
      diagnostics.push({
        severity: DIAGNOSTIC_SEVERITY_ERROR,
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
): SemanticDiagnosticRecord[] {
  const diagnostics: SemanticDiagnosticRecord[] = [];

  if (helper.schemaVersion !== SEMANTIFY_SCHEMA_VERSION) {
    diagnostics.push({
      severity: DIAGNOSTIC_SEVERITY_ERROR,
      message: `Helper extension ${helper.id} has unsupported schema version ${helper.schemaVersion}.`,
    });
  }

  if (!VALID_HELPER_KINDS.has(helper.kind)) {
    diagnostics.push({
      severity: DIAGNOSTIC_SEVERITY_ERROR,
      message: `Helper extension ${helper.id} has unsupported kind ${String(helper.kind)}.`,
    });
  }

  if (!helper.consumesSemanticKinds.length) {
    diagnostics.push({
      severity: DIAGNOSTIC_SEVERITY_ERROR,
      message: `Helper extension ${helper.id} must consume at least one semantic kind.`,
    });
  }

  for (const kind of helper.consumesSemanticKinds) {
    if (!semanticKinds.has(kind)) {
      diagnostics.push({
        severity: DIAGNOSTIC_SEVERITY_ERROR,
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
          severity: DIAGNOSTIC_SEVERITY_ERROR,
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
): SemanticDiagnosticRecord[] {
  const diagnostics: SemanticDiagnosticRecord[] = [];
  const adapterManifest = profile.defaultAdapters?.find(
    (entry) => entry.adapterId === adapterOutput.adapterId
  );

  if (profile.defaultAdapters?.length && !adapterManifest) {
    diagnostics.push({
      severity: DIAGNOSTIC_SEVERITY_ERROR,
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

    const validVersion = valid(version);
    if (!validVersion) {
      return false;
    }

    try {
      return satisfies(validVersion, range);
    } catch {
      return false;
    }
  })();

  if (!isVersionCompatible) {
    diagnostics.push({
      severity: DIAGNOSTIC_SEVERITY_ERROR,
      message: `Adapter ${adapterOutput.adapterId} version ${adapterOutput.adapterVersion} does not satisfy profile adapterVersionRange ${adapterManifest.adapterVersionRange}.`,
      adapterId: adapterOutput.adapterId,
    });
  }

  const allowedNodeKinds = new Set(adapterManifest.sourceNodeKinds);
  for (const node of adapterOutput.nodes) {
    if (!allowedNodeKinds.has(node.kind)) {
      diagnostics.push({
        severity: DIAGNOSTIC_SEVERITY_ERROR,
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
): SemanticDiagnosticRecord[] {
  const diagnostics: SemanticDiagnosticRecord[] = [];
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
          severity: DIAGNOSTIC_SEVERITY_ERROR,
          message: `Node ${node.id} (${node.kind}) consumed by helper ${helper.id} is missing provenance.`,
          sourceNodeKind: node.kind,
        });
        continue;
      }

      if (requiresSourceSpan && !node.provenance.sourceSpan) {
        diagnostics.push({
          severity: DIAGNOSTIC_SEVERITY_ERROR,
          message: `Node ${node.id} (${node.kind}) consumed by helper ${helper.id} is missing provenance sourceSpan.`,
          sourceNodeKind: node.kind,
        });
      }

      if (requiresProfileVersion && !node.provenance.attributes?.profileVersion) {
        diagnostics.push({
          severity: DIAGNOSTIC_SEVERITY_ERROR,
          message: `Node ${node.id} (${node.kind}) consumed by helper ${helper.id} is missing provenance attribute profileVersion.`,
          sourceNodeKind: node.kind,
        });
      }

      if (requiresSourceNodeKind && !node.provenance.attributes?.sourceNodeKind) {
        diagnostics.push({
          severity: DIAGNOSTIC_SEVERITY_ERROR,
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

function compareProvenance(left: SemanticGraphProvenance, right: SemanticGraphProvenance): number {
  return (
    left.targetId.localeCompare(right.targetId) ||
    stableSerialize(left).localeCompare(stableSerialize(right))
  );
}

function normalizeSyntaxDiagnosticPhase(phase: unknown): 'lexical' | 'parse' | 'semantic' {
  if (phase === 'lexical' || phase === 'parse' || phase === 'semantic') {
    return phase;
  }
  return 'semantic';
}

function mapSyntaxDiagnosticsToSemantic(adapterOutput: AdapterOutput): SemanticDiagnosticRecord[] {
  return (adapterOutput.diagnostics ?? []).map((diagnostic) => ({
    severity: diagnostic.severity,
    message: diagnostic.message,
    phase: normalizeSyntaxDiagnosticPhase((diagnostic as { phase?: unknown }).phase),
    origin: 'syntax',
    adapterId: adapterOutput.adapterId,
    ...(diagnostic.span ? { span: diagnostic.span } : {}),
    ...(diagnostic.metadata ? { metadata: diagnostic.metadata } : {}),
  }));
}

function normalizeSemanticDiagnostic(
  diagnostic: SemanticDiagnosticRecord
): SemanticDiagnosticRecord {
  return {
    ...diagnostic,
    phase: diagnostic.phase ?? 'projection',
    origin: diagnostic.origin ?? 'runtime',
  };
}

function collectStrictModeDiagnostics(input: {
  nodes: SemanticGraphNode[];
  edges: SemanticGraphEdge[];
  provenance: SemanticGraphProvenance[];
}): SemanticDiagnosticRecord[] {
  const diagnostics: SemanticDiagnosticRecord[] = [];
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  const provenanceTargetIds = new Set<string>();
  const entityIds = new Set<string>();

  for (let index = 1; index < input.nodes.length; index += 1) {
    if (
      compareNodes(
        input.nodes[index - 1] as SemanticGraphNode,
        input.nodes[index] as SemanticGraphNode
      ) > 0
    ) {
      diagnostics.push({
        severity: DIAGNOSTIC_SEVERITY_ERROR,
        message: 'Strict mode requires graph nodes to be deterministically sorted.',
      });
      break;
    }
  }

  for (let index = 1; index < input.edges.length; index += 1) {
    if (
      compareEdges(
        input.edges[index - 1] as SemanticGraphEdge,
        input.edges[index] as SemanticGraphEdge
      ) > 0
    ) {
      diagnostics.push({
        severity: DIAGNOSTIC_SEVERITY_ERROR,
        message: 'Strict mode requires graph edges to be deterministically sorted.',
      });
      break;
    }
  }

  for (let index = 1; index < input.provenance.length; index += 1) {
    if (
      compareProvenance(
        input.provenance[index - 1] as SemanticGraphProvenance,
        input.provenance[index] as SemanticGraphProvenance
      ) > 0
    ) {
      diagnostics.push({
        severity: DIAGNOSTIC_SEVERITY_ERROR,
        message: 'Strict mode requires provenance to be deterministically sorted by target id.',
      });
      break;
    }
  }

  for (const node of input.nodes) {
    entityIds.add(node.id);
    if (nodeIds.has(node.id)) {
      diagnostics.push({
        severity: DIAGNOSTIC_SEVERITY_ERROR,
        message: `Strict mode detected duplicate node id ${node.id}.`,
        sourceNodeKind: node.kind,
      });
    }
    nodeIds.add(node.id);

    if (!node.provenance) {
      diagnostics.push({
        severity: DIAGNOSTIC_SEVERITY_ERROR,
        message: `Strict mode requires provenance for node ${node.id}.`,
        sourceNodeKind: node.kind,
      });
    } else if (node.provenance.targetId !== node.id) {
      diagnostics.push({
        severity: DIAGNOSTIC_SEVERITY_ERROR,
        message: `Strict mode requires node provenance targetId ${node.provenance.targetId} to match node id ${node.id}.`,
        sourceNodeKind: node.kind,
      });
    }
  }

  for (const edge of input.edges) {
    entityIds.add(edge.id);
    if (edgeIds.has(edge.id)) {
      diagnostics.push({
        severity: DIAGNOSTIC_SEVERITY_ERROR,
        message: `Strict mode detected duplicate edge id ${edge.id}.`,
      });
    }
    edgeIds.add(edge.id);

    if (!edge.provenance) {
      diagnostics.push({
        severity: DIAGNOSTIC_SEVERITY_ERROR,
        message: `Strict mode requires provenance for edge ${edge.id}.`,
      });
    } else if (edge.provenance.targetId !== edge.id) {
      diagnostics.push({
        severity: DIAGNOSTIC_SEVERITY_ERROR,
        message: `Strict mode requires edge provenance targetId ${edge.provenance.targetId} to match edge id ${edge.id}.`,
      });
    }
  }

  for (const item of input.provenance) {
    if (provenanceTargetIds.has(item.targetId)) {
      diagnostics.push({
        severity: DIAGNOSTIC_SEVERITY_ERROR,
        message: `Strict mode detected duplicate provenance target ${item.targetId}.`,
      });
    }
    provenanceTargetIds.add(item.targetId);

    if (!entityIds.has(item.targetId)) {
      diagnostics.push({
        severity: DIAGNOSTIC_SEVERITY_ERROR,
        message: `Strict mode found provenance target ${item.targetId} with no matching graph entity.`,
      });
    }

    if (!item.providerId || !item.providerVersion || !item.sourceDocId || !item.projectionRuleId) {
      diagnostics.push({
        severity: DIAGNOSTIC_SEVERITY_ERROR,
        message: `Strict mode requires providerId, providerVersion, sourceDocId, and projectionRuleId for provenance target ${item.targetId}.`,
      });
    }

    if (!item.sourceSpan || item.sourceSpan.endOffset < item.sourceSpan.startOffset) {
      diagnostics.push({
        severity: DIAGNOSTIC_SEVERITY_ERROR,
        message: `Strict mode requires a valid sourceSpan for provenance target ${item.targetId}.`,
      });
    }

    if (!item.attributes?.profileVersion || !item.attributes?.sourceNodeKind) {
      diagnostics.push({
        severity: DIAGNOSTIC_SEVERITY_ERROR,
        message: `Strict mode requires provenance attributes profileVersion and sourceNodeKind for target ${item.targetId}.`,
      });
    }
  }

  if (provenanceTargetIds.size !== entityIds.size) {
    diagnostics.push({
      severity: DIAGNOSTIC_SEVERITY_ERROR,
      message: `Strict mode requires provenance coverage for every graph entity (entities=${entityIds.size}, provenance=${provenanceTargetIds.size}).`,
    });
  }

  return diagnostics.map(normalizeSemanticDiagnostic);
}

export class SemantifyProjectionRuntime {
  private readonly rules = new Map<string, TypedProjectionRule>();

  private readonly strictMode: boolean;

  constructor(options: ProjectionRuntimeOptions = {}) {
    for (const rule of options.rules ?? []) {
      this.rules.set(rule.ruleId, rule);
    }
    this.strictMode = options.strictMode ?? false;
  }

  project(input: ProjectionRuntimeInput): ProjectionResult {
    const diagnostics = [
      ...validateAdapterOutput(input.adapterOutput),
      ...validateProfileDefinition(input.profile),
      ...validateAdapterProfileCompatibility(input.adapterOutput, input.profile),
      ...mapSyntaxDiagnosticsToSemantic(input.adapterOutput),
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
    ].sort(compareProvenance);

    diagnostics.push(...validateProvenanceContracts(input.profile, nodes));

    if (this.strictMode) {
      const strictDiagnostics = collectStrictModeDiagnostics({ nodes, edges, provenance });
      diagnostics.push(...strictDiagnostics);
      const strictErrors = strictDiagnostics.filter(
        (diagnostic) => diagnostic.severity === DIAGNOSTIC_SEVERITY_ERROR
      );
      if (strictErrors.length > 0) {
        throw new Error(
          `Semantify strict mode validation failed: ${strictErrors
            .map((diagnostic) => diagnostic.message)
            .join(' | ')}`
        );
      }
    }

    return {
      schemaVersion: SEMANTIFY_SCHEMA_VERSION,
      graph: {
        version: GRAPH_CONTRACT_VERSION,
        revision: 1,
        nodes,
        edges,
      },
      diagnostics: diagnostics.map(normalizeSemanticDiagnostic),
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
  collectStrictModeDiagnostics,
};
