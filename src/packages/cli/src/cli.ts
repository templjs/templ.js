#!/usr/bin/env node

/**
 * @templjs/cli - Command-line interface for templjs
 *
 * Usage:
 *   templjs render --template <path> --input <path|->
 *   templjs validate --template <path>
 *   templjs init --format <markdown|html|json|yaml>
 *   templjs --help
 *   templjs --version
 */

import { writeFileSync } from 'fs';
import { Command, CommanderError } from 'commander';
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

const RENDER_INPUT_FORMATS = ['json', 'yaml', 'toml', 'xml'] as const;
const RENDER_OUTPUT_FORMATS = ['text', 'json', 'html', 'markdown'] as const;
const INIT_FORMATS = ['markdown', 'html', 'json', 'yaml'] as const;

type InitFormat = (typeof INIT_FORMATS)[number];

interface RenderActionOptions {
  template?: string;
  input: string;
  output?: string;
  watch?: boolean;
  inputFormat?: string;
  outputFormat?: string;
  experimentalStreamJson?: boolean;
  validateInput?: boolean;
  validateOutput?: boolean;
}

interface ValidateActionOptions {
  template?: string;
  schema?: string;
  input?: string;
}

interface InitActionOptions {
  format?: string;
  output?: string;
  outputFormat?: string;
}

function requireTemplatePath(template: string | undefined): string {
  if (template === undefined) {
    throw new Error(
      'Template file path is required (pass --template or set defaultTemplate in .templjs.json)'
    );
  }

  if (template.trim().length === 0) {
    throw new Error('Template file path must not be empty');
  }

  return template;
}

function parseEnumOption<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  optionLabel: string
): T | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (allowed.includes(value as T)) {
    return value as T;
  }

  throw new Error(`Unsupported ${optionLabel} "${value}". Use one of: ${allowed.join(', ')}`);
}

function parseInitFormat(format: string | undefined): InitFormat {
  if (format === undefined) {
    throw new Error(
      'Template format is required (pass --format or set outputFormat in .templjs.json)'
    );
  }

  const parsed = parseEnumOption(format, INIT_FORMATS, 'init format');
  if (parsed === undefined) {
    throw new Error(`Unsupported init format "${format}". Use one of: ${INIT_FORMATS.join(', ')}`);
  }

  return parsed;
}

function normalizeCommanderErrorMessage(error: CommanderError): string {
  return error.message.replace(/^error:\s*/i, '').trim();
}

function trimTrailingNewline(value: string): string {
  return value.replace(/\r?\n$/, '');
}

function createWatchModeDependencies(
  mode: ReturnType<typeof resolveOutputModeFromCommand>,
  outputFormat: string,
  outputPath: string | undefined
): typeof defaultWatchModeDependencies {
  return {
    ...defaultWatchModeDependencies,
    writeOutput: (path: string, data: string, encoding: BufferEncoding): void => {
      defaultWatchModeDependencies.writeOutput(path, data, encoding);
      if (mode.quiet) {
        return;
      }

      if (mode.json) {
        writeSuccess(mode, {
          command: 'render',
          data: {
            watch: true,
            wroteFile: true,
            outputPath: path,
            outputFormat,
          },
        });
        return;
      }

      writeVerbose(mode, `Watch render wrote output to "${path}"`);
    },
    writeStdout: (data: string): boolean => {
      if (mode.quiet) {
        return true;
      }

      if (mode.json) {
        writeSuccess(mode, {
          command: 'render',
          data: {
            watch: true,
            wroteFile: false,
            output: trimTrailingNewline(data),
            outputFormat,
          },
        });
        return true;
      }

      return process.stdout.write(data);
    },
    writeStderr: (data: string): boolean => {
      const trimmed = trimTrailingNewline(data);

      if (trimmed.startsWith('Watching ')) {
        if (mode.quiet || mode.json) {
          return true;
        }
        return process.stderr.write(data);
      }

      const watchErrorPrefixes = [
        'Error: ',
        'Watch error: ',
        'Unexpected watch render loop error: ',
        'Unexpected watch mode startup error: ',
      ];

      for (const prefix of watchErrorPrefixes) {
        if (trimmed.startsWith(prefix)) {
          if (mode.quiet || mode.json) {
            writeError(mode, 'render', trimmed.slice(prefix.length));
            return true;
          }

          return process.stderr.write(data);
        }
      }

      if (mode.quiet) {
        return true;
      }

      if (mode.json) {
        writeError(mode, 'render', trimmed, outputPath ? `Output path: ${outputPath}` : undefined);
        return true;
      }

      return process.stderr.write(data);
    },
  };
}

function createProgram(): Command {
  const program = new Command();

  program
    .configureOutput({
      writeOut: (str) => {
        process.stdout.write(str);
      },
      writeErr: () => {
        // Parse/usage errors are normalized through main() and output-policy.
      },
    })
    .exitOverride()
    .name('templjs')
    .description('CLI for rendering and validating templjs templates')
    .option('-q, --quiet', 'Suppress non-error output')
    .option('-v, --verbose', 'Show debug output and timing information')
    .option('--json', 'Emit deterministic JSON output for machine parsing')
    .version(version);

  program
    .command('render')
    .description('Render template with data (json|yaml|toml|xml)')
    .option('-t, --template <path>', 'Template file path')
    .requiredOption('-i, --input <path>', 'Input file path or "-" for stdin')
    .option('--input-format <format>', 'Input format override (json|yaml|toml|xml)')
    .option('--output-format <format>', 'Output format override (text|json|html|markdown)')
    .option('--experimental-stream-json', 'Use experimental streaming JSON parser for render input')
    .option('-o, --output <path>', 'Output file path (defaults to stdout)')
    .option('-w, --watch', 'Watch template/input files and re-render on changes')
    .option('--no-validate-input', 'Skip input validation when supported by core')
    .option('--no-validate-output', 'Skip output validation when supported by core')
    .action(async (options: RenderActionOptions, command: Command) => {
      const mode = resolveOutputModeFromCommand(command);
      const startedAt = Date.now();
      const finalOptions = applyConfig(options, loadConfig());
      const templatePath = requireTemplatePath(finalOptions.template);
      const inputFormat = parseEnumOption(
        finalOptions.inputFormat,
        RENDER_INPUT_FORMATS,
        'input format'
      );
      const outputFormat =
        parseEnumOption(finalOptions.outputFormat, RENDER_OUTPUT_FORMATS, 'output format') ??
        'text';

      if (finalOptions.watch === true) {
        writeVerbose(mode, 'Starting watch mode');
        // Clean up global signal handlers before watch mode registers its own
        globalSignalCleanup?.();
        globalSignalCleanup = undefined;
        await startRenderWatchMode(
          {
            template: templatePath,
            input: finalOptions.input,
            output: finalOptions.output,
          },
          {
            ...createWatchModeDependencies(mode, outputFormat, finalOptions.output),
            render: (watchTemplatePath: string, watchInputPath: string) =>
              renderCommand(watchTemplatePath, watchInputPath, {
                experimentalStreamJson:
                  finalOptions.experimentalStreamJson === true ||
                  process.env.TEMPLJS_EXPERIMENTAL_STREAM_JSON === '1',
                inputFormat,
                outputFormat,
                validateInput: finalOptions.validateInput,
                validateOutput: finalOptions.validateOutput,
              }),
          }
        );
        return;
      }

      writeVerbose(mode, `Rendering template "${templatePath}" with input "${finalOptions.input}"`);
      const rendered = await renderCommand(templatePath, finalOptions.input, {
        experimentalStreamJson:
          finalOptions.experimentalStreamJson === true ||
          process.env.TEMPLJS_EXPERIMENTAL_STREAM_JSON === '1',
        inputFormat,
        outputFormat,
        validateInput: finalOptions.validateInput,
        validateOutput: finalOptions.validateOutput,
        progressReporter:
          mode.quiet || mode.json ? undefined : process.stderr.write.bind(process.stderr),
      });

      const durationMs = Date.now() - startedAt;
      if (finalOptions.output) {
        writeFileSync(finalOptions.output, rendered, 'utf-8');
        writeVerbose(mode, `Wrote render output to "${finalOptions.output}" in ${durationMs}ms`);
        writeSuccess(mode, {
          command: 'render',
          data: {
            wroteFile: true,
            outputPath: finalOptions.output,
            outputFormat,
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
            outputFormat,
            durationMs,
          },
        },
        `${rendered}\n`
      );
    });

  program
    .command('validate')
    .description('Validate template syntax and optional schema/input compatibility')
    .option('-t, --template <path>', 'Template file path')
    .option('-s, --schema <path>', 'Optional schema file path')
    .option('-i, --input <path>', 'Optional input data path to validate against schema')
    .action(async (options: ValidateActionOptions, command: Command) => {
      const mode = resolveOutputModeFromCommand(command);
      const startedAt = Date.now();
      const finalOptions = applyConfig(options, loadConfig());
      const templatePath = requireTemplatePath(finalOptions.template);
      const result = await validateCommand(templatePath, finalOptions.schema, finalOptions.input);
      const durationMs = Date.now() - startedAt;

      if (!result.valid) {
        const details = result.errors.length > 0 ? `: ${result.errors.join('; ')}` : '';
        throw new Error(`Validation failed${details}`);
      }

      writeSuccess(
        mode,
        {
          command: 'validate',
          data: {
            valid: true,
            durationMs,
          },
        },
        'Template is valid\n'
      );
      writeVerbose(mode, `Validation completed in ${durationMs}ms`);
    });

  program
    .command('init')
    .description('Generate a starter template')
    .option('-f, --format <format>', 'Template format: markdown|html|json|yaml')
    .option('--output-format <format>', 'Format fallback from config/flags')
    .option('-o, --output <path>', 'Write starter template to file')
    .action(async (options: InitActionOptions, command: Command) => {
      const mode = resolveOutputModeFromCommand(command);
      const startedAt = Date.now();
      const finalOptions = applyConfig(options, loadConfig());
      const resolvedFormat = parseInitFormat(finalOptions.format ?? finalOptions.outputFormat);

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
    });

  return program;
}

// Global signal handler cleanup function, shared between main() and action handlers
let globalSignalCleanup: (() => void) | undefined;

export async function main(argv = process.argv): Promise<void> {
  const program = createProgram();
  // Register signal handlers for non-watch-mode commands
  // Watch mode will clean these up and register its own handlers
  globalSignalCleanup = registerSignalHandlers();
  const mode = resolveOutputModeFromArgv(argv);

  try {
    await program.parseAsync(argv);
  } catch (error) {
    if (error instanceof CommanderError) {
      if (error.code === 'commander.helpDisplayed' || error.code === 'commander.version') {
        return;
      }

      const message = normalizeCommanderErrorMessage(error);
      const tty = detectTTY();
      const suggestion = provideErrorSuggestion(message);
      writeError(mode, 'main', message, tty.isInteractive ? suggestion : undefined);
      process.exitCode = error.exitCode > 0 ? error.exitCode : 1;
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    const tty = detectTTY();
    const suggestion = provideErrorSuggestion(message);
    writeError(mode, 'main', message, tty.isInteractive ? suggestion : undefined);
    process.exitCode = 1;
  } finally {
    globalSignalCleanup?.();
    globalSignalCleanup = undefined;
  }
}

/* v8 ignore start */
const isDirectExecution = process.argv[1]?.endsWith('cli.js') ?? false;
if (isDirectExecution) {
  void main();
}
/* v8 ignore stop */
