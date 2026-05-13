import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const SERVER_FORMAT_ENV = 'TEMPLJS_SERVER_FORMAT';

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
const vscodeUriRoot = path.resolve(path.dirname(require.resolve('vscode-uri')), '..', '..');

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
  // Force CJS/UMD entry for vscode-uri so that `import uri from 'vscode-uri'`
  // (used by vscode-markdown-languageservice) gets a CJS default-export compatible module.
  'vscode-uri': path.join(vscodeUriRoot, 'lib', 'umd', 'index.js'),
};

const jsonLanguageServiceEsmEntry = path.join(
  jsonLanguageServiceRoot,
  'lib',
  'esm',
  'jsonLanguageService.js'
);

const forceJsonLanguageServiceEsmPlugin = {
  name: 'force-json-language-service-esm',
  setup(build) {
    // Only rewrite bare package imports; keep subpath imports untouched.
    build.onResolve({ filter: /^vscode-json-languageservice$/ }, () => ({
      path: jsonLanguageServiceEsmEntry,
    }));

    // yaml-language-server imports UMD service subpaths directly; remap to ESM files.
    build.onResolve({ filter: /^vscode-json-languageservice\/lib\/umd\/(.+)$/ }, (args) => {
      const subpath = args.path.replace('vscode-json-languageservice/lib/umd/', '');
      const normalizedSubpath = subpath.endsWith('.js') ? subpath : `${subpath}.js`;
      return {
        path: path.join(jsonLanguageServiceRoot, 'lib', 'esm', normalizedSubpath),
      };
    });
  },
};

const IMPORT_META_URL_PATTERN = 'createRequire(import.meta.url)';

const createRequireCompatPlugin = {
  name: 'create-require-compat',
  setup(build) {
    // Apply to every bundled file: esbuild compiles ESM-to-CJS by initialising
    // import_meta as {} without populating .url, so any createRequire(import.meta.url)
    // call crashes at runtime with "Received undefined". Replace it globally.
    build.onLoad({ filter: /\.[cm]?[jt]s$/ }, async ({ path: filePath }) => {
      const contents = await fs.readFile(filePath, 'utf8');

      if (!contents.includes(IMPORT_META_URL_PATTERN)) {
        return undefined; // Nothing to rewrite; skip without cost.
      }

      return {
        contents: contents.replaceAll(IMPORT_META_URL_PATTERN, 'createRequire(__filename)'),
        loader: filePath.endsWith('.ts') ? 'ts' : 'js',
      };
    });
  },
};

function getServerFormat() {
  const configured = process.env[SERVER_FORMAT_ENV]?.trim().toLowerCase();
  if (!configured || configured === 'cjs') {
    return 'cjs';
  }

  if (configured === 'esm') {
    return 'esm';
  }

  throw new Error(
    `${SERVER_FORMAT_ENV} must be either "cjs" or "esm" (received: ${JSON.stringify(configured)})`
  );
}

const serverFormat = getServerFormat();
const serverIsEsm = serverFormat === 'esm';

const sharedOptions = {
  absWorkingDir: extensionRoot,
  alias,
  bundle: true,
  mainFields: ['module', 'main'],
  platform: 'node',
  target: 'node18',
  minify: false,
  sourcemap: true,
  logLevel: 'info',
};

const cjsCompatOptions = {
  // Declare a CJS-safe global at the top of each bundle that esbuild's define option
  // can reference. esbuild's define only accepts identifiers or JSON literals, so
  // we cannot inline require('url').pathToFileURL(...) directly.
  banner: {
    js: "var __esm_import_meta_url = require('url').pathToFileURL(__filename).href;",
  },
  // Replace import.meta.url with the CJS-safe global declared above.
  // esbuild compiles ESM→CJS by substituting import.meta with an empty object
  // `import_meta = {}` and never populates `.url`, so any code that calls
  // createRequire(import.meta.url) crashes at runtime with "Received undefined".
  define: {
    'import.meta.url': '__esm_import_meta_url',
  },
  format: 'cjs',
  plugins: [forceJsonLanguageServiceEsmPlugin, createRequireCompatPlugin],
};

const serverBuildOptions = serverIsEsm
  ? {
      format: 'esm',
      plugins: [forceJsonLanguageServiceEsmPlugin],
      // Some bundled dependencies still execute CJS-style dynamic require() at runtime.
      // In ESM output we provide a local require via createRequire(import.meta.url).
      banner: {
        js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
      },
      outfile: 'dist/server.mjs',
    }
  : {
      ...cjsCompatOptions,
      outfile: 'dist/server.js',
    };

await Promise.all([
  esbuild.build({
    ...sharedOptions,
    ...cjsCompatOptions,
    entryPoints: ['src/extension.ts'],
    outfile: 'dist/extension.js',
    external: ['vscode'],
  }),
  esbuild.build({
    ...sharedOptions,
    ...serverBuildOptions,
    entryPoints: ['src/server-main.ts'],
  }),
]);
