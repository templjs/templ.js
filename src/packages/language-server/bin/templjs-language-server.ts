#!/usr/bin/env node
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version: string };

async function main(): Promise<void> {
  if (process.argv.includes('--version')) {
    process.stdout.write(`${packageJson.version}\n`);
    process.exit(0);
  }

  const { startTempljsLanguageServer } = await import('../src/server.js');
  startTempljsLanguageServer();
}

void main();
