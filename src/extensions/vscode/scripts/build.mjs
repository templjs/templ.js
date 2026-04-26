import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = path.resolve(here, '..');
const packageRoot = path.resolve(extensionRoot, '..', '..', 'packages');
const jsonLanguageServiceRoot = path.dirname(
  require.resolve('vscode-json-languageservice/package.json')
);
const jsoncParserEntry = require.resolve('jsonc-parser', {
  paths: [jsonLanguageServiceRoot],
});
const jsoncParserRoot = path.resolve(jsoncParserEntry, '..', '..', '..');

function resolveWorkspacePackageEntry(packageName) {
  const packageDir = path.join(packageRoot, packageName);
  const distEntry = path.join(packageDir, 'dist', 'index.js');
  if (existsSync(distEntry)) {
    return distEntry;
  }

  return path.join(packageDir, 'src', 'index.ts');
}

const alias = {
  '@templjs/context-graph': resolveWorkspacePackageEntry('context-graph'),
  '@templjs/core': resolveWorkspacePackageEntry('core'),
  '@templjs/volar': resolveWorkspacePackageEntry('volar'),
  'jsonc-parser': path.join(jsoncParserRoot, 'lib', 'esm', 'main.js'),
};

const createRequireCompatPlugin = {
  name: 'create-require-compat',
  setup(build) {
    const compatFiles = new Set([alias['@templjs/core'], alias['@templjs/volar']]);

    build.onLoad({ filter: /\.[cm]?[jt]s$/ }, async ({ path: filePath }) => {
      if (!compatFiles.has(filePath)) {
        return undefined;
      }

      const contents = await fs.readFile(filePath, 'utf8');

      return {
        contents: contents.replaceAll(
          'createRequire(import.meta.url)',
          'createRequire(__filename)'
        ),
        loader: filePath.endsWith('.ts') ? 'ts' : 'js',
      };
    });
  },
};

const sharedOptions = {
  absWorkingDir: extensionRoot,
  alias,
  bundle: true,
  format: 'cjs',
  mainFields: ['module', 'main'],
  platform: 'node',
  target: 'node18',
  minify: false,
  plugins: [createRequireCompatPlugin],
  sourcemap: true,
  logLevel: 'info',
};

await Promise.all([
  esbuild.build({
    ...sharedOptions,
    entryPoints: ['src/extension.ts'],
    outfile: 'dist/extension.js',
    external: ['vscode'],
  }),
  esbuild.build({
    ...sharedOptions,
    entryPoints: ['src/server.ts'],
    outfile: 'dist/server.js',
  }),
]);
