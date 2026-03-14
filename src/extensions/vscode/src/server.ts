import { existsSync, readFileSync } from 'fs';
import * as path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { minimatch } from 'minimatch';
import { getFrontmatterSchemaAliases } from '@templjs/core';
import {
  createConnection,
  createServer,
  createSimpleProjectProvider,
} from '@volar/language-server/node';
import {
  collectDiagnostics,
  createTempljsLanguagePlugin,
  TempljsServicePlugin,
  type DiagnosticOptions,
  type IntellisenseOptions,
  splitSchemaSourceReference,
  resolveSchemaFilePath,
} from '@templjs/volar';

const URL_TIMEOUT_MS = 5000; // 5 second timeout for HTTPS schema downloads

// Write to stderr for debugging server startup
console.error('[templjs-server] Starting instantiation...');

const connection = createConnection();
const server = createServer(connection);
console.error('[templjs-server] Connection and server created');

const servicePlugin = new TempljsServicePlugin();
console.error('[templjs-server] TempljsServicePlugin instantiated successfully');

const documentTextByUri = new Map<string, string>();
let storedWorkspaceRoot: string | undefined;
let storedInitializationOptions: ServerInitializationOptions | undefined;
type SchemaRuntimeOptions = {
  schema?: object;
  schemaUri?: string;
  contentSchema?: object;
  contentSchemaUri?: string;
  contentHash?: string;
};

type TraceMode = 'off' | 'messages' | 'verbose';

const runtimeSchemaOptions: SchemaRuntimeOptions = {};
const schemaOptionsByUri = new Map<string, SchemaRuntimeOptions>();
/** Last extracted schema-key per URI — used to skip reloads when schema refs are unchanged. */
const schemaKeyByUri = new Map<string, string>();
/** Monotonic generation per URI — incremented on each new load to discard stale in-flight results. */
const schemaLoadGenerationByUri = new Map<string, number>();
let serverTraceMode: TraceMode = 'off';

// Trace semantics used by trace(message, level):
// - Default level is 'messages', so trace(...) emits when trace mode is not 'off'.
// - 'messages' level always emits unless serverTraceMode is 'off'.
// - 'verbose' level emits only when serverTraceMode is exactly 'verbose'.
function shouldTrace(level: 'messages' | 'verbose' = 'messages'): boolean {
  if (serverTraceMode === 'off') {
    return false;
  }

  return level === 'messages' || serverTraceMode === 'verbose';
}

function trace(message: string, level: 'messages' | 'verbose' = 'messages'): void {
  if (!shouldTrace(level)) {
    return;
  }

  connection.console.log(`[templjs-trace] ${message}`);
}

function summarizeDuplicateLabels(labels: string[]): string[] {
  const counts = new Map<string, number>();
  for (const label of labels) {
    const key = label.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, total]) => total > 1)
    .map(([label, total]) => `${label}×${total}`)
    .sort((left, right) => left.localeCompare(right));
}

function refreshRuntimeSchemaOptions(nextOptions: SchemaRuntimeOptions): void {
  delete runtimeSchemaOptions.schema;
  delete runtimeSchemaOptions.schemaUri;
  delete runtimeSchemaOptions.contentSchema;
  delete runtimeSchemaOptions.contentSchemaUri;
  delete runtimeSchemaOptions.contentHash;
  Object.assign(runtimeSchemaOptions, nextOptions);
}

function hashTextContent(text: string): string {
  // Lightweight non-cryptographic hash for schema-option cache invalidation.
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `h${(hash >>> 0).toString(16)}`;
}

interface WorkspaceFolderLike {
  uri: string;
}

interface SchemaPatternConfig {
  schemaPath?: string;
  contentSchemaPath?: string;
}

interface ServerInitializationOptions {
  schemaPath?: string;
  contentSchemaPath?: string;
  schemaPatterns?: Record<string, SchemaPatternConfig>;
  traceMode?: TraceMode;
  documentContext?: {
    uri?: string;
    content?: string;
  };
}

interface InitializeParamsLike {
  rootUri?: string | null;
  workspaceFolders?: WorkspaceFolderLike[];
  initializationOptions?: ServerInitializationOptions;
}

interface PositionLike {
  line: number;
  character: number;
}

interface RangeLike {
  start: PositionLike;
  end: PositionLike;
}

interface TextDocumentContentChangeLike {
  text: string;
  range?: RangeLike;
}

type InternalCompletionKind = 'variable' | 'property' | 'keyword' | 'filter';
type LspCompletionKind = 2 | 3 | 6 | 10 | 14;

function mapInternalKindToLsp(kind: InternalCompletionKind | number): LspCompletionKind {
  if (typeof kind === 'number') {
    if (kind === 2 || kind === 3 || kind === 6 || kind === 10 || kind === 14) {
      return kind;
    }

    return 6;
  }

  switch (kind) {
    case 'variable':
      return 6;
    case 'property':
      return 10;
    case 'keyword':
      return 14;
    case 'filter':
      return 3;
  }
}

function resolveWorkspaceRoot(params: InitializeParamsLike): string | undefined {
  const workspaceUri = params.workspaceFolders?.[0]?.uri ?? params.rootUri ?? undefined;
  if (!workspaceUri) {
    return undefined;
  }

  if (workspaceUri.startsWith('file://')) {
    return fileURLToPath(workspaceUri);
  }

  return workspaceUri;
}

type JsonRecord = Record<string, unknown>;

function decodeJsonPointerSegment(segment: string): string {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
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
    let targetFilePath = currentFilePath;
    let targetRoot = currentRoot;

    if (source) {
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

    return isJsonRecord(derefTarget) ? derefTarget : derefRest;
  }

  const next: JsonRecord = {};
  for (const [key, value] of Object.entries(node)) {
    next[key] = dereferenceSchemaNode(value, currentFilePath, currentRoot, cache, seenRefs);
  }
  return next;
}

function findSchemaConfigForDocument(
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

const serverOptions = {
  watchFileExtensions: [
    '.templ.md',
    '.templ.json',
    '.templ.yaml',
    '.templ.yml',
    '.templ.html',
    '.tmpl.md',
    '.tmpl.json',
    '.tmpl.yaml',
    '.tmpl.yml',
    '.tmpl.html',
  ],
  getServicePlugins() {
    return [];
  },
  getLanguagePlugins() {
    return [createTempljsLanguagePlugin()];
  },
};

/** Shared across all loadSchemaSource/loadSchemaSourceSync calls to avoid re-parsing files. */
const schemaFileCache = new Map<string, unknown>();

/**
 * Load schema from path or HTTPS URL with timeout and error handling
 */
async function loadSchemaSource(
  source: string,
  workspaceRoot: string | undefined,
  documentUri?: string
): Promise<{ schema?: object; schemaUri?: string }> {
  const { source: sourcePath, fragment } = splitSchemaSourceReference(source);
  if (!sourcePath) {
    return {};
  }

  // Check if it's a URL (http:// or https://)
  if (sourcePath.startsWith('http://') || sourcePath.startsWith('https://')) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), URL_TIMEOUT_MS);

      const response = await fetch(sourcePath, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        connection.console.log(
          `[templjs] Failed to load schema from URL '${sourcePath}': HTTP ${response.status}`
        );
        return {};
      }

      const schemaContent = await response.text();
      const rootSchema = JSON.parse(schemaContent) as unknown;
      const schema = resolveFragmentSchema(rootSchema, fragment);
      if (!schema) {
        connection.console.log(
          `[templjs] Schema fragment not found in URL '${sourcePath}${fragment ?? ''}'`
        );
        return {};
      }

      const dereferencedSchema = dereferenceSchemaNode(
        schema,
        sourcePath,
        rootSchema,
        new Map<string, unknown>([[sourcePath, rootSchema]]),
        new Set<string>()
      );
      if (!isJsonRecord(dereferencedSchema)) {
        return {};
      }

      connection.console.log(`[templjs] Loaded schema from URL: ${sourcePath}${fragment ?? ''}`);
      return {
        schema: dereferencedSchema,
        schemaUri: sourcePath,
      };
    } catch (urlError) {
      connection.console.log(
        `[templjs] Error loading schema from URL '${sourcePath}': ${
          urlError instanceof Error ? urlError.message : String(urlError)
        }`
      );
      return {};
    }
  }

  // Otherwise treat as filesystem path
  const resolvedPath = resolveSchemaFilePath(sourcePath, workspaceRoot, documentUri);
  if (!resolvedPath) {
    connection.console.log(
      `[templjs] Could not resolve schema path '${sourcePath}' (no workspace root?)`
    );
    return {};
  }

  try {
    const cache = schemaFileCache;
    const rootSchema = loadJsonFromFile(resolvedPath, cache);
    const schema = resolveFragmentSchema(rootSchema, fragment);
    if (!schema) {
      connection.console.log(
        `[templjs] Schema fragment not found in file '${resolvedPath}${fragment ?? ''}'`
      );
      return {};
    }

    const dereferencedSchema = dereferenceSchemaNode(
      schema,
      resolvedPath,
      rootSchema,
      cache,
      new Set<string>()
    );
    if (!isJsonRecord(dereferencedSchema)) {
      return {};
    }

    connection.console.log(`[templjs] Loaded schema from file: ${resolvedPath}${fragment ?? ''}`);
    return {
      schema: dereferencedSchema,
      schemaUri: pathToFileURL(resolvedPath).toString(),
    };
  } catch (error) {
    connection.console.log(
      `[templjs] Error loading schema from path '${resolvedPath}': ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return {};
  }
}

function loadSchemaSourceSync(
  source: string,
  workspaceRoot: string | undefined,
  documentUri?: string
): { schema?: object; schemaUri?: string } {
  const { source: sourcePath, fragment } = splitSchemaSourceReference(source);
  if (!sourcePath) {
    return {};
  }

  // Synchronous path supports filesystem schemas only.
  if (sourcePath.startsWith('http://') || sourcePath.startsWith('https://')) {
    return {};
  }

  const resolvedPath = resolveSchemaFilePath(sourcePath, workspaceRoot, documentUri);
  if (!resolvedPath) {
    return {};
  }

  try {
    const cache = schemaFileCache;
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
    if (!isJsonRecord(dereferencedSchema)) {
      return {};
    }

    return {
      schema: dereferencedSchema,
      schemaUri: pathToFileURL(resolvedPath).toString(),
    };
  } catch {
    return {};
  }
}

/**
 * Parse inline schema directives from template content.
 * Matches patterns like: {{# schema: ./schema.json }} or {{# content-schema: ./content.json }}
 */
function parseSchemaDirective(
  content: string,
  directiveType: 'schema' | 'content-schema' = 'schema'
): string | undefined {
  if (directiveType !== 'schema' && directiveType !== 'content-schema') {
    return undefined;
  }

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

/**
 * Extract frontmatter from markdown/template content and resolve schema paths.
 *
 * Recognised keys (first match wins per slot):
 *   frontmatter schema : $templ-schema | $schema
 *   content schema     : $content-schema | $content_schema
 */
function extractFrontmatterSchemas(content: string): {
  templSchema?: string;
  contentSchema?: string;
} {
  return getFrontmatterSchemaAliases(content);
}

function extractRootPropertySchemas(content: string): {
  templSchema?: string;
  contentSchema?: string;
} {
  const fromFrontmatter = extractFrontmatterSchemas(content);
  const parsedRootObject = parseRootObject(content);

  const templSchema =
    fromFrontmatter.templSchema ??
    getSchemaValueFromRecord(parsedRootObject, ['$templ-schema', '$schema']);
  const contentSchema =
    fromFrontmatter.contentSchema ??
    getSchemaValueFromRecord(parsedRootObject, ['$content-schema', '$content_schema']);

  return { templSchema, contentSchema };
}

/**
 * Returns a stable string key representing the schema references embedded in a document.
 * Two documents with identical keys will resolve the same schema paths, so reloading is unnecessary.
 */
function extractDocumentSchemaKey(content: string): string {
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
    return path.relative(workspaceRoot, absolutePath);
  } catch {
    return undefined;
  }
}

function resolveDocumentSchemaSources(params: InitializeParamsLike): {
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

function getOffsetForPosition(text: string, position: { line: number; character: number }): number {
  let line = 0;
  let offset = 0;

  while (line < position.line && offset < text.length) {
    const newlineIndex = text.indexOf('\n', offset);
    if (newlineIndex === -1) {
      return text.length;
    }
    offset = newlineIndex + 1;
    line += 1;
  }

  return Math.min(offset + position.character, text.length);
}

function applyContentChanges(
  existingText: string,
  changes: TextDocumentContentChangeLike[]
): string {
  let nextText = existingText;

  for (const change of changes) {
    if (!change.range) {
      nextText = change.text;
      continue;
    }

    const startOffset = getOffsetForPosition(nextText, change.range.start);
    const endOffset = getOffsetForPosition(nextText, change.range.end);

    nextText = `${nextText.slice(0, startOffset)}${change.text}${nextText.slice(endOffset)}`;
  }

  return nextText;
}

function getSchemaOptionsForUri(uri: string): SchemaRuntimeOptions {
  return schemaOptionsByUri.get(uri) ?? runtimeSchemaOptions;
}

function ensureSchemaOptionsForUri(uri: string, text: string): SchemaRuntimeOptions {
  const contentHash = hashTextContent(text);
  const existing = schemaOptionsByUri.get(uri);
  if (
    existing &&
    (existing.schema || existing.contentSchema) &&
    existing.contentHash === contentHash
  ) {
    return existing;
  }

  const pseudoParams: InitializeParamsLike = {
    rootUri: storedWorkspaceRoot ? pathToFileURL(storedWorkspaceRoot).toString() : undefined,
    initializationOptions: {
      ...storedInitializationOptions,
      documentContext: {
        uri,
        content: text,
      },
    },
  };

  const resolvedSources = resolveDocumentSchemaSources(pseudoParams);
  const loadedSchemaOptions = resolvedSources.schemaPath
    ? loadSchemaSourceSync(resolvedSources.schemaPath, storedWorkspaceRoot, uri)
    : {};
  const loadedContentResult = resolvedSources.contentSchemaPath
    ? loadSchemaSourceSync(resolvedSources.contentSchemaPath, storedWorkspaceRoot, uri)
    : undefined;

  const schemaOptions: SchemaRuntimeOptions = {
    ...loadedSchemaOptions,
    ...(loadedContentResult
      ? {
          contentSchema: loadedContentResult.schema,
          contentSchemaUri: loadedContentResult.schemaUri,
        }
      : {}),
    contentHash,
  };

  schemaOptionsByUri.set(uri, schemaOptions);
  refreshRuntimeSchemaOptions(schemaOptions);
  return schemaOptions;
}

function toIntellisenseOptions(uri: string): IntellisenseOptions {
  const schemaOptions = getSchemaOptionsForUri(uri);
  return {
    documentUri: uri,
    workspaceRoot: storedWorkspaceRoot,
    schema: schemaOptions.schema,
    schemaUri: schemaOptions.schemaUri,
    contentSchema: schemaOptions.contentSchema,
    contentSchemaUri: schemaOptions.contentSchemaUri,
    debugLog: (message: string, level: 'messages' | 'verbose' = 'messages') => {
      trace(`${uri} ${message}`, level);
    },
  };
}

function toDiagnosticOptions(uri: string): DiagnosticOptions {
  const schemaOptions = getSchemaOptionsForUri(uri);
  return {
    documentUri: uri,
    schema: schemaOptions.schema,
    contentSchema: schemaOptions.contentSchema,
  };
}

function publishDiagnosticsForDocument(uri: string): void {
  const text = documentTextByUri.get(uri);
  if (text === undefined) {
    return;
  }

  try {
    const diagnostics = collectDiagnostics(text, toDiagnosticOptions(uri)).map((diagnostic) => ({
      message: diagnostic.message,
      severity: diagnostic.severity,
      range: diagnostic.range,
      source: diagnostic.source ?? 'templjs',
      code: diagnostic.code,
    }));
    connection.sendDiagnostics({ uri, diagnostics });
  } catch (error) {
    connection.console.log(
      `[templjs] Diagnostics skipped for ${uri}: ${error instanceof Error ? error.message : String(error)}`
    );
    connection.sendDiagnostics({ uri, diagnostics: [] });
  }
}

async function loadSchemasForDocumentContext(
  documentUri: string | undefined,
  documentContent: string | undefined,
  workspaceRoot: string | undefined,
  initOptions: ServerInitializationOptions | undefined
): Promise<SchemaRuntimeOptions> {
  const pseudoParams: InitializeParamsLike = {
    rootUri: workspaceRoot ? pathToFileURL(workspaceRoot).toString() : undefined,
    initializationOptions: {
      ...initOptions,
      documentContext:
        documentUri && documentContent !== undefined
          ? { uri: documentUri, content: documentContent }
          : initOptions?.documentContext,
    },
  };

  const resolvedSources = resolveDocumentSchemaSources(pseudoParams);

  connection.console.log(
    `[templjs] Schema resolution for ${documentUri ?? '(global)'}:` +
      ` schemaPath=${resolvedSources.schemaPath ?? 'none'},` +
      ` contentSchemaPath=${resolvedSources.contentSchemaPath ?? 'none'}`
  );

  const loadedSchemaOptions = resolvedSources.schemaPath
    ? await loadSchemaSource(resolvedSources.schemaPath, workspaceRoot, documentUri)
    : {};

  const loadedContentResult = resolvedSources.contentSchemaPath
    ? await loadSchemaSource(resolvedSources.contentSchemaPath, workspaceRoot, documentUri)
    : undefined;

  const schemaOptions: SchemaRuntimeOptions = {
    ...loadedSchemaOptions,
    ...(loadedContentResult
      ? {
          contentSchema: loadedContentResult.schema,
          contentSchemaUri: loadedContentResult.schemaUri,
        }
      : {}),
    ...(typeof documentContent === 'string'
      ? { contentHash: hashTextContent(documentContent) }
      : {}),
  };

  refreshRuntimeSchemaOptions(schemaOptions);

  if (documentUri) {
    schemaOptionsByUri.set(documentUri, schemaOptions);
  }

  if (!loadedSchemaOptions.schema && !loadedContentResult?.schema) {
    connection.console.log(
      '[templjs] No schemas loaded — completions will use built-in defaults only'
    );
  }

  return schemaOptions;
}

connection.onInitialize(async (params) => {
  const typedParams = params as InitializeParamsLike;

  storedWorkspaceRoot = resolveWorkspaceRoot(typedParams);
  storedInitializationOptions = typedParams.initializationOptions;
  serverTraceMode = typedParams.initializationOptions?.traceMode ?? 'off';

  const activeDocumentUri = typedParams.initializationOptions?.documentContext?.uri;
  const activeDocumentContent = typedParams.initializationOptions?.documentContext?.content;
  if (activeDocumentUri && typeof activeDocumentContent === 'string') {
    documentTextByUri.set(activeDocumentUri, activeDocumentContent);
  }

  await loadSchemasForDocumentContext(
    activeDocumentUri,
    activeDocumentContent,
    storedWorkspaceRoot,
    storedInitializationOptions
  );

  connection.console.log('[templjs] Language server initialized');

  const pluginOptions = runtimeSchemaOptions;

  const initialized = await server.initialize(params, createSimpleProjectProvider, {
    ...serverOptions,
    getLanguagePlugins() {
      return [createTempljsLanguagePlugin(pluginOptions)];
    },
  });

  // Re-register our handlers AFTER server.initialize() so they overwrite
  // Volar's registerLanguageFeatures() registrations made during initialize().
  connection.onCompletion((completionParams) => {
    const startedAt = Date.now();
    trace(
      `completion requested: ${completionParams.textDocument.uri} @ ${completionParams.position.line}:${completionParams.position.character}`
    );
    const completionText = documentTextByUri.get(completionParams.textDocument.uri);
    if (!completionText) {
      trace('completion skipped: document text not found in cache');
      return [];
    }

    ensureSchemaOptionsForUri(completionParams.textDocument.uri, completionText);

    const completionOffset = getOffsetForPosition(completionText, completionParams.position);
    const completions = servicePlugin.getCompletions(
      completionText,
      completionOffset,
      toIntellisenseOptions(completionParams.textDocument.uri)
    );

    const durationMs = Date.now() - startedAt;
    trace(`completion result count=${completions.length} durationMs=${durationMs}`);

    const labels = completions
      .map((item) => item.label)
      .filter((label) => typeof label === 'string');
    const duplicateLabels = summarizeDuplicateLabels(labels);
    if (duplicateLabels.length > 0) {
      trace(`completion duplicate labels: ${duplicateLabels.slice(0, 10).join(', ')}`, 'messages');
    }

    if (labels.length > 0) {
      trace(
        `completion top labels: ${labels
          .slice(0, 8)
          .map((label) => JSON.stringify(label))
          .join(', ')}`,
        'verbose'
      );
    }

    return completions.map((item) => ({
      label: item.label,
      detail: item.detail,
      documentation: item.documentation,
      kind: mapInternalKindToLsp(item.kind),
    }));
  });

  connection.onHover((hoverParams) => {
    const startedAt = Date.now();
    trace(
      `hover requested: ${hoverParams.textDocument.uri} @ ${hoverParams.position.line}:${hoverParams.position.character}`
    );
    const hoverText = documentTextByUri.get(hoverParams.textDocument.uri);
    if (!hoverText) {
      trace('hover skipped: document text not found in cache');
      return null;
    }

    ensureSchemaOptionsForUri(hoverParams.textDocument.uri, hoverText);

    const hoverOffset = getOffsetForPosition(hoverText, hoverParams.position);
    const hover = servicePlugin.getHover(
      hoverText,
      hoverOffset,
      toIntellisenseOptions(hoverParams.textDocument.uri)
    );

    const durationMs = Date.now() - startedAt;
    trace(`hover result=${hover ? 'present' : 'none'} durationMs=${durationMs}`);
    if (hover?.contents?.value) {
      trace(`hover markdown length=${hover.contents.value.length}`, 'verbose');
    }

    return hover;
  });

  connection.onDefinition((definitionParams) => {
    const startedAt = Date.now();
    trace(
      `definition requested: ${definitionParams.textDocument.uri} @ ${definitionParams.position.line}:${definitionParams.position.character}`
    );
    const definitionText = documentTextByUri.get(definitionParams.textDocument.uri);
    if (!definitionText) {
      trace('definition skipped: document text not found in cache');
      return null;
    }

    ensureSchemaOptionsForUri(definitionParams.textDocument.uri, definitionText);

    const definitionOffset = getOffsetForPosition(definitionText, definitionParams.position);

    const definition = servicePlugin.getDefinition(
      definitionText,
      definitionOffset,
      toIntellisenseOptions(definitionParams.textDocument.uri)
    );

    if (definition) {
      const durationMs = Date.now() - startedAt;
      trace(
        `definition resolved via provider: uri=${definition.uri} range=[${definition.range.start.line}:${definition.range.start.character}] durationMs=${durationMs}`
      );
    } else {
      const durationMs = Date.now() - startedAt;
      trace(`definition result=none durationMs=${durationMs}`);
    }

    return definition;
  });

  return {
    ...initialized,
    capabilities: {
      ...(initialized?.capabilities ?? {}),
      textDocumentSync: 2,
      completionProvider: {
        triggerCharacters: ['.', '|'],
      },
      hoverProvider: true,
      definitionProvider: true,
    },
  };
});

connection.onDidOpenTextDocument((event) => {
  const { uri, text } = event.textDocument;
  documentTextByUri.set(uri, text);
  connection.console.log(`[templjs] Opened document: ${uri}`);

  void loadSchemasForDocumentContext(
    uri,
    text,
    storedWorkspaceRoot,
    storedInitializationOptions
  ).then(() => {
    publishDiagnosticsForDocument(uri);
  });
});

connection.onDidChangeTextDocument((event) => {
  const current = documentTextByUri.get(event.textDocument.uri) ?? '';
  const updated = applyContentChanges(
    current,
    event.contentChanges as TextDocumentContentChangeLike[]
  );
  const uri = event.textDocument.uri;
  documentTextByUri.set(uri, updated);

  const newSchemaKey = extractDocumentSchemaKey(updated);
  if (newSchemaKey === schemaKeyByUri.get(uri)) {
    // Schema references unchanged — skip the expensive reload, just re-run diagnostics.
    publishDiagnosticsForDocument(uri);
    return;
  }

  schemaKeyByUri.set(uri, newSchemaKey);
  const generation = (schemaLoadGenerationByUri.get(uri) ?? 0) + 1;
  schemaLoadGenerationByUri.set(uri, generation);

  void loadSchemasForDocumentContext(
    uri,
    updated,
    storedWorkspaceRoot,
    storedInitializationOptions
  ).then(() => {
    if (schemaLoadGenerationByUri.get(uri) !== generation) {
      return; // A newer load was scheduled while this one was in-flight; discard its result.
    }
    publishDiagnosticsForDocument(uri);
  });
});

connection.onInitialized(server.initialized);
connection.onShutdown(server.shutdown);
connection.listen();
