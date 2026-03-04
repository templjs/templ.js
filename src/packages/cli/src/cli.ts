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

import { writeFileSync } from 'fs';
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { renderCommand } from './commands/render.js';
import { validateCommand } from './commands/validate.js';
import { version } from './index.js';
import { loadConfig, applyConfig } from './config/index.js';

function createProgram(): Command {
  const program = new Command();

  program
    .name('templjs')
    .description('CLI for rendering and validating templjs templates')
    .version(version);

  program
    .command('render')
    .description('Render template with JSON data')
    .option('-t, --template <path>', 'Template file path')
    .requiredOption('-i, --input <pathOrJson>', 'Input JSON file path or inline JSON payload')
    .option('-o, --output <path>', 'Output file path (defaults to stdout)')
    .option('--no-validate-input', 'Skip input validation when supported by core')
    .option('--no-validate-output', 'Skip output validation when supported by core')
    .action(
      async (options: {
        template?: string;
        input: string;
        output?: string;
        validateInput: boolean;
        validateOutput: boolean;
      }) => {
        const config = loadConfig();
        const finalOptions = applyConfig(options, config) as typeof options;
        if (!finalOptions.template) {
          throw new Error(
            'Template file path is required (pass --template or set defaultTemplate in .templjs.json)'
          );
        }
        const rendered = await renderCommand(finalOptions.template, finalOptions.input);
        if (finalOptions.output) {
          writeFileSync(finalOptions.output, rendered, 'utf-8');
          return;
        }
        process.stdout.write(`${rendered}\n`);
      }
    );

  program
    .command('validate')
    .description('Validate template syntax')
    .option('-t, --template <path>', 'Template file path')
    .option('-s, --schema <path>', 'Optional schema path (future core integration)')
    .action(async (options: { template?: string; schema?: string }) => {
      const config = loadConfig();
      const finalOptions = applyConfig(options, config) as typeof options;
      if (!finalOptions.template) {
        throw new Error(
          'Template file path is required (pass --template or set defaultTemplate in .templjs.json)'
        );
      }
      const valid = await validateCommand(finalOptions.template, finalOptions.schema);
      process.stdout.write(valid ? 'Template is valid\n' : 'Template has errors\n');
      if (!valid) {
        process.exitCode = 1;
      }
    });

  program
    .command('init')
    .description('Generate a starter template')
    .requiredOption('-f, --format <format>', 'Template format: markdown|html|json|yaml')
    .option('-o, --output <path>', 'Write starter template to file')
    .action(async (options: { format: string; output?: string }) => {
      const config = loadConfig();
      const finalOptions = applyConfig(options, config) as typeof options;
      const starter = await initCommand({
        format: finalOptions.format,
        output: finalOptions.output,
      });
      if (!finalOptions.output) {
        process.stdout.write(starter);
      }
    });

  return program;
}

export async function main(argv = process.argv): Promise<void> {
  const program = createProgram();

  try {
    await program.parseAsync(argv);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 1;
  }
}

/* v8 ignore start */
const isDirectExecution = process.argv[1]?.endsWith('cli.js') ?? false;
if (isDirectExecution) {
  void main();
}
/* v8 ignore stop */
