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
  TempljsServicePlugin,
  type DiagnosticOptions,
  type IntellisenseOptions,
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
};

const runtimeSchemaOptions: SchemaRuntimeOptions = {};
const schemaOptionsByUri = new Map<string, SchemaRuntimeOptions>();

function refreshRuntimeSchemaOptions(nextOptions: SchemaRuntimeOptions): void {
  delete runtimeSchemaOptions.schema;
  delete runtimeSchemaOptions.schemaUri;
  delete runtimeSchemaOptions.contentSchema;
  delete runtimeSchemaOptions.contentSchemaUri;
  Object.assign(runtimeSchemaOptions, nextOptions);
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
  workspaceRoot: string | undefined,
  documentUri?: string
): string | undefined {
  const { source } = splitSchemaSourceReference(schemaPath);

  if (source.startsWith('http://') || source.startsWith('https://')) {
    return source;
  }

  if (path.isAbsolute(source)) {
    return source;
  }

  if (
    (source.startsWith('./') || source.startsWith('../')) &&
    documentUri &&
    documentUri.startsWith('file://')
  ) {
    try {
      const documentFilePath = fileURLToPath(documentUri);
      const documentDirectory = path.dirname(documentFilePath);
      const documentRelativePath = path.resolve(documentDirectory, source);
      if (existsSync(documentRelativePath)) {
        return documentRelativePath;
      }
    } catch {
      // Fall through to workspace-based resolution.
    }
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
    const cache = new Map<string, unknown>();
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

function getFrontmatterSchemaReferenceAtOffset(
  text: string,
  offset: number
): { value: string } | null {
  if (!isOffsetWithinFrontmatter(text, offset)) {
    return null;
  }

  const frontmatterEnd = text.indexOf('\n---', 3);
  if (frontmatterEnd === -1) {
    return null;
  }

  const frontmatterText = text.slice(0, frontmatterEnd);
  const lines = frontmatterText.split('\n');
  let lineStart = 0;

  for (const line of lines) {
    const match = line.match(
      /^(\s*["']?)(\$schema|\$templ-schema|\$content-schema|\$content_schema)(["']?\s*:\s*["']?)([^"'\n#]+)(.*)$/
    );
    if (match) {
      const [, prefix, key, separator, rawValue] = match;
      const value = rawValue.trim();
      const keyStart = lineStart + prefix.length;
      const keyEnd = keyStart + key.length;
      const valueStart = keyEnd + separator.length;
      const valueEnd = valueStart + value.length;

      if (
        (offset >= keyStart && offset <= keyEnd) ||
        (offset >= valueStart && offset <= valueEnd)
      ) {
        return { value };
      }
    }

    lineStart += line.length + 1;
  }

  return null;
}

function getFrontmatterKeyValueAtOffset(
  text: string,
  offset: number
): { key: string; valueToken: string } | null {
  if (!isOffsetWithinFrontmatter(text, offset)) {
    return null;
  }

  const lineStart = text.lastIndexOf('\n', Math.max(0, offset - 1)) + 1;
  const nextNewline = text.indexOf('\n', offset);
  const lineEnd = nextNewline === -1 ? text.length : nextNewline;
  const line = text.slice(lineStart, lineEnd);

  const match = line.match(/^(\s*["']?)([A-Za-z_$][\w$-]*)(["']?\s*:\s*)(.+)$/);
  if (!match) {
    return null;
  }

  const [, prefix, key, separator, rawValue] = match;
  const keyStart = lineStart + prefix.length;
  const keyEnd = keyStart + key.length;
  const valueStart = keyEnd + separator.length;
  if (offset < valueStart) {
    return null;
  }

  const valueText = rawValue.trim().replace(/^['"]|['"]$/g, '');
  if (!valueText) {
    return null;
  }

  return { key, valueToken: valueText };
}

function getPathRegistryKeysFromSchema(schema: unknown): Set<string> {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return new Set();
  }

  const properties = (schema as Record<string, unknown>).properties;
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
    return new Set();
  }

  const keys = new Set<string>();
  for (const [key, value] of Object.entries(properties as Record<string, unknown>)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      continue;
    }

    const property = value as Record<string, unknown>;
    const format = typeof property.format === 'string' ? property.format.toLowerCase() : '';
    const description =
      typeof property.description === 'string' ? property.description.toLowerCase() : '';

    if (
      format === 'uri' ||
      format === 'uri-reference' ||
      key.toLowerCase().includes('path') ||
      key.toLowerCase().includes('schema') ||
      key.toLowerCase().includes('file') ||
      description.includes('path') ||
      description.includes('file')
    ) {
      keys.add(key);
    }
  }

  return keys;
}

function isLikelyPathValue(token: string): boolean {
  if (!token) {
    return false;
  }

  if (token.startsWith('http://') || token.startsWith('https://') || token.startsWith('file://')) {
    return true;
  }

  return /\//.test(token) || /\.[A-Za-z0-9]+($|[#?])/.test(token);
}

function getPathValueDefinition(uri: string, text: string, offset: number): { uri: string } | null {
  const keyValue = getFrontmatterKeyValueAtOffset(text, offset);
  if (!keyValue) {
    return null;
  }

  const schemaOptions = getSchemaOptionsForUri(uri);
  const registryKeys = new Set<string>([
    '$schema',
    '$templ-schema',
    '$content-schema',
    '$content_schema',
    ...getPathRegistryKeysFromSchema(schemaOptions.schema),
    ...getPathRegistryKeysFromSchema(schemaOptions.contentSchema),
  ]);

  if (!registryKeys.has(keyValue.key)) {
    return null;
  }

  if (!isLikelyPathValue(keyValue.valueToken)) {
    return null;
  }

  const { source } = splitSchemaSourceReference(keyValue.valueToken);
  const resolved = resolveSchemaFilePath(source, storedWorkspaceRoot, uri);
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

function getSchemaPathDefinition(text: string, offset: number): { uri: string } | null {
  if (!isOffsetWithinFrontmatter(text, offset)) {
    return null;
  }

  const schemaRef = getFrontmatterSchemaReferenceAtOffset(text, offset);
  let token = schemaRef?.value;

  if (!token) {
    const tokenRef = getTokenAtOffset(text, offset);
    if (!tokenRef) {
      return null;
    }

    token = tokenRef.token;
  }

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

function findMatchingBracket(text: string, start: number, open: string, close: string): number {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === open) {
      depth += 1;
      continue;
    }

    if (char === close) {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function skipWhitespace(text: string, index: number): number {
  let cursor = index;
  while (cursor < text.length && /\s/.test(text[cursor])) {
    cursor += 1;
  }
  return cursor;
}

function findPropertyInRange(
  text: string,
  key: string,
  rangeStart: number,
  rangeEnd: number
): { keyOffset: number; valueStart: number; valueEnd: number } | null {
  const quotedKey = `"${key}"`;
  let cursor = Math.max(0, rangeStart);

  while (cursor < rangeEnd) {
    const keyOffset = text.indexOf(quotedKey, cursor);
    if (keyOffset === -1 || keyOffset >= rangeEnd) {
      return null;
    }

    const colonIndex = skipWhitespace(text, keyOffset + quotedKey.length);
    if (text[colonIndex] !== ':') {
      cursor = keyOffset + quotedKey.length;
      continue;
    }

    const valueStart = skipWhitespace(text, colonIndex + 1);
    if (valueStart >= rangeEnd) {
      return null;
    }

    const valueStartChar = text[valueStart];
    if (valueStartChar === '{') {
      const end = findMatchingBracket(text, valueStart, '{', '}');
      if (end !== -1) {
        return { keyOffset, valueStart, valueEnd: end + 1 };
      }
    }

    if (valueStartChar === '[') {
      const end = findMatchingBracket(text, valueStart, '[', ']');
      if (end !== -1) {
        return { keyOffset, valueStart, valueEnd: end + 1 };
      }
    }

    let valueEnd = valueStart;
    while (valueEnd < rangeEnd && !/[\n,}]/.test(text[valueEnd])) {
      valueEnd += 1;
    }

    return { keyOffset, valueStart, valueEnd };
  }

  return null;
}

function findBestPropertyOffset(
  schemaText: string,
  path: string,
  pathKind: 'property' | 'value' = 'property',
  valueToken?: string
): number {
  const segments = path
    .split('.')
    .map((segment) => segment.replace(/\[[^\]]+\]/g, ''))
    .filter((segment) => segment.length > 0);

  if (segments.length === 0) {
    return 0;
  }

  let rangeStart = 0;
  let rangeEnd = schemaText.length;
  let matched: { keyOffset: number; valueStart: number; valueEnd: number } | null = null;

  for (const segment of segments) {
    matched = findPropertyInRange(schemaText, segment, rangeStart, rangeEnd);
    if (!matched) {
      break;
    }
    rangeStart = matched.valueStart;
    rangeEnd = matched.valueEnd;
  }

  if (!matched) {
    return 0;
  }

  if (pathKind === 'value' && valueToken) {
    const quotedValue = `"${valueToken}"`;
    const valueIndex = schemaText.indexOf(quotedValue, matched.valueStart);
    if (valueIndex !== -1 && valueIndex < matched.valueEnd) {
      return valueIndex;
    }
  }

  return matched.keyOffset;
}

function getDefinitionRangeForSchemaUri(
  definitionUri: string,
  variablePath: string,
  pathKind: 'property' | 'value' = 'property',
  valueToken?: string
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
    const startOffset = findBestPropertyOffset(schemaText, variablePath, pathKind, valueToken);
    const endOffset = Math.min(
      schemaText.length,
      startOffset + Math.max((valueToken ?? variablePath.split('.').pop() ?? '').length + 2, 3)
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

function ensureSchemaOptionsForUri(uri: string, text: string): SchemaRuntimeOptions {
  const existing = schemaOptionsByUri.get(uri);
  if (existing && (existing.schema || existing.contentSchema)) {
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
  };

  schemaOptionsByUri.set(uri, schemaOptions);
  refreshRuntimeSchemaOptions(schemaOptions);
  return schemaOptions;
}

function toIntellisenseOptions(uri: string): IntellisenseOptions {
  const schemaOptions = getSchemaOptionsForUri(uri);
  return {
    documentUri: uri,
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
    connection.console.log(
      `[templjs] Completion requested: ${completionParams.textDocument.uri} @ ${completionParams.position.line}:${completionParams.position.character}`
    );
    const completionText = documentTextByUri.get(completionParams.textDocument.uri);
    if (!completionText) {
      connection.console.log('[templjs] Completion skipped: document text not found in cache');
      return [];
    }

    ensureSchemaOptionsForUri(completionParams.textDocument.uri, completionText);

    const completionOffset = getOffsetForPosition(completionText, completionParams.position);
    const completions = servicePlugin.getCompletions(
      completionText,
      completionOffset,
      toIntellisenseOptions(completionParams.textDocument.uri)
    );

    connection.console.log(`[templjs] Completion result count: ${completions.length}`);

    return completions.map((item) => ({
      label: item.label,
      detail: item.detail,
      documentation: item.documentation,
      kind: item.kind as any,
    }));
  });

  connection.onHover((hoverParams) => {
    connection.console.log(
      `[templjs] Hover requested: ${hoverParams.textDocument.uri} @ ${hoverParams.position.line}:${hoverParams.position.character}`
    );
    const hoverText = documentTextByUri.get(hoverParams.textDocument.uri);
    if (!hoverText) {
      connection.console.log('[templjs] Hover skipped: document text not found in cache');
      return null;
    }

    ensureSchemaOptionsForUri(hoverParams.textDocument.uri, hoverText);

    const hoverOffset = getOffsetForPosition(hoverText, hoverParams.position);
    const hover = servicePlugin.getHover(
      hoverText,
      hoverOffset,
      toIntellisenseOptions(hoverParams.textDocument.uri)
    );

    connection.console.log(`[templjs] Hover result: ${hover ? 'present' : 'none'}`);
    return hover as any;
  });

  connection.onDefinition((definitionParams) => {
    connection.console.log(
      `[templjs] Definition requested: ${definitionParams.textDocument.uri} @ ${definitionParams.position.line}:${definitionParams.position.character}`
    );
    const definitionText = documentTextByUri.get(definitionParams.textDocument.uri);
    if (!definitionText) {
      connection.console.log('[templjs] Definition skipped: document text not found in cache');
      return null;
    }

    ensureSchemaOptionsForUri(definitionParams.textDocument.uri, definitionText);

    const definitionOffset = getOffsetForPosition(definitionText, definitionParams.position);

    const pathValueDefinition = getPathValueDefinition(
      definitionParams.textDocument.uri,
      definitionText,
      definitionOffset
    );
    if (pathValueDefinition) {
      return {
        uri: pathValueDefinition.uri,
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 0 },
        },
      };
    }

    const schemaPathDefinition = getSchemaPathDefinition(definitionText, definitionOffset);
    if (schemaPathDefinition) {
      return {
        uri: schemaPathDefinition.uri,
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 0 },
        },
      };
    }

    const definition = servicePlugin.getDefinitionWithRangeResolver(
      definitionText,
      definitionOffset,
      toIntellisenseOptions(definitionParams.textDocument.uri),
      (uri: string, path: string, pathKind?: 'property' | 'value', valueToken?: string) =>
        getDefinitionRangeForSchemaUri(uri, path, pathKind, valueToken)
    );

    if (definition) {
      connection.console.log(
        `[templjs] Definition: uri=${definition.uri} range=[${definition.range.start.line}:${definition.range.start.character}]`
      );
    } else {
      connection.console.log('[templjs] Definition result: none');
    }

    return definition as any;
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

connection.onInitialized(server.initialized);
connection.onShutdown(server.shutdown);
connection.listen();
