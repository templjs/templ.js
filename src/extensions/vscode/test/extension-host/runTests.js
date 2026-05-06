/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const path = require('node:path');
const { runTests, runVSCodeCommand } = require('@vscode/test-electron');

async function main() {
  const extensionDevelopmentPath = path.resolve(__dirname, '..', '..');
  const extensionTestsPath = path.resolve(__dirname, 'suite', 'index.js');
  const workspacePath = path.resolve(__dirname, '..', '..', 'test-fixtures');

  // Install host-language extensions used by assertions in this suite.
  await runVSCodeCommand(['--install-extension', 'DavidAnson.vscode-markdownlint']);
  await runVSCodeCommand(['--install-extension', 'redhat.vscode-yaml']);

  await runTests({
    extensionDevelopmentPath,
    extensionTestsPath,
    launchArgs: [workspacePath],
  });
}

main().catch((error) => {
  console.error('Failed to run extension host tests', error);
  process.exit(1);
});
