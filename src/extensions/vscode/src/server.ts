import { dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import {
  createConnection,
  createServer,
  createSimpleProjectProvider,
} from '@volar/language-server/node';
import { createTempljsLanguagePlugin } from '@templjs/volar';
import type { Diagnostic } from '@volar/language-service';
import {
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

let storedWorkspaceRoot: string | undefined;
let storedInitializationOptions: ServerInitializationOptions | undefined;

type TraceMode = 'off' | 'messages' | 'verbose';

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
      workspaceFolder: storedWorkspaceRoot,
      initializationOptions: storedInitializationOptions,
      traceYamlDiagnostics: serverTraceMode === 'verbose',
      /* v8 ignore next */
      log: (message) => connection.console.log(message),
    });
  },
};

function isLikelySchemaUri(uri: string): boolean {
  const normalized = uri.split(/[?#]/, 1)[0].toLowerCase();
  if (!/\.(json|ya?ml)$/.test(normalized)) {
    return false;
  }

  const fileName = normalized.split('/').pop() ?? normalized;
  return !/\.(templ|template|tpl|tmpl)\.(json|ya?ml)$/.test(fileName);
}

export function isMdTemplateUri(uri: string): boolean {
  return /\.(md|markdown)\.(templ|tmpl|tpl)$/i.test(uri.split(/[?#]/, 1)[0] ?? uri);
}

function isYamlTemplateUri(uri: string): boolean {
  return /\.ya?ml\.(templ|tmpl|tpl)$/i.test(uri.split(/[?#]/, 1)[0] ?? uri);
}

function deriveWorkspaceRootFromDocumentUri(uri: string | undefined): string | undefined {
  if (!uri || !uri.startsWith('file://')) {
    return undefined;
  }

  try {
    return dirname(fileURLToPath(uri));
  } catch {
    return undefined;
  }
}

async function collectServiceDiagnosticsForDocument(
  uri: string,
  _text: string
): Promise<Diagnostic[]> {
  try {
    trace(`[diag] start uri=${uri}`, 'verbose');
    const project = await server.projects.getProject(uri);
    trace(`[diag] project resolved uri=${uri}`, 'verbose');
    const languageService = project.getLanguageService();
    trace(`[diag] language service resolved uri=${uri}`, 'verbose');
    const context = (languageService as { context?: unknown }).context as
      | {
          language?: {
            files?: {
              get: (targetUri: string) =>
                | {
                    id?: string;
                    languageId?: string;
                    generated?: {
                      code?: { id: string; languageId?: string; mappings?: unknown[] };
                    };
                    snapshot?: { getLength?: () => number };
                  }
                | undefined;
            };
          };
          documents?: {
            getVirtualCodeUri?: (sourceFileUri: string, virtualCodeId: string) => string;
            getVirtualCodeByUri?: (targetUri: string) => [
              { id?: string; languageId?: string } | undefined,
              (
                | {
                    id?: string;
                    languageId?: string;
                    generated?: {
                      code?: { id: string; languageId?: string; mappings?: unknown[] };
                    };
                    snapshot?: { getLength?: () => number };
                  }
                | undefined
              ),
            ];
            getMaps?: (virtualCode: unknown) => Iterable<unknown>;
          };
          disabledVirtualFileUris?: Set<string>;
        }
      | undefined;

    if (shouldTrace('verbose')) {
      const sourceFile = context?.language?.files?.get(uri);
      const virtualLookup = context?.documents?.getVirtualCodeByUri?.(uri);
      const virtualCode = virtualLookup?.[0];
      const mappedSourceFile = virtualLookup?.[1];
      const generatedCode = sourceFile?.generated?.code ?? mappedSourceFile?.generated?.code;
      const virtualUri =
        generatedCode && context?.documents?.getVirtualCodeUri
          ? context.documents.getVirtualCodeUri(uri, generatedCode.id)
          : undefined;
      const mapCount =
        generatedCode && context?.documents?.getMaps
          ? [...context.documents.getMaps(generatedCode)].length
          : 0;

      trace(
        `[diag-state] uri=${uri}` +
          ` sourceFile=${sourceFile ? 'yes' : 'no'}` +
          ` sourceLanguageId=${sourceFile?.languageId ?? 'none'}` +
          ` sourceSnapshotLength=${sourceFile?.snapshot?.getLength?.() ?? -1}` +
          ` virtualLookupCode=${virtualCode?.id ?? 'none'}` +
          ` virtualLookupLanguage=${virtualCode?.languageId ?? 'none'}` +
          ` mappedSourceId=${mappedSourceFile?.id ?? 'none'}` +
          ` mappedSourceLanguage=${mappedSourceFile?.languageId ?? 'none'}` +
          ` generatedCode=${generatedCode?.id ?? 'none'}` +
          ` generatedLanguage=${generatedCode?.languageId ?? 'none'}` +
          ` generatedMappings=${generatedCode?.mappings?.length ?? 0}` +
          ` virtualUri=${virtualUri ?? 'none'}` +
          ` virtualDisabled=${virtualUri ? (context?.disabledVirtualFileUris?.has(virtualUri) ?? false) : false}` +
          ` mapCount=${mapCount}`,
        'verbose'
      );
    }

    const diagnostics = (await languageService.doValidation(uri)) as Diagnostic[];
    trace(`[diag] doValidation uri=${uri} count=${diagnostics.length}`, 'verbose');

    if (isYamlTemplateUri(uri) && shouldTrace('verbose')) {
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
    trace(
      `[diag] error uri=${uri} message=${error instanceof Error ? error.message : String(error)}`,
      'verbose'
    );
    connection.console.log(
      `[templjs] Host diagnostics skipped for ${uri}: ${error instanceof Error ? error.message : String(error)}`
    );
    return [];
  }
}

connection.onInitialize(async (params) => {
  const typedParams = params as InitializeParamsLike;
  const activeDocumentUri = typedParams.initializationOptions?.documentContext?.uri;
  const derivedWorkspaceRoot = deriveWorkspaceRootFromDocumentUri(activeDocumentUri);

  storedWorkspaceRoot = resolveWorkspaceRoot(typedParams) ?? derivedWorkspaceRoot;
  const initializeRootUri =
    typedParams.rootUri ??
    (storedWorkspaceRoot ? pathToFileURL(storedWorkspaceRoot).toString() : undefined);
  const initializeParams =
    initializeRootUri && !typedParams.rootUri
      ? {
          ...params,
          rootUri: initializeRootUri,
          rootPath: undefined,
        }
      : params;

  storedInitializationOptions = typedParams.initializationOptions;
  serverTraceMode = typedParams.initializationOptions?.traceMode ?? 'off';

  trace(
    `[init] input rootUri=${typedParams.rootUri ?? 'null'} activeDocumentUri=${activeDocumentUri ?? 'none'} derivedWorkspaceRoot=${derivedWorkspaceRoot ?? 'none'} resolvedWorkspaceRoot=${storedWorkspaceRoot ?? 'none'} initializeRootUri=${initializeRootUri ?? 'none'}`,
    'verbose'
  );

  const activeDocumentContent = typedParams.initializationOptions?.documentContext?.content;
  if (activeDocumentUri && typeof activeDocumentContent === 'string') {
    trace(`[init] active document provided uri=${activeDocumentUri}`, 'verbose');
  }

  connection.console.log('[templjs] Language server initialized');

  const initialized = await server.initialize(initializeParams, createSimpleProjectProvider, {
    ...serverOptions,
    getLanguagePlugins() {
      return [createTempljsLanguagePlugin({})];
    },
  });

  // Delegate authoring requests to Volar language service from this transport layer.
  // This keeps a single implementation of semantics while ensuring requests are handled.
  connection.onCompletion(async (request, token) => {
    const uri = request.textDocument.uri;
    trace(`[authoring] completion uri=${uri}`, 'verbose');
    const languageService = (await server.projects.getProject(uri)).getLanguageService();
    return await languageService.doComplete(uri, request.position, request.context, token);
  });

  connection.onHover(async (request, token) => {
    const uri = request.textDocument.uri;
    trace(`[authoring] hover uri=${uri}`, 'verbose');
    const languageService = (await server.projects.getProject(uri)).getLanguageService();
    return await languageService.doHover(uri, request.position, token);
  });

  connection.onDefinition(async (request, token) => {
    const uri = request.textDocument.uri;
    trace(`[authoring] definition uri=${uri}`, 'verbose');
    const languageService = (await server.projects.getProject(uri)).getLanguageService();
    return await languageService.findDefinition(uri, request.position, token);
  });

  const formattingConnection = connection as unknown as {
    onDocumentFormatting?: (
      handler: (
        request: {
          textDocument: { uri: string };
          options: { insertSpaces: boolean; tabSize: number };
        },
        token: unknown
      ) => Promise<unknown>
    ) => void;
  };
  if (typeof formattingConnection.onDocumentFormatting === 'function') {
    formattingConnection.onDocumentFormatting(async (request, token) => {
      const uri = request.textDocument.uri;
      trace(`[authoring] format request uri=${uri}`, 'verbose');
      const languageService = (await server.projects.getProject(uri)).getLanguageService();
      const formattingResult = await languageService.format(
        uri,
        request.options,
        undefined,
        undefined,
        token as Parameters<typeof languageService.format>[4]
      );
      trace(
        `[authoring] format result uri=${uri} edits=${Array.isArray(formattingResult) ? formattingResult.length : 0}`,
        'verbose'
      );
      return formattingResult;
    });
  } else {
    trace('[authoring] format handler unavailable on connection', 'verbose');
  }

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
      documentFormattingProvider: true,
    },
  };
});

connection.onInitialized(server.initialized);
connection.onShutdown(server.shutdown);
connection.listen();

export const serverTesting = {
  isLikelySchemaUri,
  isYamlTemplateUri,
  collectServiceDiagnosticsForDocument,
  resetRuntimeState() {
    storedWorkspaceRoot = undefined;
    storedInitializationOptions = undefined;
    serverTraceMode = 'off';
  },
  setStoredWorkspaceRoot(workspaceRoot: string | undefined) {
    storedWorkspaceRoot = workspaceRoot;
  },
  setServerTraceMode(traceMode: TraceMode) {
    serverTraceMode = traceMode;
  },
  setStoredInitializationOptions(options: ServerInitializationOptions | undefined) {
    storedInitializationOptions = options;
  },
};
