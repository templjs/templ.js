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

/**
 * Activate the templjs extension
 */
export function activate(context: vscode.ExtensionContext): void {
  console.log('[templjs] Extension activating...');

  // Register command to test activation
  const testCommand = vscode.commands.registerCommand('templjs.test', () => {
    vscode.window.showInformationMessage('Templjs extension is working! 🚀');
  });

  context.subscriptions.push(testCommand);

  // Initialize Volar language server
  try {
    initializeLanguageServer(context);
    console.log('[templjs] Language server initialized successfully');
    vscode.window.showInformationMessage('Templjs language support activated! ✨');
  } catch (error) {
    console.error('[templjs] Failed to initialize language server:', error);
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

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: 'file', language: 'templjs-yaml' },
      { scheme: 'file', language: 'templjs-json' },
      { scheme: 'file', language: 'templjs-markdown' },
      { scheme: 'file', language: 'templjs-html' },
    ],
    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher(
        '**/*.{templ,tmpl}.{md,json,yaml,yml,html}'
      ),
    },
    initializationOptions: {
      typescript: tsdk ? { tsdk } : undefined,
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
    return languageClient.stop();
  }
  return undefined;
}
