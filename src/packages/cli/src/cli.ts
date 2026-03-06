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
import { defaultWatchModeDependencies, startRenderWatchMode } from './watch-mode.js';
import { registerSignalHandlers } from './signal-handler.js';
import { detectTTY } from './tty-detection.js';
import { provideErrorSuggestion } from './error-formatter.js';
import {
  resolveOutputModeFromArgv,
  resolveOutputModeFromCommand,
  writeError,
  writeSuccess,
  writeVerbose,
} from './output-policy.js';

function createProgram(): Command {
  const program = new Command();

  program
    .name('templjs')
    .description('CLI for rendering and validating templjs templates')
    .option('-q, --quiet', 'Suppress non-error output')
    .option('-v, --verbose', 'Show debug output and timing information')
    .option('--json', 'Emit deterministic JSON output for machine parsing')
    .version(version);

  program
    .command('render')
    .description('Render template with JSON data')
    .option('-t, --template <path>', 'Template file path')
    .requiredOption(
      '-i, --input <path>',
      'Input file path or "-" for stdin (inline JSON not supported)'
    )
    .option('--input-format <format>', 'Input format override (json|yaml|toml|xml)')
    .option('--output-format <format>', 'Output format override (text|json|html|markdown)')
    .option('-o, --output <path>', 'Output file path (defaults to stdout)')
    .option('-w, --watch', 'Watch template/input files and re-render on changes')
    .option('--no-validate-input', 'Skip input validation when supported by core')
    .option('--no-validate-output', 'Skip output validation when supported by core')
    .action(
      async (
        options: {
          template?: string;
          input: string;
          output?: string;
          watch: boolean;
          inputFormat?: string;
          outputFormat?: string;
          validateInput: boolean;
          validateOutput: boolean;
        },
        command: Command
      ) => {
        const mode = resolveOutputModeFromCommand(command);
        const startedAt = Date.now();
        const config = loadConfig();
        const finalOptions = applyConfig(options, config) as typeof options;
        if (finalOptions.template === undefined) {
          throw new Error(
            'Template file path is required (pass --template or set defaultTemplate in .templjs.json)'
          );
        }
        if (finalOptions.template.trim().length === 0) {
          throw new Error('Template file path must not be empty');
        }
        if (finalOptions.inputFormat !== undefined && finalOptions.inputFormat !== 'json') {
          throw new Error(
            `Unsupported input format "${finalOptions.inputFormat}". Only "json" is currently supported in render`
          );
        }
        if (finalOptions.outputFormat !== undefined && finalOptions.outputFormat !== 'text') {
          throw new Error(
            `Unsupported output format "${finalOptions.outputFormat}". Only "text" is currently supported in render`
          );
        }
        if (finalOptions.watch) {
          writeVerbose(mode, 'Starting watch mode');
          await startRenderWatchMode(
            {
              template: finalOptions.template,
              input: finalOptions.input,
              output: finalOptions.output,
            },
            {
              ...defaultWatchModeDependencies,
              render: renderCommand,
            }
          );
          return;
        }
        writeVerbose(
          mode,
          `Rendering template "${finalOptions.template}" with input "${finalOptions.input}"`
        );
        const rendered = await renderCommand(finalOptions.template, finalOptions.input);
        const durationMs = Date.now() - startedAt;
        if (finalOptions.output) {
          writeFileSync(finalOptions.output, rendered, 'utf-8');
          writeVerbose(mode, `Wrote render output to "${finalOptions.output}" in ${durationMs}ms`);
          writeSuccess(mode, {
            command: 'render',
            data: {
              wroteFile: true,
              outputPath: finalOptions.output,
              durationMs,
            },
          });
          return;
        }
        writeVerbose(mode, `Render completed in ${durationMs}ms`);
        writeSuccess(
          mode,
          {
            command: 'render',
            data: {
              wroteFile: false,
              output: rendered,
              durationMs,
            },
          },
          `${rendered}\n`
        );
      }
    );

  program
    .command('validate')
    .description('Validate template syntax')
    .option('-t, --template <path>', 'Template file path')
    .option('-s, --schema <path>', 'Optional schema path (future core integration)')
    .action(async (options: { template?: string; schema?: string }, command: Command) => {
      const mode = resolveOutputModeFromCommand(command);
      const startedAt = Date.now();
      const config = loadConfig();
      const finalOptions = applyConfig(options, config) as typeof options;
      if (finalOptions.template === undefined) {
        throw new Error(
          'Template file path is required (pass --template or set defaultTemplate in .templjs.json)'
        );
      }
      if (finalOptions.template.trim().length === 0) {
        throw new Error('Template file path must not be empty');
      }
      const valid = await validateCommand(finalOptions.template, finalOptions.schema);
      const durationMs = Date.now() - startedAt;
      writeSuccess(
        mode,
        {
          command: 'validate',
          data: {
            valid,
            durationMs,
          },
        },
        valid ? 'Template is valid\n' : 'Template has errors\n'
      );
      writeVerbose(mode, `Validation completed in ${durationMs}ms`);
      if (!valid) {
        process.exitCode = 1;
      }
    });

  program
    .command('init')
    .description('Generate a starter template')
    .option('-f, --format <format>', 'Template format: markdown|html|json|yaml')
    .option('--output-format <format>', 'Format fallback from config/flags')
    .option('-o, --output <path>', 'Write starter template to file')
    .action(
      async (
        options: { format?: string; output?: string; outputFormat?: string },
        command: Command
      ) => {
        const mode = resolveOutputModeFromCommand(command);
        const startedAt = Date.now();
        const config = loadConfig();
        const finalOptions = applyConfig(options, config) as typeof options;
        const resolvedFormat = finalOptions.format ?? finalOptions.outputFormat;
        if (resolvedFormat === undefined) {
          throw new Error(
            'Template format is required (pass --format or set outputFormat in .templjs.json)'
          );
        }
        if (!['markdown', 'html', 'json', 'yaml'].includes(resolvedFormat)) {
          throw new Error(
            `Unsupported init format "${resolvedFormat}". Use one of: markdown, html, json, yaml`
          );
        }
        const starter = await initCommand({
          format: resolvedFormat,
          output: finalOptions.output,
        });
        const durationMs = Date.now() - startedAt;
        if (finalOptions.output) {
          writeVerbose(
            mode,
            `Starter template written to "${finalOptions.output}" in ${durationMs}ms`
          );
          writeSuccess(mode, {
            command: 'init',
            data: {
              wroteFile: true,
              outputPath: finalOptions.output,
              format: resolvedFormat,
              durationMs,
            },
          });
          return;
        }
        writeVerbose(mode, `Starter template generated in ${durationMs}ms`);
        writeSuccess(
          mode,
          {
            command: 'init',
            data: {
              wroteFile: false,
              format: resolvedFormat,
              output: starter,
              durationMs,
            },
          },
          starter
        );
      }
    );

  return program;
}

export async function main(argv = process.argv): Promise<void> {
  const program = createProgram();
  const watchModeRequested = argv.includes('--watch') || argv.includes('-w');
  const cleanupSignalHandlers = watchModeRequested ? undefined : registerSignalHandlers();
  const mode = resolveOutputModeFromArgv(argv);

  try {
    await program.parseAsync(argv);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const tty = detectTTY();
    const suggestion = provideErrorSuggestion(message);
    writeError(mode, 'main', message, tty.isInteractive ? suggestion : undefined);
    process.exitCode = 1;
  } finally {
    cleanupSignalHandlers?.();
  }
}

/* v8 ignore start */
const isDirectExecution = process.argv[1]?.endsWith('cli.js') ?? false;
if (isDirectExecution) {
  void main();
}
/* v8 ignore stop */
