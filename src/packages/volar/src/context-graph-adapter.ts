import {
  extractTemplateBindings,
  getTemplateBindingsAtOffset,
  type SemanticContextBlock,
  type SemanticOperation,
  type SemanticZone,
  type TemplateBinding,
} from '@templjs/core';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import type {
  Node,
  Snapshot,
  JsonPrimitive,
  QueryRequest,
  QueryResponse,
} from '@templjs/context-graph';
import { getSharedSchemaMetadata } from './context-graph-schema.js';
import {
  contextGraphDefinitionResolutionTesting,
  decodeJsonPointerSegment,
  findBestPropertyOffset,
  getPathValueDefinition,
  getPositionForOffset,
  getSchemaPathDefinition,
  resolvePathDefinitionAcrossRefs,
  resolveRefTargetUri,
  toDefinitionTarget,
  type DefinitionResolutionOptions,
  type DefinitionTarget,
  type SchemaPathDetails,
} from './context-graph-definition-resolution.js';
import {
  asNonEmptyString,
  asString,
  buildSnapshotCacheKey,
  contextGraphSnapshotTesting,
  querySnapshot,
  resolveProfileId,
  resolveSchemaUriForContext,
  resolveZoneKind,
  type QueryAttributes,
} from './context-graph-snapshot.js';
import { createSemantifyProjectionSnapshot } from './semantify-projection-adapter.js';
export type {
  DefinitionResolutionOptions,
  DefinitionTarget,
  SchemaPathDetails,
} from './context-graph-definition-resolution.js';

export interface SemanticQueryContext {
  operation: SemanticOperation;
  contextBlock?: SemanticContextBlock;
  semanticZone?: SemanticZone;
  profileId?: string;
  documentUri?: string;
  offset?: number;
  line?: number;
  character?: number;
}

export interface SemanticCompletionCandidate {
  label: string;
  kind: 'variable' | 'property' | 'keyword';
  detail?: string;
  documentation?: string;
}

export interface SemanticDefinitionDescriptor {
  uri: string;
  path?: string;
  pathKind?: 'property' | 'value';
  valueToken?: string;
}

export interface SemanticDefinitionOptions {
  schemaUri?: string;
  contentSchemaUri?: string;
}

export interface SemanticSchemaReadOptions {
  schema?: object;
  contentSchema?: object;
  schemaUri?: string;
  contentSchemaUri?: string;
}

export interface ContextGraphSemanticReadAdapterOptions {
  readTextFile?: (filePath: string) => string;
}

/**
 * @internal
 * Exported solely for white-box unit testing. Not part of the stable public API.
 * These helpers are subject to change or removal without notice.
 */
export const contextGraphAdapterTesting = {
  ...contextGraphDefinitionResolutionTesting,
  ...contextGraphSnapshotTesting,
};

export class ContextGraphSemanticReadAdapter {
  private readonly snapshotCache = new Map<string, Snapshot>();

  constructor(private readonly options: ContextGraphSemanticReadAdapterOptions = {}) {}

  private readTextFile(filePath: string): string {
    return this.options.readTextFile
      ? this.options.readTextFile(filePath)
      : readFileSync(filePath, 'utf-8');
  }

  private getSnapshot(options: {
    schema?: object;
    contentSchema?: object;
    contentSchemaUri?: string;
  }): Snapshot {
    const cacheKey = buildSnapshotCacheKey(options);
    const cachedSnapshot = this.snapshotCache.get(cacheKey);
    if (cachedSnapshot) {
      return cachedSnapshot;
    }

    const snapshot = this.buildSnapshot(options);
    this.snapshotCache.set(cacheKey, snapshot);
    return snapshot;
  }

  private expandScopedPath(path: string, bindings: TemplateBinding[]): string {
    let resolved = path;
    const usedBindingIndexes = new Set<number>();

    for (let iteration = 0; iteration < bindings.length; iteration += 1) {
      let changed = false;

      for (const [bindingIndex, binding] of bindings.entries()) {
        if (usedBindingIndexes.has(bindingIndex)) {
          continue;
        }

        if (!binding.sourcePath) {
          continue;
        }

        if (
          binding.kind !== 'for-alias' &&
          binding.kind !== 'for-value-alias' &&
          binding.kind !== 'set-variable'
        ) {
          continue;
        }

        if (
          resolved === binding.name ||
          resolved.startsWith(`${binding.name}.`) ||
          resolved.startsWith(`${binding.name}[`)
        ) {
          const iterableBase =
            binding.kind === 'set-variable'
              ? binding.sourcePath
              : binding.sourcePath.endsWith(']')
                ? binding.sourcePath
                : `${binding.sourcePath}[0]`;
          resolved = `${iterableBase}${resolved.slice(binding.name.length)}`;
          usedBindingIndexes.add(bindingIndex);
          changed = true;
          break;
        }
      }

      if (!changed) {
        break;
      }
    }

    return resolved;
  }

  private buildSnapshot(options: {
    schema?: object;
    contentSchema?: object;
    contentSchemaUri?: string;
  }): Snapshot {
    const rawContentSchema = options.contentSchema ?? options.schema;
    const contentSchemaUri = options.contentSchemaUri;
    const contentSchema =
      rawContentSchema && contentSchemaUri
        ? this.resolveAllOfRefs(rawContentSchema, contentSchemaUri)
        : rawContentSchema;

    const projectedSnapshot = createSemantifyProjectionSnapshot({
      text: '',
      schema: options.schema,
      contentSchema,
    });

    return {
      version: 'v1',
      revision: projectedSnapshot.revision,
      nodes: projectedSnapshot.nodes.flatMap((node) => {
        if (node.kind !== 'templjs.schema-path' && node.kind !== 'templjs.schema-enum-value') {
          return [];
        }

        const profileId = asNonEmptyString(node.attributes?.profileId) ?? node.profileId;
        const path = asString(node.attributes?.path) ?? '';
        const compatibilityKind =
          node.kind === 'templjs.schema-path' ? 'schema-path' : 'schema-enum-value';
        const value = node.attributes?.value ?? node.attributes?.label ?? '';
        const id =
          compatibilityKind === 'schema-path'
            ? `${profileId}:schema-path:${path}`
            : `${profileId}:schema-enum:${path}:${String(value)}`;

        return [
          {
            ...node,
            id,
            profileId,
            kind: compatibilityKind,
            attributes: {
              ...(node.attributes ?? {}),
              projectedSemanticKind: node.kind,
              projectionProfileId: node.profileId,
            },
          },
        ];
      }),
      edges: [],
    };
  }

  private resolveAllOfRefs(schema: object, schemaUri: string): object {
    const record = schema as Record<string, unknown>;
    if (!Array.isArray(record.allOf)) {
      return schema;
    }

    const mergedProperties: Record<string, unknown> = {
      ...(record.properties as Record<string, unknown> | undefined),
    };
    let resolved = false;

    for (const entry of record.allOf as unknown[]) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }
      const refRecord = entry as Record<string, unknown>;
      if (typeof refRecord.$ref !== 'string') {
        continue;
      }
      const refSchema = this.loadSchemaRef(schemaUri, refRecord.$ref);
      if (refSchema && typeof refSchema === 'object') {
        const refProps = (refSchema as Record<string, unknown>).properties;
        if (refProps && typeof refProps === 'object' && !Array.isArray(refProps)) {
          Object.assign(mergedProperties, refProps);
          resolved = true;
        }
      }
    }

    if (!resolved) {
      return schema;
    }
    return { ...record, properties: mergedProperties };
  }

  private loadSchemaRef(baseUri: string, ref: string): unknown {
    const hashIdx = ref.indexOf('#');
    const source = hashIdx === -1 ? ref : ref.slice(0, hashIdx);
    const fragment = hashIdx === -1 ? '' : ref.slice(hashIdx + 1);

    const targetUri = source ? resolveRefTargetUri(baseUri, source) : baseUri;
    if (!targetUri || !targetUri.startsWith('file://')) {
      return undefined;
    }

    let parsed: unknown;
    try {
      const text = this.readTextFile(fileURLToPath(targetUri));
      parsed = JSON.parse(text);
    } catch {
      return undefined;
    }

    if (!fragment) {
      return parsed;
    }

    let current: unknown = parsed;
    for (const rawSeg of fragment.split('/').filter(Boolean)) {
      const seg = decodeJsonPointerSegment(rawSeg);
      if (!current || typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[seg];
    }
    return current;
  }

  getPathDetails(
    context: SemanticQueryContext,
    path: string,
    options: SemanticSchemaReadOptions
  ): SchemaPathDetails | null {
    const contextProfileId = resolveProfileId(context);
    const response = this.query(
      options,
      {
        version: 'v1',
        nodes: {
          profileIds: [contextProfileId],
          kind: 'schema-path',
          attributeEquals: {
            path,
            operation: context.operation,
            ...(context.documentUri ? { documentUri: context.documentUri } : {}),
            ...(typeof context.offset === 'number' ? { offset: context.offset } : {}),
            ...(typeof context.line === 'number' ? { line: context.line } : {}),
            ...(typeof context.character === 'number' ? { character: context.character } : {}),
          },
        },
      },
      context
    );

    const node = response.nodes[0];
    if (node?.attributes) {
      return {
        path,
        type: asString(node.attributes.type),
        description: asString(node.attributes.description),
      };
    }

    const schemaUri = resolveSchemaUriForContext(context, options);
    if (!schemaUri) {
      return null;
    }

    const resolved = resolvePathDefinitionAcrossRefs(
      schemaUri,
      path,
      'property',
      undefined,
      8,
      (p) => this.readTextFile(p)
    );
    if (!resolved || !resolved.uri.startsWith('file://')) {
      return null;
    }

    try {
      const schemaText = this.readTextFile(fileURLToPath(resolved.uri));
      const schema = JSON.parse(schemaText) as object;
      const metadata = getSharedSchemaMetadata(schema);
      const entry = metadata[resolved.pathAtTarget];
      if (!entry) {
        return null;
      }

      return {
        path,
        type: entry.type,
        description: entry.description,
      };
    } catch {
      return null;
    }
  }

  getChildCompletions(
    context: SemanticQueryContext,
    parentPath: string,
    options: SemanticSchemaReadOptions
  ): SemanticCompletionCandidate[] {
    const contextProfileId = resolveProfileId(context);
    const attributes: QueryAttributes = parentPath
      ? {
          parentPath,
          operation: context.operation,
          ...(context.documentUri ? { documentUri: context.documentUri } : {}),
          ...(typeof context.offset === 'number' ? { offset: context.offset } : {}),
          ...(typeof context.line === 'number' ? { line: context.line } : {}),
          ...(typeof context.character === 'number' ? { character: context.character } : {}),
        }
      : {
          parentPath: '',
          operation: context.operation,
          ...(context.documentUri ? { documentUri: context.documentUri } : {}),
          ...(typeof context.offset === 'number' ? { offset: context.offset } : {}),
          ...(typeof context.line === 'number' ? { line: context.line } : {}),
          ...(typeof context.character === 'number' ? { character: context.character } : {}),
          isDirectProperty: true,
        };
    const response = this.query(
      options,
      {
        version: 'v1',
        nodes: {
          profileIds: [contextProfileId],
          kind: 'schema-path',
          attributeEquals: attributes,
        },
      },
      context
    );

    return response.nodes.map((node: Node) => ({
      label: String(node.attributes?.label ?? ''),
      kind: parentPath ? 'property' : 'variable',
      detail: asString(node.attributes?.type),
      documentation: asNonEmptyString(node.attributes?.description),
    }));
  }

  getEnumValueCompletions(
    context: SemanticQueryContext,
    path: string,
    options: SemanticSchemaReadOptions
  ): SemanticCompletionCandidate[] {
    const contextProfileId = resolveProfileId(context);
    const response = this.query(
      options,
      {
        version: 'v1',
        nodes: {
          profileIds: [contextProfileId],
          kind: 'schema-enum-value',
          attributeEquals: {
            path,
            operation: context.operation,
            ...(context.documentUri ? { documentUri: context.documentUri } : {}),
            ...(typeof context.offset === 'number' ? { offset: context.offset } : {}),
            ...(typeof context.line === 'number' ? { line: context.line } : {}),
            ...(typeof context.character === 'number' ? { character: context.character } : {}),
          },
        },
      },
      context
    );

    return response.nodes.map((node: Node) => ({
      label: String(node.attributes?.label ?? ''),
      kind: 'keyword',
      detail: `${path} enum`,
    }));
  }

  resolveScopedPath(text: string, path: string, offset: number): string {
    const bindings = getTemplateBindingsAtOffset(extractTemplateBindings(text), offset);

    return this.expandScopedPath(path, bindings);
  }

  getScopeBindings(text: string): TemplateBinding[] {
    return extractTemplateBindings(text);
  }

  resolveLocalAliasDefinition(
    text: string,
    alias: string,
    offset: number
  ): { start: number; end: number } | null {
    const bindings = getTemplateBindingsAtOffset(extractTemplateBindings(text), offset);

    for (const binding of bindings) {
      const matchesAlias =
        alias === binding.name ||
        alias.startsWith(`${binding.name}.`) ||
        alias.startsWith(`${binding.name}[`);
      if (matchesAlias) {
        if (
          binding.declarationStartOffset === undefined ||
          binding.declarationEndOffset === undefined
        ) {
          return null;
        }
        return {
          start: binding.declarationStartOffset,
          end: binding.declarationEndOffset,
        };
      }
    }

    return null;
  }

  resolveDocumentDefinition(
    _context: SemanticQueryContext,
    text: string,
    offset: number,
    options: DefinitionResolutionOptions
  ): DefinitionTarget | null {
    return (
      getPathValueDefinition(text, offset, options) ??
      getSchemaPathDefinition(text, offset, options)
    );
  }

  resolveDefinitionLocation(
    _context: SemanticQueryContext,
    descriptor: SemanticDefinitionDescriptor
  ): DefinitionTarget {
    if (!descriptor.path || !descriptor.uri.startsWith('file://')) {
      return toDefinitionTarget(descriptor.uri);
    }

    const refResolved = resolvePathDefinitionAcrossRefs(
      descriptor.uri,
      descriptor.path,
      descriptor.pathKind ?? 'property',
      descriptor.valueToken,
      8,
      (p) => this.readTextFile(p)
    );
    if (refResolved) {
      try {
        const targetText = this.readTextFile(fileURLToPath(refResolved.uri));
        const endOffset = Math.min(
          targetText.length,
          refResolved.startOffset +
            Math.max(
              (descriptor.valueToken ?? descriptor.path.split('.').pop() ?? '').length + 2,
              3
            )
        );

        return {
          uri: refResolved.uri,
          range: {
            start: getPositionForOffset(targetText, refResolved.startOffset),
            end: getPositionForOffset(targetText, endOffset),
          },
        };
      } catch {
        return toDefinitionTarget(refResolved.uri);
      }
    }

    try {
      const schemaFilePath = fileURLToPath(descriptor.uri);
      const schemaText = this.readTextFile(schemaFilePath);
      const startOffset = findBestPropertyOffset(
        schemaText,
        descriptor.path,
        descriptor.pathKind,
        descriptor.valueToken
      );
      const endOffset = Math.min(
        schemaText.length,
        startOffset +
          Math.max((descriptor.valueToken ?? descriptor.path.split('.').pop() ?? '').length + 2, 3)
      );

      return {
        uri: descriptor.uri,
        range: {
          start: getPositionForOffset(schemaText, startOffset),
          end: getPositionForOffset(schemaText, endOffset),
        },
      };
    } catch {
      return toDefinitionTarget(descriptor.uri);
    }
  }

  resolvePathDefinition(
    context: SemanticQueryContext,
    path: string,
    options: SemanticDefinitionOptions,
    pathKind: 'property' | 'value' = 'property',
    valueToken?: string
  ): DefinitionTarget | null {
    const uri = resolveSchemaUriForContext(context, options);

    if (!uri) {
      return null;
    }

    return this.resolveDefinitionLocation(context, {
      uri,
      path,
      pathKind,
      valueToken,
    });
  }

  private withContext(snapshot: Snapshot, context?: SemanticQueryContext): Snapshot {
    if (!context) {
      return snapshot;
    }

    const contextAttributes: Record<string, JsonPrimitive> = {
      operation: context.operation,
      profileId: resolveProfileId(context),
      zoneKind: resolveZoneKind(context),
      contextBlock: context.contextBlock ?? context.semanticZone?.legacyContextBlock ?? 'content',
    };
    if (context.documentUri) {
      contextAttributes.documentUri = context.documentUri;
    }
    if (typeof context.offset === 'number') {
      contextAttributes.offset = context.offset;
    }
    if (typeof context.line === 'number') {
      contextAttributes.line = context.line;
    }
    if (typeof context.character === 'number') {
      contextAttributes.character = context.character;
    }

    return {
      ...snapshot,
      nodes: snapshot.nodes.map((node: Node) => ({
        ...node,
        attributes: {
          ...(node.attributes ?? {}),
          ...contextAttributes,
        },
      })),
    };
  }

  query(
    options: { schema?: object; contentSchema?: object; contentSchemaUri?: string },
    request: QueryRequest,
    context?: SemanticQueryContext
  ): QueryResponse {
    return querySnapshot(this.withContext(this.getSnapshot(options), context), request);
  }
}

export function createContextGraphSemanticReadAdapter(
  options: ContextGraphSemanticReadAdapterOptions = {}
): ContextGraphSemanticReadAdapter {
  return new ContextGraphSemanticReadAdapter(options);
}
