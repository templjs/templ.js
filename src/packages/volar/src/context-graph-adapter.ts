import {
  extractTemplateScopeBindings,
  SchemaValidator,
  type TemplateScopeBinding,
} from '@templjs/core';
import type {
  ContextNode,
  GraphSnapshot,
  JsonPrimitive,
  QueryRequest,
  QueryResponse,
} from '@templjs/context-graph';

export type SemanticOperation = 'completion' | 'hover' | 'definition' | 'diagnostics';
export type SemanticSchemaSource = 'primary' | 'secondary';

export interface SemanticQueryContext {
  operation: SemanticOperation;
  schemaSource: SemanticSchemaSource;
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

interface SchemaPathDetails {
  path: string;
  type?: string;
  description?: string;
}

type QueryAttributes = Readonly<Record<string, JsonPrimitive>>;

function getParentPath(path: string): string {
  const lastDot = path.lastIndexOf('.');
  return lastDot === -1 ? '' : path.slice(0, lastDot);
}

function getLabel(path: string): string {
  const lastDot = path.lastIndexOf('.');
  const label = lastDot === -1 ? path : path.slice(lastDot + 1);
  return label.replace(/\[[^\]]+\]/g, '');
}

function buildPathNodes(schemaSource: SemanticSchemaSource, schema?: object): ContextNode[] {
  if (!schema) {
    return [];
  }

  const profileId = `schema-${schemaSource}`;

  const metadata = new SchemaValidator(schema).getMetadata();
  const nodes: ContextNode[] = [];

  for (const [path, entry] of Object.entries(metadata)) {
    nodes.push({
      id: `${profileId}:schema-path:${path}`,
      profileId,
      kind: 'schema-path',
      attributes: {
        path,
        parentPath: getParentPath(path),
        label: getLabel(path),
        type: entry.type,
        description: entry.description ?? '',
        schemaSource,
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
            kind: 'schema-enum-value',
            attributes: {
              path: currentPath,
              value,
              label: String(value),
              schemaSource,
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

function filterNodes(snapshot: GraphSnapshot, request: QueryRequest): ContextNode[] {
  return snapshot.nodes.filter((node) => {
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

function querySnapshot(snapshot: GraphSnapshot, request: QueryRequest): QueryResponse {
  return {
    version: request.version,
    revision: snapshot.revision,
    nodes: filterNodes(snapshot, request).sort((left, right) => left.id.localeCompare(right.id)),
    edges: [],
  };
}

export class ContextGraphSemanticReadAdapter {
  private expandScopedPath(path: string, bindings: TemplateScopeBinding[]): string {
    let resolved = path;
    const usedBindingIndexes = new Set<number>();

    for (let iteration = 0; iteration < bindings.length; iteration += 1) {
      let changed = false;

      for (const [bindingIndex, binding] of bindings.entries()) {
        if (usedBindingIndexes.has(bindingIndex)) {
          continue;
        }

        if (
          resolved === binding.alias ||
          resolved.startsWith(`${binding.alias}.`) ||
          resolved.startsWith(`${binding.alias}[`)
        ) {
          const iterableBase = binding.iterablePath.endsWith(']')
            ? binding.iterablePath
            : `${binding.iterablePath}[0]`;
          resolved = `${iterableBase}${resolved.slice(binding.alias.length)}`;
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

  private buildSnapshot(options: { schema?: object; contentSchema?: object }): GraphSnapshot {
    return {
      version: 'v1',
      revision: 1,
      nodes: [
        ...buildPathNodes('primary', options.schema),
        ...buildPathNodes('secondary', options.contentSchema ?? options.schema),
      ],
      edges: [],
    };
  }

  getPathDetails(
    context: SemanticQueryContext,
    path: string,
    options: { schema?: object; contentSchema?: object }
  ): SchemaPathDetails | null {
    const response = this.query(
      options,
      {
        version: 'v1',
        nodes: {
          kind: 'schema-path',
          attributeEquals: {
            path,
            schemaSource: context.schemaSource,
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
    if (!node?.attributes) {
      return null;
    }

    return {
      path,
      type: typeof node.attributes.type === 'string' ? node.attributes.type : undefined,
      description:
        typeof node.attributes.description === 'string' ? node.attributes.description : undefined,
    };
  }

  getChildCompletions(
    context: SemanticQueryContext,
    parentPath: string,
    options: { schema?: object; contentSchema?: object }
  ): SemanticCompletionCandidate[] {
    const attributes: QueryAttributes = parentPath
      ? {
          parentPath,
          schemaSource: context.schemaSource,
          operation: context.operation,
          ...(context.documentUri ? { documentUri: context.documentUri } : {}),
          ...(typeof context.offset === 'number' ? { offset: context.offset } : {}),
          ...(typeof context.line === 'number' ? { line: context.line } : {}),
          ...(typeof context.character === 'number' ? { character: context.character } : {}),
        }
      : {
          parentPath: '',
          schemaSource: context.schemaSource,
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
          kind: 'schema-path',
          attributeEquals: attributes,
        },
      },
      context
    );

    return response.nodes.map((node) => ({
      label: String(node.attributes?.label ?? ''),
      kind: parentPath ? 'property' : 'variable',
      detail: typeof node.attributes?.type === 'string' ? node.attributes.type : undefined,
      documentation:
        typeof node.attributes?.description === 'string' && node.attributes.description.length > 0
          ? node.attributes.description
          : undefined,
    }));
  }

  getEnumValueCompletions(
    context: SemanticQueryContext,
    path: string,
    options: { schema?: object; contentSchema?: object }
  ): SemanticCompletionCandidate[] {
    const response = this.query(
      options,
      {
        version: 'v1',
        nodes: {
          kind: 'schema-enum-value',
          attributeEquals: {
            path,
            schemaSource: context.schemaSource,
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

    return response.nodes.map((node) => ({
      label: String(node.attributes?.label ?? ''),
      kind: 'keyword',
      detail: `${path} enum`,
    }));
  }

  resolveScopedPath(text: string, path: string, offset: number): string {
    const bindings = extractTemplateScopeBindings(text)
      .filter((binding) => offset >= binding.scopeStartOffset && offset < binding.scopeEndOffset)
      .sort((left, right) => right.scopeStartOffset - left.scopeStartOffset);

    return this.expandScopedPath(path, bindings);
  }

  getScopeBindings(text: string): TemplateScopeBinding[] {
    return extractTemplateScopeBindings(text);
  }

  private withContext(snapshot: GraphSnapshot, context?: SemanticQueryContext): GraphSnapshot {
    if (!context) {
      return snapshot;
    }

    const contextAttributes: Record<string, JsonPrimitive> = {
      operation: context.operation,
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
      nodes: snapshot.nodes.map((node) => ({
        ...node,
        attributes: {
          ...(node.attributes ?? {}),
          ...contextAttributes,
        },
      })),
    };
  }

  query(
    options: { schema?: object; contentSchema?: object },
    request: QueryRequest,
    context?: SemanticQueryContext
  ): QueryResponse {
    return querySnapshot(this.withContext(this.buildSnapshot(options), context), request);
  }
}

export function createContextGraphSemanticReadAdapter(): ContextGraphSemanticReadAdapter {
  return new ContextGraphSemanticReadAdapter();
}
