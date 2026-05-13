#!/usr/bin/env node
/* global console, process */

/**
 * Validate that bundled external require() calls in dist/server.js can be
 * resolved from available node_modules (dependencies and transitive deps).
 *
 * Checks:
 * 1. Filters out Node.js built-in modules
 * 2. Filters out relative imports
 * 3. Filters out workspace packages (bundled)
 * 4. Verifies remaining require() calls can be resolved from node_modules
 *
 * Purpose: Prevent regression where bundled code requires external npm packages
 * that aren't declared as (or transitive) dependencies.
 *
 * Background: vscode-json-languageservice is a UMD module whose code is bundled
 * into dist/server.js. When Node.js runs the bundled code, it may encounter
 * require() calls that must resolve from node_modules.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire, builtinModules } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = path.resolve(here, '..');
const workspaceRoot = path.resolve(extensionRoot, '../../..');
const packageJsonPath = path.join(extensionRoot, 'package.json');
const rootPackageJsonPath = path.join(workspaceRoot, 'package.json');

function resolveServerBundlePath() {
  const preferredFormat = process.env.TEMPLJS_SERVER_FORMAT?.trim().toLowerCase();
  if (preferredFormat === 'esm') {
    return path.join(extensionRoot, 'dist', 'server.mjs');
  }

  if (preferredFormat === 'cjs') {
    return path.join(extensionRoot, 'dist', 'server.js');
  }

  const cjsPath = path.join(extensionRoot, 'dist', 'server.js');
  const esmPath = path.join(extensionRoot, 'dist', 'server.mjs');
  if (fs.existsSync(cjsPath)) {
    return cjsPath;
  }
  if (fs.existsSync(esmPath)) {
    return esmPath;
  }

  return cjsPath;
}

const serverBundlePath = resolveServerBundlePath();

if (!fs.existsSync(serverBundlePath)) {
  console.error(`❌ ${path.relative(extensionRoot, serverBundlePath)} not found. Run build first.`);
  process.exit(1);
}

const _packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const serverBundle = fs.readFileSync(serverBundlePath, 'utf8');
const serverBundleLabel = path.basename(serverBundlePath);
// Use root workspace package.json for createRequire to access pnpm hoisted modules
const localRequire = createRequire(rootPackageJsonPath);

// Set of known Node.js built-in modules
const builtins = new Set(builtinModules);

// Workspace packages and templjs packages (bundled, not external deps)
const bundledPrefixes = new Set(['@templjs', 'templjs']);

// Regex patterns for require() calls
// Matches: require("module"), require('module')
const requirePattern = /require\s*\(\s*["']([^"']+)["']\s*\)/g;
const staticImportPattern = /(?:^|\n)\s*import\s+(?:[^'"\n]+\s+from\s+)?["']([^"']+)["']/g;
const dynamicImportPattern = /import\s*\(\s*["']([^"']+)["']\s*\)/g;

// Find all try/catch blocks to identify optional requires
// Simple heuristic: look for _require inside try blocks followed by catch
const tryCatchPattern = /try\s*\{[\s\S]*?_require\s*=\s*require[\s\S]*?\}\s*catch\s*\(/g;
const optionalRequireMatches = [];
let tryCatchMatch;
while ((tryCatchMatch = tryCatchPattern.exec(serverBundle)) !== null) {
  // Find all require calls within this try block
  const tryCatchText = tryCatchMatch[0];
  const localRequirePattern = /["']([^"']+)["']/g;
  let localMatch;
  while ((localMatch = localRequirePattern.exec(tryCatchText)) !== null) {
    optionalRequireMatches.push(localMatch[1]);
  }
}
const optionalRequires = new Set(optionalRequireMatches);

// Extract all module names from the bundled server.js
const requiredModules = new Set();
for (const pattern of [requirePattern, staticImportPattern, dynamicImportPattern]) {
  let match;
  while ((match = pattern.exec(serverBundle)) !== null) {
    const moduleName = match[1];

    // Skip relative imports
    if (moduleName.startsWith('.')) {
      continue;
    }

    // Skip node: protocol
    if (moduleName.startsWith('node:')) {
      continue;
    }

    // Skip formatter placeholders (for example "{0}") captured from string literals.
    if (/^\{\d+\}$/.test(moduleName)) {
      continue;
    }

    // Extract base package name (before /subpath)
    const baseName = moduleName.split('/')[0];

    // Skip Node.js built-in modules
    if (builtins.has(baseName)) {
      continue;
    }

    // Skip workspace/bundled packages
    if (bundledPrefixes.has(baseName)) {
      continue;
    }

    // Skip optional requires (in try/catch blocks)
    if (optionalRequires.has(moduleName)) {
      continue;
    }

    requiredModules.add(moduleName);
  }
}

// Check that all required external modules can be resolved from node_modules
let hasErrors = false;
const unresolvable = [];

for (const module of requiredModules) {
  try {
    localRequire.resolve(module);
  } catch {
    unresolvable.push(module);
    hasErrors = true;
  }
}

if (hasErrors) {
  console.error(
    `❌ Bundled ${serverBundleLabel} requires packages that cannot be resolved from node_modules:`
  );
  unresolvable.forEach((mod) => {
    console.error(`   - ${mod}`);
  });
  console.error(
    '\n💡 These packages need to be added to "dependencies" in package.json.'
  );
  process.exit(1);
}

console.log(
  `✅ All ${requiredModules.size > 0 ? requiredModules.size : 'external'} bundled requires are resolvable from node_modules.`
);
if (requiredModules.size > 0) {
  console.log(`   Resolved: ${Array.from(requiredModules).sort().join(', ')}`);
}
