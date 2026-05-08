/**
 * VS Code extension for templjs language support
 *
 * Provides language server integration using Volar for:
 * - Syntax highlighting
 * - Diagnostics
 * - IntelliSense
 * - Virtual code mapping
 */

import * as path from 'path';
import * as vscode from 'vscode';
import type { AdapterRuntimeMap } from '@templjs/language-service';
import {
  LanguageClient,
  type LanguageClientOptions,
  type ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';
import { TempljsVirtualDocumentProvider, VIRTUAL_SCHEME } from './virtual-document-provider.js';

let languageClient: LanguageClient | undefined;
let outputChannel: vscode.OutputChannel | undefined;
let isRestartingLanguageClient = false;
let activeEditorTraceSubscription: vscode.Disposable | undefined;

type TraceMode = 'off' | 'messages' | 'verbose';

const PRETTIER_FORMATTER_IDS = new Set(['esbenp.prettier-vscode']);
const HOST_BASE_LANGUAGES = ['markdown', 'json', 'yaml', 'html'] as const;

function getTraceMode(): TraceMode {
  const configured = vscode.workspace
    .getConfiguration('templjs')
    .get<string>('trace.server', 'off');

  if (configured === 'messages' || configured === 'verbose') {
    return configured;
  }

  return 'off';
}

// 'verbose' enables all logging, while 'messages' enables only message-level logging.
function shouldTrace(traceMode: TraceMode, level: 'messages' | 'verbose' = 'messages'): boolean {
  if (traceMode === 'off') {
    return false;
  }

  return level === 'messages' || traceMode === 'verbose';
}

function getResultCount(result: unknown): number {
  if (Array.isArray(result)) {
    return result.length;
  }

  if (
    result &&
    typeof result === 'object' &&
    'items' in result &&
    Array.isArray((result as { items?: unknown }).items)
  ) {
    return (result as { items: unknown[] }).items.length;
  }

  return result ? 1 : 0;
}

function extractLabels(result: unknown): string[] {
  if (Array.isArray(result)) {
    return result
      .map((item) =>
        item && typeof item === 'object' ? (item as { label?: unknown }).label : null
      )
      .filter((label): label is string => typeof label === 'string' && label.length > 0);
  }

  if (
    result &&
    typeof result === 'object' &&
    'items' in result &&
    Array.isArray((result as { items?: unknown }).items)
  ) {
    return (result as { items: unknown[] }).items
      .map((item) =>
        item && typeof item === 'object' ? (item as { label?: unknown }).label : null
      )
      .filter((label): label is string => typeof label === 'string' && label.length > 0);
  }

  return [];
}

function hoverContentToString(hover: vscode.Hover): string {
  if (!Array.isArray(hover.contents)) {
    return '';
  }

  return hover.contents
    .map((entry) =>
      typeof entry === 'string' ? entry : 'value' in entry ? String(entry.value) : String(entry)
    )
    .join(' | ');
}

function getFirstTargetUri(defResult: unknown): string {
  const first = Array.isArray(defResult) ? defResult[0] : defResult;
  if (!first || typeof first !== 'object') {
    return 'unknown';
  }

  if (
    'uri' in first &&
    typeof (first as { uri?: { toString?: () => string } }).uri?.toString === 'function'
  ) {
    return (first as { uri: { toString: () => string } }).uri.toString();
  }

  if (
    'targetUri' in first &&
    typeof (first as { targetUri?: { toString?: () => string } }).targetUri?.toString === 'function'
  ) {
    return (first as { targetUri: { toString: () => string } }).targetUri.toString();
  }

  return 'unknown';
}

function isPrettierFormatterSelection(formatterId: string | undefined): boolean {
  if (!formatterId) {
    return false;
  }

  return PRETTIER_FORMATTER_IDS.has(formatterId.trim().toLowerCase());
}

function getPrettierHostLanguagesFromSettings(): string[] {
  const allSettings = vscode.workspace.getConfiguration();
  const globalFormatter = vscode.workspace
    .getConfiguration('editor')
    .get<string>('defaultFormatter');

  const selected: string[] = [];
  for (const language of HOST_BASE_LANGUAGES) {
    const languageBlock = allSettings.get<Record<string, unknown>>(`[${language}]`);
    const languageFormatter =
      languageBlock && typeof languageBlock['editor.defaultFormatter'] === 'string'
        ? String(languageBlock['editor.defaultFormatter'])
        : undefined;

    const effectiveFormatter = languageFormatter ?? globalFormatter;
    if (isPrettierFormatterSelection(effectiveFormatter)) {
      selected.push(language);
    }
  }

  return selected;
}

/**
 * Returns true when a markdownlint extension is installed, indicating the server
 * should defer markdown diagnostics to that extension rather than running its own adapter.
 */
function isMarkdownlintRegisteredForMd(): boolean {
  return vscode.extensions.getExtension('DavidAnson.vscode-markdownlint') !== undefined;
}

function isRedhatYamlRegisteredForYaml(): boolean {
  return vscode.extensions.getExtension('redhat.vscode-yaml') !== undefined;
}

function isJsonLSRegisteredForJson(): boolean {
  return vscode.extensions.getExtension('vscode.json-language-features') !== undefined;
}

function resolveAdapterRuntimes(prettierHostLanguages: string[]): AdapterRuntimeMap {
  const hasMarkdownlint = isMarkdownlintRegisteredForMd();
  const hasRedhatYaml = isRedhatYamlRegisteredForYaml();
  const hasJsonLs = isJsonLSRegisteredForJson();

  const runtimes: AdapterRuntimeMap = {
    'templjs-markdown-host': {
      state: hasMarkdownlint ? 'enabled' : 'unavailable',
      reason: hasMarkdownlint
        ? 'resolved-vscode-extension-markdownlint'
        : 'unavailable-vscode-extension-markdownlint',
      provider: {
        kind: 'vscode-extension',
        id: 'DavidAnson.vscode-markdownlint',
      },
      languageIds: ['markdown', 'templjs-markdown'],
    },
    'templjs-yaml': {
      state: hasRedhatYaml ? 'enabled' : 'unavailable',
      reason: hasRedhatYaml
        ? 'resolved-vscode-extension-yaml'
        : 'unavailable-vscode-extension-yaml',
      provider: {
        kind: 'vscode-extension',
        id: 'redhat.vscode-yaml',
      },
      languageIds: ['yaml', 'templjs-yaml'],
    },
    'templjs-json-host': {
      state: hasJsonLs ? 'enabled' : 'unavailable',
      reason: hasJsonLs
        ? 'resolved-vscode-extension-json'
        : 'unavailable-vscode-extension-json',
      provider: {
        kind: 'vscode-extension',
        id: 'vscode.json-language-features',
      },
      languageIds: ['json', 'templjs-json'],
    },
    'templjs-prettier-host': {
      state: prettierHostLanguages.length > 0 ? 'enabled' : 'disabled',
      reason:
        prettierHostLanguages.length > 0
          ? 'resolved-vscode-formatter-selection'
          : 'disabled-no-prettier-host-languages',
      provider: {
        kind: 'vscode-extension',
        id: 'esbenp.prettier-vscode',
      },
      languageIds: prettierHostLanguages,
      settings: {
        prettierHostLanguages,
      },
    },
  };

  return runtimes;
}

function shouldRefreshFormatterSelection(event: vscode.ConfigurationChangeEvent): boolean {
  if (event.affectsConfiguration('editor.defaultFormatter')) {
    return true;
  }

  return HOST_BASE_LANGUAGES.some((language) => event.affectsConfiguration(`[${language}]`));
}

function isTempljsDocument(document: vscode.TextDocument): boolean {
  if (document.uri.scheme !== 'file') {
    return false;
  }

  if (document.languageId.startsWith('templjs-')) {
    return true;
  }

  return /\.(md|markdown|json|ya?ml|html|htm)\.(templ|tmpl|tpl)$/i.test(document.uri.fsPath);
}

/**
 * Activate the templjs extension
 */
export function activate(context: vscode.ExtensionContext): void {
  console.log('[templjs] Extension activating...');

  outputChannel = vscode.window.createOutputChannel('templjs');
  context.subscriptions.push(outputChannel);
  outputChannel.appendLine('[templjs] Extension activating...');

  // Register command to test activation
  const testCommand = vscode.commands.registerCommand('templjs.test', () => {
    vscode.window.showInformationMessage('Templjs extension is working! 🚀');
  });

  context.subscriptions.push(testCommand);

  // Initialize Volar language server
  try {
    initializeLanguageServer(context);
    console.log('[templjs] Language server initialized successfully');
    outputChannel.appendLine('[templjs] Language client started');
    vscode.window.showInformationMessage('Templjs language support activated! ✨');
  } catch (error) {
    console.error('[templjs] Failed to initialize language server:', error);
    outputChannel.appendLine(`[templjs] Failed to initialize language server: ${String(error)}`);
    vscode.window.showErrorMessage('Failed to activate Templjs: ' + String(error));
  }

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!shouldRefreshFormatterSelection(event)) {
        return;
      }

      outputChannel?.appendLine(
        '[templjs] Formatter selection changed; restarting language client to refresh Prettier host-language delegation'
      );
      void restartLanguageClient(context);
    })
  );

  // Host language delegation via virtual documents.
  // Serves cleaned template content under `templjs-virtual://` so VS Code routes each
  // embedded document to whatever language server the user has configured — markdownlint,
  // remark, Vale, the built-in markdown server, etc. — without any hardcoded dependency.
  // TODO(WI-093): supersede with @volar/language-client when Volar adds client-side
  // embedded-language forwarding.
  initializeHostLanguageDelegation(context);
}

async function restartLanguageClient(context: vscode.ExtensionContext): Promise<void> {
  if (isRestartingLanguageClient) {
    return;
  }

  isRestartingLanguageClient = true;
  try {
    const previousClient = languageClient;
    languageClient = undefined;

    if (previousClient) {
      await previousClient.stop();
    }

    initializeLanguageServer(context);
  } catch (error) {
    outputChannel?.appendLine(`[templjs] Failed to restart language client: ${String(error)}`);
    console.error('[templjs] Failed to restart language client:', error);
  } finally {
    isRestartingLanguageClient = false;
  }
}

/**
 * Initialize the Volar language server
 */
function initializeLanguageServer(context: vscode.ExtensionContext): void {
  const serverModule = context.asAbsolutePath(path.join('dist', 'server.js'));
  outputChannel?.appendLine(`[templjs] Server module path: ${serverModule}`);
  const traceMode = getTraceMode();
  const trace = (message: string, level: 'messages' | 'verbose' = 'messages') => {
    if (shouldTrace(traceMode, level)) {
      outputChannel?.appendLine(`[templjs-trace] ${message}`);
    }
  };

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: { execArgv: ['--nolazy', '--inspect=6009'] },
    },
  };

  const tsdk = getTypeScriptSdkPath();
  const schemaPath = getSchemaPathFromSettings();
  const contentSchemaPath = getContentSchemaPathFromSettings();
  const schemaPatterns = getSchemaPatternsFromSettings();
  const documentContext = getActiveDocumentContext();
  const prettierHostLanguages = getPrettierHostLanguagesFromSettings();
  const adapterRuntimes = resolveAdapterRuntimes(prettierHostLanguages);

  const clientOptions: LanguageClientOptions = {
    middleware: {
      provideCompletionItem: (document, position, context, token, next) => {
        const startedAt = Date.now();
        trace(
          `completion requested: ${document.uri.toString()} @ ${position.line}:${position.character}`
        );
        return Promise.resolve(next(document, position, context, token)).then((result) => {
          const count = getResultCount(result);
          const durationMs = Date.now() - startedAt;
          trace(`completion result count=${count} durationMs=${durationMs}`);

          const labels = extractLabels(result);

          if (labels.length > 0) {
            const seen = new Map<string, number>();
            for (const label of labels) {
              const key = label.toLowerCase();
              seen.set(key, (seen.get(key) ?? 0) + 1);
            }
            const duplicates = [...seen.entries()]
              .filter(([, total]) => total > 1)
              .map(([label, total]) => `${label}×${total}`)
              .slice(0, 8);

            if (duplicates.length > 0) {
              trace(`completion duplicate labels: ${duplicates.join(', ')}`, 'verbose');
            }

            trace(
              `completion top labels: ${labels
                .slice(0, 8)
                .map((label) => JSON.stringify(label))
                .join(', ')}`,
              'verbose'
            );
          }

          return result;
        });
      },
      provideHover: (document, position, token, next) => {
        const startedAt = Date.now();
        trace(
          `hover requested: ${document.uri.toString()} @ ${position.line}:${position.character}`
        );
        return Promise.resolve(next(document, position, token)).then((result) => {
          const durationMs = Date.now() - startedAt;
          trace(`hover result=${result ? 'present' : 'none'} durationMs=${durationMs}`);

          if (result) {
            const value = hoverContentToString(result as vscode.Hover);
            trace(`hover content length=${value.length}`, 'verbose');
          }

          return result;
        });
      },
      provideDefinition: (document, position, token, next) => {
        const startedAt = Date.now();
        trace(
          `definition requested: ${document.uri.toString()} @ ${position.line}:${position.character}`
        );
        return Promise.resolve(next(document, position, token)).then((result) => {
          const count = getResultCount(result);
          const durationMs = Date.now() - startedAt;
          trace(`definition result count=${count} durationMs=${durationMs}`);

          if (count > 0) {
            const firstUri = getFirstTargetUri(result);
            trace(`definition first target=${firstUri}`, 'verbose');
          }

          return result;
        });
      },
    },
    documentSelector: [
      { scheme: 'file', language: 'templjs-yaml' },
      { scheme: 'file', language: 'templjs-json' },
      { scheme: 'file', language: 'templjs-markdown' },
      { scheme: 'file', language: 'templjs-html' },
      { scheme: 'file', pattern: '**/*.md.templ' },
      { scheme: 'file', pattern: '**/*.md.tmpl' },
      { scheme: 'file', pattern: '**/*.md.tpl' },
      { scheme: 'file', pattern: '**/*.json.templ' },
      { scheme: 'file', pattern: '**/*.json.tmpl' },
      { scheme: 'file', pattern: '**/*.json.tpl' },
      { scheme: 'file', pattern: '**/*.yaml.templ' },
      { scheme: 'file', pattern: '**/*.yaml.tmpl' },
      { scheme: 'file', pattern: '**/*.yaml.tpl' },
      { scheme: 'file', pattern: '**/*.yml.templ' },
      { scheme: 'file', pattern: '**/*.yml.tmpl' },
      { scheme: 'file', pattern: '**/*.yml.tpl' },
      { scheme: 'file', pattern: '**/*.html.templ' },
      { scheme: 'file', pattern: '**/*.html.tmpl' },
      { scheme: 'file', pattern: '**/*.html.tpl' },
    ],
    synchronize: {
      fileEvents: [
        vscode.workspace.createFileSystemWatcher('**/*.{md,json,yaml,yml,html}.{templ,tmpl,tpl}'),
        vscode.workspace.createFileSystemWatcher('**/*.{json,yaml,yml}'),
      ],
    },
    outputChannel,
    traceOutputChannel: outputChannel,
    initializationOptions: {
      typescript: tsdk ? { tsdk } : undefined,
      schemaPath,
      contentSchemaPath,
      schemaPatterns,
      documentContext,
      traceMode,
      prettierHostLanguages,
      adapterRuntimes,
      markdownlintRegisteredForMd: isMarkdownlintRegisteredForMd(),
      redhatYamlRegisteredForYaml: isRedhatYamlRegisteredForYaml(),
    },
  };

  languageClient = new LanguageClient(
    'templjs',
    'Templjs Language Server',
    serverOptions,
    clientOptions
  );

  context.subscriptions.push(languageClient);
  outputChannel?.appendLine('[templjs] Language client created');

  activeEditorTraceSubscription?.dispose();
  const activeEditorSubscription = vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (!editor) {
      return;
    }
    trace(
      `active editor: ${editor.document.uri.toString()} (${editor.document.languageId})`,
      'verbose'
    );
  });
  activeEditorTraceSubscription = activeEditorSubscription;
  context.subscriptions.push(activeEditorSubscription);

  outputChannel?.appendLine('[templjs] Starting language client...');
  void languageClient.start().catch((error: unknown) => {
    outputChannel?.appendLine(`[templjs] Language client start failed: ${String(error)}`);
    console.error('[templjs] Language client start failed:', error);
    void vscode.window.showErrorMessage(
      `Templjs: Language client failed to start: ${String(error)}`
    );
  });
}

/**
 * Register the virtual document provider and keep it in sync with open templjs documents.
 *
 * `templjs-virtual://` documents contain the cleaned template content (template expressions
 * deleted, offset-mapped). VS Code routes them to whichever LSP-based language server is
 * registered for the base format language ID. No in-process language services are run here.
 */
function initializeHostLanguageDelegation(context: vscode.ExtensionContext): void {
  const provider = new TempljsVirtualDocumentProvider();
  const hostDiagnostics = vscode.languages.createDiagnosticCollection('templjs-host');
  context.subscriptions.push(provider);
  context.subscriptions.push(hostDiagnostics);
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(VIRTUAL_SCHEME, provider)
  );

  function syncDocument(document: vscode.TextDocument): void {
    if (!isTempljsDocument(document)) return;
    const virtualUri = provider.update(document.uri, document.getText());
    void vscode.workspace.openTextDocument(virtualUri);
  }

  // Sync all documents already open when the extension activates.
  for (const document of vscode.workspace.textDocuments) {
    syncDocument(document);
  }

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => {
      syncDocument(doc);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      syncDocument(e.document);
    })
  );

  context.subscriptions.push(
    vscode.languages.onDidChangeDiagnostics((event) => {
      for (const uri of event.uris) {
        if (!provider.isVirtualUri(uri)) {
          continue;
        }

        const sourceUri = provider.toSourceUri(uri);
        const mappedDiagnostics = vscode.languages
          .getDiagnostics(uri)
          .map((diagnostic) => provider.mapDiagnosticToSource(sourceUri, diagnostic))
          .filter((diagnostic): diagnostic is vscode.Diagnostic => diagnostic !== undefined);

        hostDiagnostics.set(sourceUri, mappedDiagnostics);
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((doc) => {
      if (isTempljsDocument(doc)) {
        provider.remove(doc.uri);
        hostDiagnostics.delete(doc.uri);
      }
    })
  );
}

interface ActiveDocumentContext {
  uri: string;
  content: string;
}

function getActiveDocumentContext(): ActiveDocumentContext | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.uri.scheme !== 'file') {
    return undefined;
  }

  return {
    uri: editor.document.uri.toString(),
    content: editor.document.getText(),
  };
}

function getContentSchemaPathFromSettings(): string | undefined {
  const configuredPath = vscode.workspace
    .getConfiguration('templjs')
    .get<string>('contentSchemaPath')
    ?.trim();

  return configuredPath ? configuredPath : undefined;
}

interface GlobSchemaConfig {
  schemaPath?: string;
  contentSchemaPath?: string;
}

function getSchemaPatternsFromSettings(): Record<string, GlobSchemaConfig> | undefined {
  const globSchemas = vscode.workspace
    .getConfiguration('templjs')
    .get<Record<string, GlobSchemaConfig>>('schemas', {});

  if (Object.keys(globSchemas).length === 0) {
    return undefined;
  }

  return globSchemas;
}

function getSchemaPathFromSettings(): string | undefined {
  const configuredPath = vscode.workspace
    .getConfiguration('templjs')
    .get<string>('schemaPath')
    ?.trim();

  return configuredPath ? configuredPath : undefined;
}

function getTypeScriptSdkPath(): string | undefined {
  try {
    const tsServerPath = require.resolve('typescript/lib/tsserverlibrary.js');
    return path.dirname(tsServerPath);
  } catch {
    /* v8 ignore next */
    return undefined;
  }
}

/**
 * Deactivate the templjs extension
 */
export function deactivate(): Thenable<void> | undefined {
  activeEditorTraceSubscription?.dispose();
  activeEditorTraceSubscription = undefined;

  if (languageClient) {
    const client = languageClient;
    languageClient = undefined;
    console.log('[templjs] Extension deactivating...');
    outputChannel?.appendLine('[templjs] Extension deactivating...');
    return client.stop().finally(() => {
      outputChannel?.dispose();
      outputChannel = undefined;
    });
  }
  outputChannel?.dispose();
  outputChannel = undefined;
  return undefined;
}

export const extensionTesting = {
  getTraceMode,
  shouldTrace,
  getResultCount,
  extractLabels,
  hoverContentToString,
  getFirstTargetUri,
  isPrettierFormatterSelection,
  getPrettierHostLanguagesFromSettings,
  resolveAdapterRuntimes,
  shouldRefreshFormatterSelection,
  isTempljsDocument,
  getActiveDocumentContext,
  getContentSchemaPathFromSettings,
  getSchemaPatternsFromSettings,
  getSchemaPathFromSettings,
  getTypeScriptSdkPath,
};
