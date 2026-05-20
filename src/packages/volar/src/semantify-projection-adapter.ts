import type { ContextEdge, ContextNode, GraphSnapshot } from '@templjs/context-graph';
import type { JSONSchema } from '@templjs/core';
import {
  createTempljsAuthoringProfile,
  createTempljsSchemaAdapterOutput,
  createTempljsTemplateAdapterOutput,
  projectSemanticGraph,
  type DelimiterConfigInput,
} from '@templjs/semantify';

export interface SemantifyProjectionSnapshotOptions {
  text: string;
  documentUri?: string;
  schema?: object;
  contentSchema?: object;
  delimiters?: DelimiterConfigInput;
}

function mergeSnapshots(snapshots: GraphSnapshot[]): GraphSnapshot {
  const nodes = new Map<string, ContextNode>();
  const edges = new Map<string, ContextEdge>();

  for (const snapshot of snapshots) {
    for (const node of snapshot.nodes) {
      nodes.set(node.id, node);
    }
    for (const edge of snapshot.edges) {
      edges.set(edge.id, edge);
    }
  }

  return {
    version: 'v1',
    revision: snapshots.reduce((max, snapshot) => Math.max(max, snapshot.revision), 0),
    nodes: [...nodes.values()].sort((left, right) => left.id.localeCompare(right.id)),
    edges: [...edges.values()].sort((left, right) => left.id.localeCompare(right.id)),
  };
}

export function createSemantifyProjectionSnapshot(
  options: SemantifyProjectionSnapshotOptions
): GraphSnapshot {
  const profile = createTempljsAuthoringProfile();
  const sourceDocId = options.documentUri ?? 'templjs:anonymous';
  const snapshots: GraphSnapshot[] = [
    projectSemanticGraph({
      adapterOutput: createTempljsTemplateAdapterOutput({
        text: options.text,
        sourceDocId,
        sourceUri: options.documentUri,
        delimiters: options.delimiters,
      }),
      profile,
    }).graph,
  ];

  if (options.schema) {
    snapshots.push(
      projectSemanticGraph({
        adapterOutput: createTempljsSchemaAdapterOutput({
          schema: options.schema as JSONSchema,
          sourceDocId,
          sourceUri: options.documentUri,
          contextBlock: 'frontmatter',
        }),
        profile,
      }).graph
    );
  }

  if (options.contentSchema ?? options.schema) {
    snapshots.push(
      projectSemanticGraph({
        adapterOutput: createTempljsSchemaAdapterOutput({
          schema: (options.contentSchema ?? options.schema) as JSONSchema,
          sourceDocId,
          sourceUri: options.documentUri,
          contextBlock: 'content',
        }),
        profile,
      }).graph
    );
  }

  return mergeSnapshots(snapshots);
}
