/**
 * VS Code extension for templjs language support
 *
 * Provides language server integration using Volar for:
 * - Syntax highlighting
 * - Diagnostics
 * - IntelliSense  * - Virtual code mapping
 */

import * as vscode from 'vscode';

export function activate(_context: vscode.ExtensionContext) {
  console.log('Templjs extension activating...');

  // TODO: Initialize language server
  // For now, just log activation

  vscode.window.showInformationMessage('Templjs extension activated! 🚀');

  // Placeholder for language client initialization
  // const serverModule = context.asAbsolutePath(path.join('dist', 'server.js'));
  // const serverOptions: ServerOptions = {
  //   run: { module: serverModule, transport: TransportKind.ipc },
  //   debug: { module: serverModule, transport: TransportKind.ipc }
  // };

  // const clientOptions: LanguageClientOptions = {
  //   documentSelector: [
  //     { scheme: 'file', language: 'templjs-yaml' },
  //     { scheme: 'file', language: 'templjs-json' },
  //     { scheme: 'file', language: 'templjs-markdown' },
  //     { scheme: 'file', language: 'templjs-html' }
  //   ]
  // };

  // client = new LanguageClient('templjs', 'Templjs Language Server', serverOptions, clientOptions);
  // await client.start();
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
