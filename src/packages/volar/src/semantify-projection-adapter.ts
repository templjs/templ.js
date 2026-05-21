import type { Edge, Node, Snapshot } from '@templjs/context-graph';
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
  schemaText?: string;
  contentSchema?: object;
  contentSchemaText?: string;
  delimiters?: DelimiterConfigInput;
}

function mergeSnapshots(snapshots: Snapshot[]): Snapshot {
  const nodes = new Map<string, Node>();
  const edges = new Map<string, Edge>();

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
): Snapshot {
  const profile = createTempljsAuthoringProfile();
  const sourceDocId = options.documentUri ?? 'templjs:anonymous';
  const snapshots: Snapshot[] = [
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
          schemaText: options.schemaText,
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
          schemaText: options.contentSchema ? options.contentSchemaText : options.schemaText,
          contextBlock: 'content',
        }),
        profile,
      }).graph
    );
  }

  return mergeSnapshots(snapshots);
}
