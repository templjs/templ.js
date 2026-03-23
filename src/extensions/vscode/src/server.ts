import { pathToFileURL } from 'url';
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
import {
  extractDocumentSchemaKey,
  loadSchemaSource,
  loadSchemaSourceSync,
  resolveDocumentSchemaSources,
  resolveWorkspaceRoot,
  type InitializeParamsLike,
  type ServerInitializationOptions,
} from './schema-loading.js';

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
    '.tpl.md',
    '.tpl.json',
    '.tpl.yaml',
    '.tpl.yml',
    '.tpl.html',
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
  return /\.(json|ya?ml)(\?|#|$)/i.test(uri);
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
    ? loadSchemaSourceSync(resolvedSources.schemaPath, storedWorkspaceRoot, uri, {
        cache: schemaFileCache,
      })
    : {};
  const loadedContentResult = resolvedSources.contentSchemaPath
    ? loadSchemaSourceSync(resolvedSources.contentSchemaPath, storedWorkspaceRoot, uri, {
        cache: schemaFileCache,
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

connection.onDidChangeWatchedFiles((event) => {
  const changes = event.changes ?? [];
  const schemaChanged = changes.some((change) => isLikelySchemaUri(change.uri));
  if (!schemaChanged) {
    return;
  }

  trace(
    `schema-like file change detected; reloading schema caches for ${changes.length} change(s)`
  );
  schemaFileCache.clear();

  for (const [uri, text] of documentTextByUri.entries()) {
    const generation = (schemaLoadGenerationByUri.get(uri) ?? 0) + 1;
    schemaLoadGenerationByUri.set(uri, generation);

    void loadSchemasForDocumentContext(
      uri,
      text,
      storedWorkspaceRoot,
      storedInitializationOptions
    ).then(() => {
      if (schemaLoadGenerationByUri.get(uri) !== generation) {
        return;
      }
      publishDiagnosticsForDocument(uri);
    });
  }
});

connection.onInitialized(server.initialized);
connection.onShutdown(server.shutdown);
connection.listen();
