#!/usr/bin/env node
import { createRequire } from 'node:module';
import { startTempljsLanguageServer } from '../src/server.js';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version: string };

if (process.argv.includes('--version')) {
  process.stdout.write(`${packageJson.version}\n`);
  process.exit(0);
}

startTempljsLanguageServer();
