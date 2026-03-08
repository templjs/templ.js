import type { Command } from 'commander';

export interface OutputMode {
  quiet: boolean;
  verbose: boolean;
  json: boolean;
}

export interface JsonSuccessPayload {
  command: 'render' | 'validate' | 'init';
  data: Record<string, unknown>;
}

export function resolveOutputModeFromCommand(command: Command): OutputMode {
  const options = command.optsWithGlobals() as Record<string, unknown>;
  const quiet = options.quiet === true;
  return {
    quiet,
    verbose: quiet ? false : options.verbose === true,
    json: options.json === true,
  };
}

export function resolveOutputModeFromArgv(argv: string[]): OutputMode {
  let quiet = false;
  let verbose = false;
  let json = false;

  for (const arg of argv) {
    if (arg === '--') {
      break;
    }

    if (!arg.startsWith('-') || arg === '-') {
      continue;
    }

    if (arg.startsWith('--')) {
      if (arg === '--quiet') {
        quiet = true;
      } else if (arg === '--verbose') {
        verbose = true;
      } else if (arg === '--json') {
        json = true;
      }
      continue;
    }

    for (let i = 1; i < arg.length; i += 1) {
      const flag = arg[i];
      if (flag === 'q') {
        quiet = true;
      } else if (flag === 'v') {
        verbose = true;
      }
    }
  }

  if (quiet) {
    verbose = false;
  }

  return { quiet, verbose, json };
}

export function writeVerbose(mode: OutputMode, message: string): void {
  if (!mode.verbose || mode.json || mode.quiet) {
    return;
  }
  process.stderr.write(`[verbose] ${message}\n`);
}

/**
 * Writes success output according to the selected output mode.
 *
 * In JSON mode, output is newline-terminated.
 * In text mode, `textOutput` is written as-is via `process.stdout.write(textOutput)`
 * without appending a trailing `\n` to preserve streaming/chunked output behavior.
 */
export function writeSuccess(
  mode: OutputMode,
  payload: JsonSuccessPayload,
  textOutput?: string
): void {
  if (mode.quiet) {
    return;
  }

  if (mode.json) {
    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        command: payload.command,
        ...payload.data,
      })}\n`
    );
    return;
  }

  if (textOutput !== undefined) {
    process.stdout.write(textOutput);
  }
}

export function writeError(
  mode: OutputMode,
  command: string,
  message: string,
  suggestion?: string
): void {
  if (mode.json) {
    process.stderr.write(
      `${JSON.stringify({
        ok: false,
        command,
        error: message,
        ...(suggestion ? { suggestion } : {}),
      })}\n`
    );
    return;
  }

  process.stderr.write(`Error: ${message}\n`);
  if (suggestion) {
    process.stderr.write(`Hint: ${suggestion}\n`);
  }
}
