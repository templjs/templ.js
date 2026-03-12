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
import {
  LanguageClient,
  type LanguageClientOptions,
  type ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';

let languageClient: LanguageClient | undefined;
let outputChannel: vscode.OutputChannel | undefined;

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
}

/**
 * Initialize the Volar language server
 */
function initializeLanguageServer(context: vscode.ExtensionContext): void {
  const serverModule = context.asAbsolutePath(path.join('dist', 'server.js'));

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

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: 'file', language: 'templjs-yaml' },
      { scheme: 'file', language: 'templjs-json' },
      { scheme: 'file', language: 'templjs-markdown' },
      { scheme: 'file', language: 'templjs-html' },
    ],
    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher(
        '**/*.{md,json,yaml,yml,html}.{templ,tmpl,tpl}'
      ),
    },
    outputChannel,
    traceOutputChannel: outputChannel,
    initializationOptions: {
      typescript: tsdk ? { tsdk } : undefined,
      schemaPath,
      contentSchemaPath,
      schemaPatterns,
      documentContext,
    },
  };

  languageClient = new LanguageClient(
    'templjs',
    'Templjs Language Server',
    serverOptions,
    clientOptions
  );

  context.subscriptions.push(languageClient);
  void languageClient.start();
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
    return undefined;
  }
}

/**
 * Deactivate the templjs extension
 */
export function deactivate(): Thenable<void> | undefined {
  if (languageClient) {
    console.log('[templjs] Extension deactivating...');
    outputChannel?.appendLine('[templjs] Extension deactivating...');
    const stopPromise = languageClient.stop();
    outputChannel?.dispose();
    outputChannel = undefined;
    return stopPromise;
  }
  outputChannel?.dispose();
  outputChannel = undefined;
  return undefined;
}
