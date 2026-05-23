import { getSemanticProfileId, type SemanticZoneSegment } from '@templjs/core';
import type {
  Node,
  Snapshot,
  JsonPrimitive,
  QueryRequest,
  QueryResponse,
} from '@templjs/context-graph';
import { getSharedSchemaMetadata } from './context-graph-schema.js';
import type { SemanticQueryContext, SemanticSchemaReadOptions } from './context-graph-adapter.js';

export type QueryAttributes = Readonly<Record<string, JsonPrimitive>>;

export function stableSerialize(value: unknown): string {
  const visited = new WeakSet<object>();

  const normalize = (input: unknown): unknown => {
    if (input === null || typeof input !== 'object') {
      return input;
    }

    if (visited.has(input)) {
      return '[Circular]';
    }
    visited.add(input);

    if (Array.isArray(input)) {
      return input.map((item) => normalize(item));
    }

    const record = input as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      result[key] = normalize(record[key]);
    }
    return result;
  };

  const serialized = JSON.stringify(normalize(value));
  return serialized ?? 'undefined';
}

let nextSnapshotSchemaId = 1;
const snapshotSchemaIdMap = new WeakMap<object, number>();
const snapshotSchemaHashBySerialized = new Map<string, string>();

export function hashStringFNV1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function getSnapshotSchemaToken(schema: unknown): string {
  if (schema && typeof schema === 'object') {
    const existingId = snapshotSchemaIdMap.get(schema);
    if (existingId !== undefined) {
      return `id:${existingId}`;
    }

    const assignedId = nextSnapshotSchemaId;
    nextSnapshotSchemaId += 1;
    snapshotSchemaIdMap.set(schema, assignedId);
    return `id:${assignedId}`;
  }

  const serialized = stableSerialize(schema);
  const existingHash = snapshotSchemaHashBySerialized.get(serialized);
  if (existingHash !== undefined) {
    return `hash:${existingHash}`;
  }

  const computedHash = hashStringFNV1a(serialized);
  snapshotSchemaHashBySerialized.set(serialized, computedHash);
  return `hash:${computedHash}`;
}

export function buildSnapshotCacheKey(options: {
  schema?: object;
  contentSchema?: object;
  contentSchemaUri?: string;
}): string {
  const frontmatterHash = getSnapshotSchemaToken(options.schema);
  const contentOrFallbackSchema = options.contentSchema ?? options.schema;
  const contentHash = getSnapshotSchemaToken(contentOrFallbackSchema);
  const uriSuffix = options.contentSchemaUri ? `::${options.contentSchemaUri}` : '';
  return `${frontmatterHash}::${contentHash}${uriSuffix}`;
}

export function getParentPath(path: string): string {
  const lastDot = path.lastIndexOf('.');
  return lastDot === -1 ? '' : path.slice(0, lastDot);
}

export function getLabel(path: string): string {
  const lastDot = path.lastIndexOf('.');
  const label = lastDot === -1 ? path : path.slice(lastDot + 1);
  return label.replace(/\[[^\]]+\]/g, '');
}

export function resolveProfileId(context: SemanticQueryContext): string {
  const zoneSegment =
    context.zoneSegment ?? (context.contextBlock === 'frontmatter' ? 'metadata' : 'content');
  return context.semanticZone?.profileId ?? context.profileId ?? getSemanticProfileId(zoneSegment);
}

export function resolveZoneKind(context: SemanticQueryContext): 'metadata' | 'content' {
  const zoneSegment =
    context.zoneSegment ?? (context.contextBlock === 'frontmatter' ? 'metadata' : 'content');
  return context.semanticZone?.kind ?? (zoneSegment === 'metadata' ? 'metadata' : 'content');
}

export function resolveSchemaUriForContext(
  context: SemanticQueryContext,
  options: Pick<SemanticSchemaReadOptions, 'schemaUri' | 'contentSchemaUri'>
): string | undefined {
  return resolveZoneKind(context) === 'metadata'
    ? options.schemaUri
    : (options.contentSchemaUri ?? options.schemaUri);
}

export function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function buildPathNodes(zoneSegment: SemanticZoneSegment, schema?: object): Node[] {
  if (!schema) {
    return [];
  }

  const profileId = getSemanticProfileId(zoneSegment);
  const contextBlock = zoneSegment === 'metadata' ? 'frontmatter' : 'content';

  const metadata = getSharedSchemaMetadata(schema);
  const nodes: Node[] = [];

  for (const [path, entry] of Object.entries(metadata)) {
    nodes.push({
      id: `${profileId}:schema-path:${path}`,
      profileId,
      kind: 'templjs.schema-path',
      attributes: {
        path,
        parentPath: getParentPath(path),
        label: getLabel(path),
        type: entry.type,
        description: entry.description ?? '',
        zoneSegment,
        contextBlock,
        isTopLevel: getParentPath(path) === '',
        isDirectProperty: !path.includes('.') && !path.includes('['),
      },
    });
  }

  const walkSchema = (node: unknown, currentPath = ''): void => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      return;
    }

    const record = node as Record<string, unknown>;
    if (currentPath && Array.isArray(record.enum)) {
      for (const value of record.enum) {
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          nodes.push({
            id: `${profileId}:schema-enum:${currentPath}:${String(value)}`,
            profileId,
            kind: 'templjs.schema-enum-value',
            attributes: {
              path: currentPath,
              value,
              label: String(value),
              zoneSegment,
              contextBlock,
            },
          });
        }
      }
    }

    const properties = record.properties;
    if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
      return;
    }

    for (const [key, child] of Object.entries(properties as Record<string, unknown>)) {
      walkSchema(child, currentPath ? `${currentPath}.${key}` : key);
    }
  };

  walkSchema(schema);
  return nodes;
}

export function filterNodes(snapshot: Snapshot, request: QueryRequest): Node[] {
  return snapshot.nodes.filter((node: Node) => {
    if (request.nodes?.kind && node.kind !== request.nodes.kind) {
      return false;
    }

    if (request.nodes?.profileIds && !request.nodes.profileIds.includes(node.profileId)) {
      return false;
    }

    if (request.nodes?.attributeEquals) {
      const attributes = node.attributes ?? {};
      for (const [key, value] of Object.entries(request.nodes.attributeEquals)) {
        if (attributes[key] !== value) {
          return false;
        }
      }
    }

    return true;
  });
}

export function querySnapshot(snapshot: Snapshot, request: QueryRequest): QueryResponse {
  return {
    version: request.version,
    revision: snapshot.revision,
    nodes: filterNodes(snapshot, request).sort((left: Node, right: Node) =>
      left.id.localeCompare(right.id)
    ),
    edges: [],
  };
}

/** @internal */
export const contextGraphSnapshotTesting = {
  stableSerialize,
};
