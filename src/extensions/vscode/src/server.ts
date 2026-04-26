import { pathToFileURL } from 'url';
import {
  createConnection,
  createServer,
  createSimpleProjectProvider,
} from '@volar/language-server/node';
import {
  createTempljsLanguagePlugin,
  type DiagnosticOptions,
  type IntellisenseOptions,
} from '@templjs/volar';
import type { Diagnostic } from '@volar/language-service';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  extractDocumentSchemaKey,
  loadSchemaSource,
  resolveDocumentSchemaSources,
  resolveWorkspaceRoot,
  type InitializeParamsLike,
  type ServerInitializationOptions,
} from './schema-loading.js';
import { createServicePlugins } from './service-plugins.js';

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

interface DocumentOpenNotification {
  uri: string;
  text: string;
}

interface DocumentChangeNotification {
  uri: string;
  text: string;
}

interface TextDocumentContentChange {
  text?: string;
  range?: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  rangeLength?: number;
}

interface WatchedFilesNotification {
  changes?: Array<{ uri: string; type: number }>;
}

const DOCUMENT_DID_OPEN_NOTIFICATION = 'templjs/documentDidOpen';
const DOCUMENT_DID_CHANGE_NOTIFICATION = 'templjs/documentDidChange';
const WATCHED_FILES_CHANGED_NOTIFICATION = 'templjs/watchedFilesChanged';

function normalizeOpenNotification(
  event: DocumentOpenNotification | { textDocument?: { uri?: string; text?: string } }
): DocumentOpenNotification | undefined {
  if ('uri' in event && typeof event.uri === 'string' && typeof event.text === 'string') {
    return event;
  }

  const legacy = 'textDocument' in event ? event.textDocument : undefined;
  if (legacy && typeof legacy.uri === 'string' && typeof legacy.text === 'string') {
    return { uri: legacy.uri, text: legacy.text };
  }

  return undefined;
}

function normalizeChangeNotification(
  event:
    | DocumentChangeNotification
    | { textDocument?: { uri?: string }; contentChanges?: TextDocumentContentChange[] },
  currentText?: string
): DocumentChangeNotification | undefined {
  if ('uri' in event && typeof event.uri === 'string' && typeof event.text === 'string') {
    return event;
  }

  const uri = 'textDocument' in event ? event.textDocument?.uri : undefined;
  const changes = 'contentChanges' in event ? event.contentChanges : undefined;
  if (typeof uri !== 'string' || !Array.isArray(changes) || changes.length === 0) {
    return undefined;
  }

  if (!changes.every((change) => typeof change.text === 'string')) {
    return undefined;
  }

  if (changes.every((change) => !change.range)) {
    return { uri, text: changes[changes.length - 1]!.text! };
  }

  if (typeof currentText !== 'string') {
    return undefined;
  }

  let updatedText = currentText;
  for (const change of changes) {
    if (!change.range) {
      updatedText = change.text!;
      continue;
    }

    const document = TextDocument.create(uri, 'plaintext', 0, updatedText);
    const startOffset = document.offsetAt(change.range.start);
    const endOffset = document.offsetAt(change.range.end);
    updatedText = `${updatedText.slice(0, startOffset)}${change.text!}${updatedText.slice(endOffset)}`;
  }

  return { uri, text: updatedText };
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
      getDiagnosticOptions: toDiagnosticOptions,
      workspaceFolder: storedWorkspaceRoot,
      traceYamlDiagnostics: serverTraceMode === 'verbose',
      /* v8 ignore next */
      log: (message) => connection.console.log(message),
    });
  },
};

/** Shared across async schema loads to avoid re-reading and re-parsing files. */
const schemaFileCache = new Map<string, unknown>();

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
  return /\.(md|markdown)\.(templ|tmpl|tpl)$/i.test(uri.split(/[?#]/, 1)[0] ?? uri);
}

function isYamlTemplateUri(uri: string): boolean {
  return /\.ya?ml\.(templ|tmpl|tpl)$/i.test(uri.split(/[?#]/, 1)[0] ?? uri);
}

async function collectServiceDiagnosticsForDocument(
  uri: string,
  _text: string
): Promise<Diagnostic[]> {
  try {
    const project = await server.projects.getProject(uri);
    const languageService = project.getLanguageService();
    const diagnostics = (await languageService.doValidation(uri)) as Diagnostic[];

    if (isYamlTemplateUri(uri) && shouldTrace('verbose')) {
      const context = (languageService as { context?: unknown }).context as
        | {
            language?: {
              files?: {
                get: (targetUri: string) =>
                  | {
                      languageId?: string;
                      generated?: {
                        code?: { id: string; languageId?: string; mappings?: unknown[] };
                      };
                    }
                  | undefined;
              };
            };
            documents?: {
              getVirtualCodeUri?: (sourceFileUri: string, virtualCodeId: string) => string;
              getMaps?: (virtualCode: unknown) => Iterable<unknown>;
            };
            disabledVirtualFileUris?: Set<string>;
          }
        | undefined;

      const sourceFile = context?.language?.files?.get(uri);
      const generatedCode = sourceFile?.generated?.code;
      const virtualUri =
        generatedCode && context?.documents?.getVirtualCodeUri
          ? context.documents.getVirtualCodeUri(uri, generatedCode.id)
          : undefined;
      const mapCount =
        generatedCode && context?.documents?.getMaps
          ? [...context.documents.getMaps(generatedCode)].length
          : 0;
      const yamlCount = diagnostics.filter(
        (diagnostic) =>
          typeof diagnostic.source === 'string' && diagnostic.source.toLowerCase() === 'yaml'
      ).length;

      trace(
        `[templjs-yaml-debug] uri=${uri} diagnostics=${diagnostics.length} yamlDiagnostics=${yamlCount}` +
          ` sourceLanguageId=${sourceFile?.languageId ?? 'none'}` +
          ` hasGenerated=${generatedCode ? 'yes' : 'no'}` +
          ` generatedLanguageId=${generatedCode?.languageId ?? 'none'}` +
          ` generatedMappings=${generatedCode?.mappings?.length ?? 0}` +
          ` virtualUri=${virtualUri ?? 'none'}` +
          ` virtualDisabled=${virtualUri ? (context?.disabledVirtualFileUris?.has(virtualUri) ?? false) : false}` +
          ` mapCount=${mapCount}`,
        'verbose'
      );
    }

    return diagnostics;
  } catch (error) {
    connection.console.log(
      `[templjs] Host diagnostics skipped for ${uri}: ${error instanceof Error ? error.message : String(error)}`
    );
    return [];
  }
}

async function refreshDiagnosticsAfterSchemaLoad(uri: string): Promise<void> {
  try {
    const diagnostics = await collectServiceDiagnosticsForDocument(uri, '');
    connection.sendDiagnostics({ uri, diagnostics });
  } catch (error) {
    connection.console.log(`[templjs] Diagnostics refresh failed for ${uri}: ${String(error)}`);
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

const handleDocumentDidOpen = (
  event: DocumentOpenNotification | { textDocument?: { uri?: string; text?: string } }
) => {
  const normalized = normalizeOpenNotification(event);
  if (!normalized) {
    return;
  }

  const { uri, text } = normalized;
  documentTextByUri.set(uri, text);
  connection.console.log(`[templjs] Opened document: ${uri}`);

  void loadSchemasForDocumentContext(uri, text, storedWorkspaceRoot, storedInitializationOptions)
    .then(() => {
      void refreshDiagnosticsAfterSchemaLoad(uri);
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      connection.console.log(`[templjs] Schema load failed for ${uri}: ${message}`);
      void refreshDiagnosticsAfterSchemaLoad(uri);
    });
};

const handleDocumentDidChange = (
  event:
    | DocumentChangeNotification
    | { textDocument?: { uri?: string }; contentChanges?: Array<{ text?: string }> }
) => {
  const currentText =
    'uri' in event && typeof event.uri === 'string'
      ? documentTextByUri.get(event.uri)
      : 'textDocument' in event && typeof event.textDocument?.uri === 'string'
        ? documentTextByUri.get(event.textDocument.uri)
        : undefined;
  const normalized = normalizeChangeNotification(event, currentText);
  if (!normalized) {
    return;
  }

  const { uri, text: updated } = normalized;
  documentTextByUri.set(uri, updated);

  const newSchemaKey = extractDocumentSchemaKey(updated);
  if (newSchemaKey === schemaKeyByUri.get(uri)) {
    // Schema references unchanged — Volar's own pipeline handles content-change diagnostics.
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
      void refreshDiagnosticsAfterSchemaLoad(uri);
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      connection.console.log(`[templjs] Schema load failed for ${uri}: ${message}`);
    });
};

const handleWatchedFilesChanged = (event: WatchedFilesNotification) => {
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
        void refreshDiagnosticsAfterSchemaLoad(uri);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        connection.console.log(`[templjs] Schema reload failed for ${uri}: ${message}`);
      });
  }
};

const notificationConnection = connection as unknown as {
  onNotification?: (method: string, handler: (event: unknown) => void) => void;
};

/* v8 ignore next */
connection.onDidOpenTextDocument((event) => handleDocumentDidOpen(event));
/* v8 ignore next */
connection.onDidChangeTextDocument((event) => handleDocumentDidChange(event));
/* v8 ignore next */
connection.onDidChangeWatchedFiles((event) => handleWatchedFilesChanged(event));

if (typeof notificationConnection.onNotification === 'function') {
  /* v8 ignore next */
  notificationConnection.onNotification(DOCUMENT_DID_OPEN_NOTIFICATION, (event) =>
    handleDocumentDidOpen(event as DocumentOpenNotification)
  );
  /* v8 ignore next */
  notificationConnection.onNotification(DOCUMENT_DID_CHANGE_NOTIFICATION, (event) =>
    handleDocumentDidChange(event as DocumentChangeNotification)
  );
  /* v8 ignore next */
  notificationConnection.onNotification(WATCHED_FILES_CHANGED_NOTIFICATION, (event) =>
    handleWatchedFilesChanged(event as WatchedFilesNotification)
  );
}

connection.onInitialized(server.initialized);
connection.onShutdown(server.shutdown);
connection.listen();

export const serverTesting = {
  normalizeOpenNotification,
  normalizeChangeNotification,
  refreshRuntimeSchemaOptions,
  getSchemaOptionsForUri,
  isLikelySchemaUri,
  toIntellisenseOptions,
  toDiagnosticOptions,
  isYamlTemplateUri,
  collectServiceDiagnosticsForDocument,
  resetRuntimeState() {
    storedWorkspaceRoot = undefined;
    storedInitializationOptions = undefined;
    serverTraceMode = 'off';
    refreshRuntimeSchemaOptions({});
    schemaOptionsByUri.clear();
    schemaKeyByUri.clear();
    schemaLoadGenerationByUri.clear();
  },
  setStoredWorkspaceRoot(workspaceRoot: string | undefined) {
    storedWorkspaceRoot = workspaceRoot;
  },
  setServerTraceMode(traceMode: TraceMode) {
    serverTraceMode = traceMode;
  },
  setSchemaOptionsForUri(uri: string, options: SchemaRuntimeOptions) {
    schemaOptionsByUri.set(uri, options);
  },
};
