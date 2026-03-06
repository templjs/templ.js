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
  const quiet = argv.includes('--quiet') || argv.includes('-q');
  const verbose = quiet ? false : argv.includes('--verbose') || argv.includes('-v');
  const json = argv.includes('--json');
  return { quiet, verbose, json };
}

export function writeVerbose(mode: OutputMode, message: string): void {
  if (!mode.verbose || mode.json || mode.quiet) {
    return;
  }
  process.stderr.write(`[verbose] ${message}\n`);
}

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
