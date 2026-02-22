#!/usr/bin/env node

/**
 * @templjs/cli - Command-line interface for templjs
 *
 * Usage:
 *   templjs render <template> <data>    - Render template with data
 *   templjs validate <template>         - Validate template syntax
 *   templjs --help                      - Show help
 *   templjs --version                   - Show version
 */

import { renderCommand } from './commands/render.js';
import { validateCommand } from './commands/validate.js';
import { version } from './index.js';

const args = process.argv.slice(2);

async function main() {
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    console.log(`templjs CLI v${version}`);
    console.log('');
    console.log('Usage: templjs [command] [options]');
    console.log('');
    console.log('Commands:');
    console.log('  render <template> <data>  - Render template with JSON data');
    console.log('  validate <template>       - Validate template syntax');
    console.log('  --version                 - Show version');
    console.log('  --help                    - Show this help message');
    process.exit(0);
  }

  if (command === '--version') {
    console.log(`templjs v${version}`);
    process.exit(0);
  }

  try {
    let result: string;
    let valid: boolean;

    switch (command) {
      case 'render':
        if (args.length < 3) {
          console.error('Error: render command requires <template> and <data> arguments');
          process.exit(1);
        }
        result = await renderCommand(args[1], args[2]);
        console.log(result);
        break;

      case 'validate':
        if (args.length < 2) {
          console.error('Error: validate command requires <template> argument');
          process.exit(1);
        }
        valid = await validateCommand(args[1]);
        console.log(valid ? 'Template is valid' : 'Template has errors');
        process.exit(valid ? 0 : 1);
        break;

      default:
        console.error(`Unknown command: ${command}`);
        console.error('Run "templjs --help" for usage information');
        process.exit(1);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Fatal error: ${message}`);
  process.exit(1);
});
