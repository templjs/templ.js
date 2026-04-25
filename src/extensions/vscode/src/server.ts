import { pathToFileURL } from 'url';
import {
  createConnection,
  createServer,
  createSimpleProjectProvider,
} from '@volar/language-server/node';
import {
  collectDiagnostics,
  createTempljsLanguagePlugin,
  type DiagnosticOptions,
  type IntellisenseOptions,
} from '@templjs/volar';
import {
  extractDocumentSchemaKey,
  loadSchemaSource,
  resolveDocumentSchemaSources,
  resolveWorkspaceRoot,
  type InitializeParamsLike,
  type ServerInitializationOptions,
} from './schema-loading.js';
import { createServicePlugins } from './service-plugins.js';
import { createDeterministicDiagnosticsOrchestrator } from './diagnostics-orchestrator.js';

// Write to stderr for debugging server startup
console.error('[templjs-server] Starting instantiation...');

const connection = createConnection();
const server = createServer(connection);
console.error('[templjs-server] Connection and server created');

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

const serverOptions = {
  watchFileExtensions: [
    '.html.templ',
    '.html.tmpl',
    '.html.tpl',
    '.json.templ',
    '.json.tmpl',
    '.json.tpl',
    '.md.templ',
    '.md.tmpl',
    '.md.tpl',
    '.yaml.templ',
    '.yaml.tmpl',
    '.yaml.tpl',
    '.yml.templ',
    '.yml.tmpl',
    '.yml.tpl',
  ],
  getServicePlugins() {
    return createServicePlugins({
      getIntellisenseOptions: toIntellisenseOptions,
      workspaceFolder: storedWorkspaceRoot,
    });
  },
};

/** Shared across all loadSchemaSource/loadSchemaSourceSync calls to avoid re-parsing files. */
const schemaFileCache = new Map<string, unknown>();

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

function isLikelySchemaUri(uri: string): boolean {
  const normalized = uri.split(/[?#]/, 1)[0].toLowerCase();
  if (!/\.(json|ya?ml)$/.test(normalized)) {
    return false;
  }

  const fileName = normalized.split('/').pop() ?? normalized;
  return !/\.(templ|template|tpl|tmpl)\.(json|ya?ml)$/.test(fileName);
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

export function isMdTemplateUri(uri: string): boolean {
  return /\.(md|markdown)\.(templ|tmpl|tpl)($|\?)/i.test(uri);
}

async function collectHostDiagnosticsForDocument(uri: string): Promise<unknown[]> {
  try {
    const project = await server.projects.getProject(uri);
    const languageService = project.getLanguageService();
    return await languageService.doValidation(uri);
  } catch (error) {
    connection.console.log(
      `[templjs] Host diagnostics skipped for ${uri}: ${error instanceof Error ? error.message : String(error)}`
    );
    return [];
  }
}

async function collectLocalDiagnosticsForDocument(uri: string, text: string): Promise<any[]> {
  try {
    return collectDiagnostics(text, toDiagnosticOptions(uri)).map((diagnostic) => ({
      message: diagnostic.message,
      severity: diagnostic.severity,
      range: diagnostic.range,
      source: diagnostic.source ?? 'templjs',
      code: diagnostic.code,
    }));
  } catch (error) {
    connection.console.log(
      `[templjs] Diagnostics skipped for ${uri}: ${error instanceof Error ? error.message : String(error)}`
    );
    return [];
  }
}

const diagnosticsOrchestrator = createDeterministicDiagnosticsOrchestrator<any>({
  debounceMs: 120,
  getDocumentText: (uri) => documentTextByUri.get(uri),
  resolveRevisionKey: (_uri, text) => hashTextContent(text),
  collectLocalDiagnostics: (uri, text) => collectLocalDiagnosticsForDocument(uri, text),
  collectExtendedDiagnostics: (uri) => collectHostDiagnosticsForDocument(uri) as Promise<any[]>,
  publishDiagnostics: (uri, diagnostics) => {
    connection.sendDiagnostics({ uri, diagnostics });
  },
  log: (message) => connection.console.log(message),
});

function refreshDiagnostics(uri: string): void {
  diagnosticsOrchestrator.schedule(uri);
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
    ? await loadSchemaSource(resolvedSources.schemaPath, workspaceRoot, documentUri, {
        cache: schemaFileCache,
        log: (message) => connection.console.log(message),
      })
    : {};

  const loadedContentResult = resolvedSources.contentSchemaPath
    ? await loadSchemaSource(resolvedSources.contentSchemaPath, workspaceRoot, documentUri, {
        cache: schemaFileCache,
        log: (message) => connection.console.log(message),
      })
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

  // Delegate authoring requests to Volar language service from this transport layer.
  // This keeps a single implementation of semantics while ensuring requests are handled.
  connection.onCompletion(async (request, token) => {
    const uri = request.textDocument.uri;
    const languageService = (await server.projects.getProject(uri)).getLanguageService();
    return await languageService.doComplete(uri, request.position, request.context, token);
  });

  connection.onHover(async (request, token) => {
    const uri = request.textDocument.uri;
    const languageService = (await server.projects.getProject(uri)).getLanguageService();
    return await languageService.doHover(uri, request.position, token);
  });

  connection.onDefinition(async (request, token) => {
    const uri = request.textDocument.uri;
    const languageService = (await server.projects.getProject(uri)).getLanguageService();
    return await languageService.findDefinition(uri, request.position, token);
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
    refreshDiagnostics(uri);
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
    refreshDiagnostics(uri);
    return;
  }

  schemaKeyByUri.set(uri, newSchemaKey);
  const generation = (schemaLoadGenerationByUri.get(uri) ?? 0) + 1;
  schemaLoadGenerationByUri.set(uri, generation);

  void loadSchemasForDocumentContext(uri, updated, storedWorkspaceRoot, storedInitializationOptions)
    .then(() => {
      if (schemaLoadGenerationByUri.get(uri) !== generation) {
        return; // A newer load was scheduled while this one was in-flight; discard its result.
      }
      refreshDiagnostics(uri);
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      connection.console.log(`[templjs] Schema load failed for ${uri}: ${message}`);
    });
});

connection.onDidChangeWatchedFiles((event) => {
  const changes = event.changes ?? [];
  const schemaChanged = changes.some((change) => isLikelySchemaUri(change.uri));
  if (!schemaChanged) {
    return;
  }

  trace(
    `schema-like file change detected (${changes.length} file(s)); reloading schemas for ${documentTextByUri.size} cached document(s)`
  );
  schemaFileCache.clear();

  for (const [uri, text] of documentTextByUri.entries()) {
    const generation = (schemaLoadGenerationByUri.get(uri) ?? 0) + 1;
    schemaLoadGenerationByUri.set(uri, generation);

    void loadSchemasForDocumentContext(uri, text, storedWorkspaceRoot, storedInitializationOptions)
      .then(() => {
        if (schemaLoadGenerationByUri.get(uri) !== generation) {
          return;
        }
        refreshDiagnostics(uri);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        connection.console.log(`[templjs] Schema reload failed for ${uri}: ${message}`);
      });
  }
});

connection.onInitialized(server.initialized);
connection.onShutdown(server.shutdown);
connection.listen();
