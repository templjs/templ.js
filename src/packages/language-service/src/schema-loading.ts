import { existsSync, readFileSync } from 'fs';
import * as path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { minimatch } from 'minimatch';
import { getFrontmatterSchemaAliases } from '@templjs/core';
import {
  resolveSchemaFilePath,
  resolveSchemaFilePathSync,
  splitSchemaSourceReference,
} from '@templjs/volar';

export const DEFAULT_SCHEMA_LOAD_TIMEOUT_MS = 5000;

export interface WorkspaceFolderLike {
  uri: string;
}

export interface SchemaPatternConfig {
  schemaPath?: string;
  contentSchemaPath?: string;
}

export interface ServerInitializationOptions {
  schemaPath?: string;
  contentSchemaPath?: string;
  schemaPatterns?: Record<string, SchemaPatternConfig>;
  traceMode?: 'off' | 'messages' | 'verbose';
  prettierHostLanguages?: string[];
  markdownlintRegisteredForMd?: boolean;
  redhatYamlRegisteredForYaml?: boolean;
  htmlLSRegisteredForHtml?: boolean;
  documentContext?: {
    uri?: string;
    content?: string;
  };
}

export interface InitializeParamsLike {
  rootUri?: string | null;
  workspaceFolders?: WorkspaceFolderLike[];
  initializationOptions?: ServerInitializationOptions;
}

export interface SchemaLoadResult {
  schema?: object;
  schemaUri?: string;
}

export interface SchemaLoadContext {
  cache?: Map<string, unknown>;
  fetchImpl?: typeof fetch;
  log?: (message: string) => void;
  timeoutMs?: number;
}

export interface SchemaLoadSyncContext {
  cache?: Map<string, unknown>;
  loadUrlSync?: (url: string) => string | object | undefined;
  log?: (message: string) => void;
}

type JsonRecord = Record<string, unknown>;

function decodeJsonPointerSegment(segment: string): string {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergeSchemaRecords(base: JsonRecord, overlay: JsonRecord): JsonRecord {
  const merged: JsonRecord = { ...base, ...overlay };

  if (isJsonRecord(base.properties) && isJsonRecord(overlay.properties)) {
    merged.properties = {
      ...base.properties,
      ...overlay.properties,
    };
  }

  if (Array.isArray(base.required) && Array.isArray(overlay.required)) {
    merged.required = Array.from(new Set([...base.required, ...overlay.required]));
  }

  return merged;
}

function loadJsonFromFile(filePath: string, cache: Map<string, unknown>): unknown {
  if (cache.has(filePath)) {
    return cache.get(filePath);
  }

  const content = readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(content) as unknown;
  cache.set(filePath, parsed);
  return parsed;
}

function isRemoteSchemaPath(pathOrUrl: string): boolean {
  return pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://');
}

function preserveSchemaRefNode(
  node: JsonRecord,
  currentFilePath: string,
  currentRoot: unknown,
  cache: Map<string, unknown>,
  seenRefs: Set<string>
): JsonRecord {
  const preserved: JsonRecord = {};
  for (const [key, value] of Object.entries(node)) {
    preserved[key] =
      key === '$ref'
        ? value
        : dereferenceSchemaNode(value, currentFilePath, currentRoot, cache, seenRefs);
  }
  return preserved;
}

function resolveFragmentSchema(
  rootSchema: unknown,
  fragment: string | undefined
): object | undefined {
  if (!fragment || fragment === '#') {
    return rootSchema && typeof rootSchema === 'object' && !Array.isArray(rootSchema)
      ? (rootSchema as object)
      : undefined;
  }

  if (!fragment.startsWith('#/')) {
    return undefined;
  }

  const segments = fragment
    .slice(2)
    .split('/')
    .map((segment) => decodeJsonPointerSegment(segment));

  let current: unknown = rootSchema;
  for (const segment of segments) {
    if (
      !current ||
      typeof current !== 'object' ||
      !(segment in (current as Record<string, unknown>))
    ) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return current && typeof current === 'object' && !Array.isArray(current)
    ? (current as object)
    : undefined;
}

function dereferenceSchemaNode(
  node: unknown,
  currentFilePath: string,
  currentRoot: unknown,
  cache: Map<string, unknown>,
  seenRefs: Set<string>
): unknown {
  if (Array.isArray(node)) {
    return node.map((item) =>
      dereferenceSchemaNode(item, currentFilePath, currentRoot, cache, seenRefs)
    );
  }

  if (!isJsonRecord(node)) {
    return node;
  }

  const ref = typeof node.$ref === 'string' ? node.$ref.trim() : undefined;
  if (ref && (ref.startsWith('#') || ref.endsWith('.json') || ref.includes('.json#'))) {
    const refKey = `${currentFilePath}::${ref}`;
    if (seenRefs.has(refKey)) {
      const rest = { ...node };
      delete rest.$ref;
      return rest;
    }

    const { source, fragment } = splitSchemaSourceReference(ref);
    let targetRoot = currentRoot;
    let targetFilePath = currentFilePath;

    if (source) {
      if (isRemoteSchemaPath(source) || isRemoteSchemaPath(currentFilePath)) {
        return preserveSchemaRefNode(node, currentFilePath, currentRoot, cache, seenRefs);
      }

      targetFilePath = path.isAbsolute(source)
        ? source
        : path.resolve(path.dirname(currentFilePath), source);
      if (!existsSync(targetFilePath)) {
        const rest = { ...node };
        delete rest.$ref;
        return rest;
      }

      try {
        targetRoot = loadJsonFromFile(targetFilePath, cache);
      } catch {
        const rest = { ...node };
        delete rest.$ref;
        return rest;
      }
    }

    const target = resolveFragmentSchema(targetRoot, fragment);
    const rest = { ...node };
    delete rest.$ref;

    if (!target) {
      return dereferenceSchemaNode(rest, currentFilePath, currentRoot, cache, seenRefs);
    }

    const nextSeen = new Set(seenRefs);
    nextSeen.add(refKey);

    const derefTarget = dereferenceSchemaNode(target, targetFilePath, targetRoot, cache, nextSeen);
    const derefRest = dereferenceSchemaNode(rest, currentFilePath, currentRoot, cache, nextSeen);

    if (isJsonRecord(derefTarget) && isJsonRecord(derefRest)) {
      return mergeSchemaRecords(derefTarget, derefRest);
    }

    return derefRest;
  }

  const next: JsonRecord = {};
  for (const [key, value] of Object.entries(node)) {
    next[key] = dereferenceSchemaNode(value, currentFilePath, currentRoot, cache, seenRefs);
  }
  return next;
}

export function resolveWorkspaceRoot(params: InitializeParamsLike): string | undefined {
  let workspaceUri: string | undefined;
  const documentUri = params.initializationOptions?.documentContext?.uri;

  if (documentUri && params.workspaceFolders?.length) {
    try {
      const documentPath = documentUri.startsWith('file://')
        ? fileURLToPath(documentUri)
        : documentUri;
      let bestMatch: { uri: string; path: string } | undefined;
      for (const folder of params.workspaceFolders) {
        const folderPath = folder.uri.startsWith('file://')
          ? fileURLToPath(folder.uri)
          : folder.uri;
        const relativePath = path.relative(folderPath, documentPath);
        if (
          relativePath === '' ||
          (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
        ) {
          if (!bestMatch || folderPath.length > bestMatch.path.length) {
            bestMatch = { uri: folder.uri, path: folderPath };
          }
        }
      }
      workspaceUri = bestMatch?.uri;
    } catch {
      workspaceUri = undefined;
    }
  }

  workspaceUri ??= params.workspaceFolders?.[0]?.uri ?? params.rootUri ?? undefined;
  if (!workspaceUri) {
    return undefined;
  }

  if (workspaceUri.startsWith('file://')) {
    try {
      return fileURLToPath(workspaceUri);
    } catch {
      return undefined;
    }
  }

  return workspaceUri;
}

export function findSchemaConfigForDocument(
  documentPath: string | undefined,
  schemaPatterns: Record<string, SchemaPatternConfig> | undefined
): SchemaPatternConfig | undefined {
  if (!documentPath || !schemaPatterns) {
    return undefined;
  }

  for (const [globPattern, config] of Object.entries(schemaPatterns)) {
    if (minimatch(documentPath, globPattern, { dot: true })) {
      return config;
    }
  }

  return undefined;
}

export async function loadSchemaSource(
  source: string,
  workspaceRoot: string | undefined,
  documentUri?: string,
  context?: SchemaLoadContext
): Promise<SchemaLoadResult> {
  const { source: sourcePath, fragment } = splitSchemaSourceReference(source);
  if (!sourcePath) {
    return {};
  }

  const cache = context?.cache ?? new Map<string, unknown>();
  const log = context?.log ?? (() => undefined);

  if (sourcePath.startsWith('http://') || sourcePath.startsWith('https://')) {
    const fetchImpl = context?.fetchImpl ?? globalThis.fetch;
    if (!fetchImpl) {
      log(`[templjs] No fetch implementation available for schema URL '${sourcePath}'`);
      return {};
    }

    let rootSchema = cache.get(sourcePath);
    if (rootSchema === undefined) {
      const controller = new AbortController();
      const timeoutMs = context?.timeoutMs ?? DEFAULT_SCHEMA_LOAD_TIMEOUT_MS;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(sourcePath, { signal: controller.signal });

        if (!response.ok) {
          log(`[templjs] Failed to load schema from URL '${sourcePath}': HTTP ${response.status}`);
          return {};
        }

        const schemaContent = await response.text();
        rootSchema = JSON.parse(schemaContent) as unknown;
        cache.set(sourcePath, rootSchema);
      } catch (error) {
        if (
          (error instanceof Error && error.name === 'AbortError') ||
          (typeof error === 'object' &&
            error !== null &&
            'name' in error &&
            (error as { name?: unknown }).name === 'AbortError')
        ) {
          log(`[templjs] Timeout loading schema from URL '${sourcePath}' after ${timeoutMs}ms`);
          return {};
        }

        log(
          `[templjs] Error loading schema from URL '${sourcePath}': ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        return {};
      } finally {
        clearTimeout(timeoutId);
      }
    }

    try {
      const schema = resolveFragmentSchema(rootSchema, fragment);
      if (!schema) {
        log(`[templjs] Schema fragment not found in URL '${sourcePath}${fragment ?? ''}'`);
        return {};
      }

      const dereferencedSchema = dereferenceSchemaNode(
        schema,
        sourcePath,
        rootSchema,
        new Map<string, unknown>([[sourcePath, rootSchema]]),
        new Set<string>()
      );

      log(`[templjs] Loaded schema from URL: ${sourcePath}${fragment ?? ''}`);
      return {
        schema: dereferencedSchema as object,
        schemaUri: sourcePath,
      };
    } catch (error) {
      log(
        `[templjs] Error processing schema from URL '${sourcePath}': ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return {};
    }
  }

  const resolvedPath = await resolveSchemaFilePath(sourcePath, workspaceRoot, documentUri);
  if (!resolvedPath) {
    log(`[templjs] Could not resolve schema path '${sourcePath}' (no workspace root?)`);
    return {};
  }

  try {
    const rootSchema = loadJsonFromFile(resolvedPath, cache);
    const schema = resolveFragmentSchema(rootSchema, fragment);
    if (!schema) {
      log(`[templjs] Schema fragment not found in file '${resolvedPath}${fragment ?? ''}'`);
      return {};
    }

    const dereferencedSchema = dereferenceSchemaNode(
      schema,
      resolvedPath,
      rootSchema,
      cache,
      new Set<string>()
    );

    log(`[templjs] Loaded schema from file: ${resolvedPath}${fragment ?? ''}`);
    return {
      schema: dereferencedSchema as object,
      schemaUri: pathToFileURL(resolvedPath).toString(),
    };
  } catch (error) {
    log(
      `[templjs] Error loading schema from path '${resolvedPath}': ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return {};
  }
}

export function loadSchemaSourceSync(
  source: string,
  workspaceRoot: string | undefined,
  documentUri?: string,
  context?: SchemaLoadSyncContext
): SchemaLoadResult {
  const { source: sourcePath, fragment } = splitSchemaSourceReference(source);
  if (!sourcePath) {
    return {};
  }

  const cache = context?.cache ?? new Map<string, unknown>();
  const log = context?.log ?? (() => undefined);

  if (sourcePath.startsWith('http://') || sourcePath.startsWith('https://')) {
    let rootSchema = cache.get(sourcePath);

    if (rootSchema === undefined && context?.loadUrlSync) {
      try {
        const loaded = context.loadUrlSync(sourcePath);
        if (typeof loaded === 'string') {
          rootSchema = JSON.parse(loaded) as unknown;
          cache.set(sourcePath, rootSchema);
        } else if (loaded && typeof loaded === 'object') {
          rootSchema = loaded;
          cache.set(sourcePath, rootSchema);
        }
      } catch (error) {
        log(
          `[templjs] Error loading schema from URL '${sourcePath}' in sync mode: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        return {};
      }
    }

    if (rootSchema === undefined) {
      log(
        `[templjs] Could not load schema URL '${sourcePath}' in sync mode (not cached and no sync URL loader)`
      );
      return {};
    }

    try {
      const schema = resolveFragmentSchema(rootSchema, fragment);
      if (!schema) {
        log(`[templjs] Schema fragment not found in URL '${sourcePath}${fragment ?? ''}'`);
        return {};
      }

      const dereferencedSchema = dereferenceSchemaNode(
        schema,
        sourcePath,
        rootSchema,
        new Map<string, unknown>([[sourcePath, rootSchema]]),
        new Set<string>()
      );

      return {
        schema: dereferencedSchema as object,
        schemaUri: sourcePath,
      };
    } catch (error) {
      log(
        `[templjs] Error processing schema from URL '${sourcePath}' in sync mode: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return {};
    }
  }

  const resolvedPath = resolveSchemaFilePathSync(sourcePath, workspaceRoot, documentUri);
  if (!resolvedPath) {
    return {};
  }

  try {
    const rootSchema = loadJsonFromFile(resolvedPath, cache);
    const schema = resolveFragmentSchema(rootSchema, fragment);
    if (!schema) {
      return {};
    }

    const dereferencedSchema = dereferenceSchemaNode(
      schema,
      resolvedPath,
      rootSchema,
      cache,
      new Set<string>()
    );

    return {
      schema: dereferencedSchema as object,
      schemaUri: pathToFileURL(resolvedPath).toString(),
    };
  } catch {
    return {};
  }
}

function parseSchemaDirective(
  content: string,
  directiveType: 'schema' | 'content-schema' = 'schema'
): string | undefined {
  const pattern =
    directiveType === 'schema'
      ? /{{#\s*schema:\s*([^\s}]+)\s*}}/i
      : /{{#\s*content-schema:\s*([^\s}]+)\s*}}/i;
  const match = content.match(pattern);
  return match ? match[1] : undefined;
}

function parseInlineSchemaDirectives(content: string): {
  schemaPath?: string;
  contentSchemaPath?: string;
} {
  return {
    schemaPath: parseSchemaDirective(content, 'schema'),
    contentSchemaPath: parseSchemaDirective(content, 'content-schema'),
  };
}

function getSchemaValueFromRecord(
  record: Record<string, unknown> | undefined,
  keys: string[]
): string | undefined {
  if (!record) {
    return undefined;
  }

  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

function parseRootObject(content: string): Record<string, unknown> | undefined {
  const trimmedContent = content.trim();
  if (!trimmedContent) {
    return undefined;
  }

  try {
    const parsedJson = JSON.parse(trimmedContent) as unknown;
    if (parsedJson && typeof parsedJson === 'object' && !Array.isArray(parsedJson)) {
      return parsedJson as Record<string, unknown>;
    }
  } catch {
    // Best-effort JSON parsing only for root objects.
  }

  return undefined;
}

function extractRootPropertySchemas(content: string): {
  templSchema?: string;
  contentSchema?: string;
} {
  const fromFrontmatter = getFrontmatterSchemaAliases(content);
  const parsedRootObject = parseRootObject(content);

  const templSchema =
    fromFrontmatter.templSchema ??
    getSchemaValueFromRecord(parsedRootObject, ['$templ-schema', '$schema']);
  const contentSchema =
    fromFrontmatter.contentSchema ??
    getSchemaValueFromRecord(parsedRootObject, ['$content-schema', '$content_schema']);

  return { templSchema, contentSchema };
}

export function extractDocumentSchemaKey(content: string): string {
  const inline = parseInlineSchemaDirectives(content);
  const root = extractRootPropertySchemas(content);
  return [
    inline.schemaPath ?? root.templSchema ?? '',
    inline.contentSchemaPath ?? root.contentSchema ?? '',
  ].join('\0');
}

function resolveDocumentPath(
  documentUri: string | undefined,
  workspaceRoot: string | undefined
): string | undefined {
  if (!documentUri || !workspaceRoot) {
    return undefined;
  }

  try {
    const absolutePath = documentUri.startsWith('file://')
      ? fileURLToPath(documentUri)
      : documentUri;
    return path.relative(workspaceRoot, absolutePath).replace(/\\/g, '/');
  } catch {
    return undefined;
  }
}

export function resolveDocumentSchemaSources(params: InitializeParamsLike): {
  schemaPath?: string;
  contentSchemaPath?: string;
} {
  const initialization = params.initializationOptions;
  const workspaceRoot = resolveWorkspaceRoot(params);
  const documentUri = initialization?.documentContext?.uri;
  const documentContent = initialization?.documentContext?.content;
  const documentPath = resolveDocumentPath(documentUri, workspaceRoot);

  const schemaConfigForDocument = findSchemaConfigForDocument(
    documentPath,
    initialization?.schemaPatterns
  );

  const settingSchemaPath = schemaConfigForDocument?.schemaPath ?? initialization?.schemaPath;
  const settingContentSchemaPath =
    schemaConfigForDocument?.contentSchemaPath ?? initialization?.contentSchemaPath;

  const inlineSchemas = documentContent
    ? parseInlineSchemaDirectives(documentContent)
    : { schemaPath: undefined, contentSchemaPath: undefined };

  const rootSchemas = documentContent
    ? extractRootPropertySchemas(documentContent)
    : { templSchema: undefined, contentSchema: undefined };

  return {
    schemaPath: inlineSchemas.schemaPath ?? rootSchemas.templSchema ?? settingSchemaPath,
    contentSchemaPath:
      inlineSchemas.contentSchemaPath ?? rootSchemas.contentSchema ?? settingContentSchemaPath,
  };
}

const schemaLoadingModule = {
  DEFAULT_SCHEMA_LOAD_TIMEOUT_MS,
  extractDocumentSchemaKey,
  findSchemaConfigForDocument,
  loadSchemaSource,
  loadSchemaSourceSync,
  resolveDocumentSchemaSources,
  resolveWorkspaceRoot,
};

export default schemaLoadingModule;
