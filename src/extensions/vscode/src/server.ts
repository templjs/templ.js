import { existsSync, readFileSync } from 'fs';
import * as path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { minimatch } from 'minimatch';
import matter from 'gray-matter';
import {
  createConnection,
  createServer,
  createSimpleProjectProvider,
} from '@volar/language-server/node';
import {
  collectDiagnostics,
  createTempljsLanguagePlugin,
  IntellisenseProvider,
  resolveScopedPathInText,
  type DiagnosticOptions,
  type IntellisenseOptions,
} from '@templjs/volar';

const URL_TIMEOUT_MS = 5000; // 5 second timeout for HTTPS schema downloads

const connection = createConnection();
const server = createServer(connection);
const intellisenseProvider = new IntellisenseProvider();
const documentTextByUri = new Map<string, string>();
let storedWorkspaceRoot: string | undefined;
let storedInitializationOptions: ServerInitializationOptions | undefined;
type SchemaRuntimeOptions = {
  schema?: object;
  schemaUri?: string;
  contentSchema?: object;
  contentSchemaUri?: string;
};

let runtimeSchemaOptions: SchemaRuntimeOptions = {};
const schemaOptionsByUri = new Map<string, SchemaRuntimeOptions>();

const COMPLETION_KIND = {
  Function: 3,
  Variable: 6,
  Keyword: 14,
} as const;

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

interface SchemaSourceReference {
  source: string;
  fragment?: string;
}

type JsonRecord = Record<string, unknown>;

function splitSchemaSourceReference(rawSource: string): SchemaSourceReference {
  const trimmed = rawSource.trim();
  const hashIndex = trimmed.indexOf('#');
  if (hashIndex === -1) {
    return { source: trimmed };
  }

  const source = trimmed.slice(0, hashIndex).trim();
  const fragment = trimmed.slice(hashIndex);
  return {
    source,
    fragment: fragment.length > 0 ? fragment : undefined,
  };
}

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

function resolveSchemaFilePath(
  schemaPath: string,
  workspaceRoot: string | undefined
): string | undefined {
  const { source } = splitSchemaSourceReference(schemaPath);

  if (source.startsWith('http://') || source.startsWith('https://')) {
    return source;
  }

  if (path.isAbsolute(source)) {
    return source;
  }

  if (!workspaceRoot) {
    return undefined;
  }

  return path.resolve(workspaceRoot, source);
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

/**
 * Load schema from path or HTTPS URL with timeout and error handling
 */
async function loadSchemaSource(
  source: string,
  workspaceRoot: string | undefined
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
  const resolvedPath = resolveSchemaFilePath(sourcePath, workspaceRoot);
  if (!resolvedPath) {
    connection.console.log(
      `[templjs] Could not resolve schema path '${sourcePath}' (no workspace root?)`
    );
    return {};
  }

  try {
    const cache = new Map<string, unknown>();
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

/**
 * Parse inline schema directives from template content.
 * Matches patterns like: {{# schema: ./schema.json }} or {{# content-schema: ./content.json }}
 */
function parseSchemaDirective(
  content: string,
  directiveType: 'schema' | 'content-schema' = 'schema'
): string | undefined {
  const pattern = new RegExp(`{{#\\s*${directiveType}:\\s*([^\\s}]+)\\s*}}`, 'i');
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
    // YAML frontmatter is parsed separately via gray-matter.
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
  if (!matter.test(content)) {
    return {};
  }

  try {
    const parsed = matter(content);
    const data = (parsed.data ?? {}) as Record<string, unknown>;

    const templSchemaValue = data['$templ-schema'] ?? data.$schema;
    const contentSchemaValue = data['$content-schema'] ?? data.$content_schema;

    return {
      templSchema:
        typeof templSchemaValue === 'string' && templSchemaValue.trim().length > 0
          ? templSchemaValue.trim()
          : undefined,
      contentSchema:
        typeof contentSchemaValue === 'string' && contentSchemaValue.trim().length > 0
          ? contentSchemaValue.trim()
          : undefined,
    };
  } catch (error) {
    connection.console.log(
      `[templjs] Failed to parse frontmatter: ${error instanceof Error ? error.message : String(error)}`
    );
    return {};
  }
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

function isSchemaPathCharacter(character: string): boolean {
  return /[A-Za-z0-9_./:#$~+-]/.test(character);
}

function getTokenAtOffset(
  text: string,
  offset: number
): { token: string; start: number; end: number } | undefined {
  if (offset < 0 || offset > text.length) {
    return undefined;
  }

  let start = offset;
  let end = offset;

  if (start > 0 && !isSchemaPathCharacter(text[start]) && isSchemaPathCharacter(text[start - 1])) {
    start -= 1;
    end -= 1;
  }

  while (start > 0 && isSchemaPathCharacter(text[start - 1])) {
    start -= 1;
  }
  while (end < text.length && isSchemaPathCharacter(text[end])) {
    end += 1;
  }

  if (end <= start) {
    return undefined;
  }

  const token = text.slice(start, end).trim();
  if (!token) {
    return undefined;
  }

  return { token, start, end };
}

function isOffsetWithinFrontmatter(text: string, offset: number): boolean {
  if (!matter.test(text)) {
    return false;
  }

  try {
    const parsed = matter(text);
    const frontmatterLength = text.length - parsed.content.length;
    return frontmatterLength > 0 && offset >= 0 && offset < frontmatterLength;
  } catch {
    return false;
  }
}

function getSchemaPathDefinition(text: string, offset: number): { uri: string } | null {
  if (!isOffsetWithinFrontmatter(text, offset)) {
    return null;
  }

  const tokenRef = getTokenAtOffset(text, offset);
  if (!tokenRef) {
    return null;
  }

  let token = tokenRef.token;

  const keyToSchemaValue = (key: string): string | undefined => {
    const trimmedKey = key.replace(/^"|"$/g, '');
    if (
      trimmedKey === '$schema' ||
      trimmedKey === '$templ-schema' ||
      trimmedKey === '$content_schema' ||
      trimmedKey === '$content-schema'
    ) {
      const extracted = extractFrontmatterSchemas(text);
      if (trimmedKey === '$schema' || trimmedKey === '$templ-schema') {
        return extracted.templSchema;
      }
      return extracted.contentSchema;
    }
    return undefined;
  };

  token = keyToSchemaValue(token) ?? token;
  if (!token.includes('.json') && !token.startsWith('http://') && !token.startsWith('https://')) {
    return null;
  }

  const { source: tokenSource } = splitSchemaSourceReference(token);
  const resolved = resolveSchemaFilePath(tokenSource, storedWorkspaceRoot);
  if (!resolved) {
    return null;
  }

  if (resolved.startsWith('http://') || resolved.startsWith('https://')) {
    return { uri: resolved };
  }

  if (!existsSync(resolved)) {
    return null;
  }

  return { uri: pathToFileURL(resolved).toString() };
}

function getPositionForOffset(text: string, offset: number): PositionLike {
  const safeOffset = Math.max(0, Math.min(offset, text.length));
  let line = 0;
  let lineStart = 0;

  for (let index = 0; index < safeOffset; index += 1) {
    if (text[index] === '\n') {
      line += 1;
      lineStart = index + 1;
    }
  }

  return {
    line,
    character: safeOffset - lineStart,
  };
}

function getJsonPropertyIndex(text: string, key: string, fromIndex = 0): number {
  return text.indexOf(`"${key}"`, fromIndex);
}

function findBestPropertyOffset(schemaText: string, path: string): number {
  const segments = path
    .split('.')
    .map((segment) => segment.replace(/\[[^\]]+\]/g, ''))
    .filter((segment) => segment.length > 0);

  if (segments.length === 0) {
    return 0;
  }

  let cursor = 0;
  for (const segment of segments) {
    const index = getJsonPropertyIndex(schemaText, segment, cursor);
    if (index === -1) {
      break;
    }
    cursor = index + 1;
  }

  const fallback = getJsonPropertyIndex(schemaText, segments[segments.length - 1], 0);
  if (fallback !== -1) {
    return fallback;
  }

  return 0;
}

function getDefinitionRangeForSchemaUri(
  definitionUri: string,
  variablePath: string
): { start: PositionLike; end: PositionLike } {
  if (!definitionUri.startsWith('file://')) {
    return {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 0 },
    };
  }

  try {
    const schemaFilePath = fileURLToPath(definitionUri);
    const schemaText = readFileSync(schemaFilePath, 'utf-8');
    const startOffset = findBestPropertyOffset(schemaText, variablePath);
    const endOffset = Math.min(
      schemaText.length,
      startOffset + variablePath.split('.').pop()!.length + 2
    );

    return {
      start: getPositionForOffset(schemaText, startOffset),
      end: getPositionForOffset(schemaText, endOffset),
    };
  } catch {
    return {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 0 },
    };
  }
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

function toIntellisenseOptions(uri: string): IntellisenseOptions {
  const schemaOptions = getSchemaOptionsForUri(uri);
  return {
    schema: schemaOptions.schema,
    schemaUri: schemaOptions.schemaUri,
    contentSchema: schemaOptions.contentSchema,
    contentSchemaUri: schemaOptions.contentSchemaUri,
  };
}

function toDiagnosticOptions(uri: string): DiagnosticOptions {
  const schemaOptions = getSchemaOptionsForUri(uri);
  return {
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
    ? await loadSchemaSource(resolvedSources.schemaPath, workspaceRoot)
    : {};

  const loadedContentResult = resolvedSources.contentSchemaPath
    ? await loadSchemaSource(resolvedSources.contentSchemaPath, workspaceRoot)
    : undefined;

  const schemaOptions: SchemaRuntimeOptions = {
    ...loadedSchemaOptions,
    ...(loadedContentResult
      ? {
          contentSchema: loadedContentResult.schema,
          contentSchemaUri: loadedContentResult.schemaUri,
        }
      : {}),
  };

  runtimeSchemaOptions = schemaOptions;

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

  void loadSchemasForDocumentContext(
    uri,
    updated,
    storedWorkspaceRoot,
    storedInitializationOptions
  ).then(() => {
    publishDiagnosticsForDocument(uri);
  });
});

connection.onCompletion((params) => {
  const text = documentTextByUri.get(params.textDocument.uri);
  if (!text) {
    return [];
  }

  const offset = getOffsetForPosition(text, params.position);
  const completions = intellisenseProvider.getCompletions(
    text,
    offset,
    toIntellisenseOptions(params.textDocument.uri)
  );

  return completions.map((item) => ({
    label: item.label,
    detail: item.detail,
    documentation: item.documentation,
    kind:
      item.kind === 'property' || item.kind === 'variable'
        ? COMPLETION_KIND.Variable
        : item.kind === 'filter'
          ? COMPLETION_KIND.Function
          : COMPLETION_KIND.Keyword,
  }));
});

connection.onHover((params) => {
  const text = documentTextByUri.get(params.textDocument.uri);
  if (!text) {
    return null;
  }

  const offset = getOffsetForPosition(text, params.position);
  const hover = intellisenseProvider.getHover(
    text,
    offset,
    toIntellisenseOptions(params.textDocument.uri)
  );
  if (!hover) {
    return null;
  }

  return {
    contents: {
      kind: 'markdown',
      value: hover.contents,
    },
  };
});

connection.onDefinition((params) => {
  const text = documentTextByUri.get(params.textDocument.uri);
  if (!text) {
    return null;
  }

  const offset = getOffsetForPosition(text, params.position);
  const schemaPathDefinition = getSchemaPathDefinition(text, offset);
  if (schemaPathDefinition) {
    return {
      uri: schemaPathDefinition.uri,
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
      },
    };
  }

  const definition = intellisenseProvider.getDefinition(
    text,
    offset,
    toIntellisenseOptions(params.textDocument.uri)
  );
  if (!definition) {
    return null;
  }

  // Resolve alias paths (e.g. `relationship.target` → `relationships[0].target`)
  // so findBestPropertyOffset can locate the correct key in the schema JSON.
  const resolvedPath = resolveScopedPathInText(text, definition.path, offset);
  connection.console.log(
    `[templjs] Definition: raw="${definition.path}" resolved="${resolvedPath}" uri=${definition.uri}`
  );
  const definitionRange = getDefinitionRangeForSchemaUri(definition.uri, resolvedPath);

  return {
    uri: definition.uri,
    range: definitionRange,
  };
});

connection.onInitialized(server.initialized);
connection.onShutdown(server.shutdown);
connection.listen();
