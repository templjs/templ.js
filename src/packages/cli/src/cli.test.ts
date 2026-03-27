import { beforeEach, afterAll, describe, expect, it, vi } from 'vitest';

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    accessSync: vi.fn(() => {
      const error = new Error('not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    }),
    writeFileSync: vi.fn(),
  };
});

vi.mock('./commands/init.js', () => ({
  initCommand: vi.fn(),
}));

vi.mock('./commands/render.js', () => ({
  renderCommand: vi.fn(),
}));

vi.mock('./commands/validate.js', () => ({
  validateCommand: vi.fn(),
}));

vi.mock('./watch-mode.js', async () => {
  const actual = await vi.importActual<typeof import('./watch-mode.js')>('./watch-mode.js');

  return {
    WATCH_ERROR_PREFIXES: actual.WATCH_ERROR_PREFIXES,
    defaultWatchModeDependencies: {
      fileExists: vi.fn(),
      render: vi.fn(),
      watchFile: vi.fn(),
      writeOutput: vi.fn(),
      writeStdout: vi.fn(),
      writeStderr: vi.fn(),
      addSignalListener: vi.fn(),
      removeSignalListener: vi.fn(),
      setProcessExitCode: vi.fn(),
    },
    startRenderWatchMode: vi.fn(),
  };
});

import { writeFileSync } from 'fs';
import { main } from './cli.js';
import { initCommand } from './commands/init.js';
import { renderCommand } from './commands/render.js';
import { validateCommand } from './commands/validate.js';
import { startRenderWatchMode } from './watch-mode.js';

interface JsonEnvelope {
  ok: boolean;
  command: string;
  output?: string;
  wroteFile?: boolean;
  outputPath?: string;
  watch?: boolean;
  valid?: boolean;
  error?: string;
}

describe('cli-main', () => {
  const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

  beforeEach(() => {
    vi.clearAllMocks();
    process.exitCode = undefined;
  });
  afterAll(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  function parseLastStdoutEnvelope(): JsonEnvelope {
    if (stdoutSpy.mock.calls.length === 0) {
      throw new Error('No stdout output written');
    }
    const lastStdoutCall = stdoutSpy.mock.calls.at(-1)?.[0];
    if (typeof lastStdoutCall !== 'string') {
      throw new Error('Last stdout write argument was undefined or non-string');
    }
    const raw = lastStdoutCall;

    try {
      return JSON.parse(raw) as JsonEnvelope;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to parse stdout JSON envelope: ${message}. Raw stdout: ${raw}`, {
        cause: error,
      });
    }
  }

  function parseLastStderrEnvelope(): JsonEnvelope {
    if (stderrSpy.mock.calls.length === 0) {
      throw new Error('No stderr output written');
    }
    const lastStderrCall = stderrSpy.mock.calls.at(-1)?.[0];
    if (typeof lastStderrCall !== 'string') {
      throw new Error('Last stderr write argument was undefined or non-string');
    }
    const raw = lastStderrCall;

    try {
      return JSON.parse(raw) as JsonEnvelope;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to parse stderr JSON envelope: ${message}. Raw stderr: ${raw}`, {
        cause: error,
      });
    }
  }

  describe('render command', () => {
    it('renders to stdout when no output path is provided', async () => {
      vi.mocked(renderCommand).mockResolvedValue('rendered-output');

      await main(['node', 'cli.js', 'render', '-t', 'template.templ', '-i', 'data.json']);

      expect(renderCommand).toHaveBeenCalledWith(
        'template.templ',
        'data.json',
        expect.objectContaining({ outputFormat: 'text' })
      );
      expect(stdoutSpy).toHaveBeenCalledWith('rendered-output\n');
      expect(writeFileSync).not.toHaveBeenCalled();
    });

    it('passes experimental stream-json option to render command when enabled', async () => {
      vi.mocked(renderCommand).mockResolvedValue('rendered-output');

      await main([
        'node',
        'cli.js',
        'render',
        '-t',
        'template.templ',
        '-i',
        'data.json',
        '--experimental-stream-json',
      ]);

      expect(renderCommand).toHaveBeenCalledWith(
        'template.templ',
        'data.json',
        expect.objectContaining({
          experimentalStreamJson: true,
          outputFormat: 'text',
        })
      );
    });

    it('passes validateInput=false to render command when --no-validate-input is used', async () => {
      vi.mocked(renderCommand).mockResolvedValue('rendered-output');

      await main([
        'node',
        'cli.js',
        'render',
        '-t',
        'template.templ',
        '-i',
        'data.json',
        '--no-validate-input',
      ]);

      expect(renderCommand).toHaveBeenCalledWith(
        'template.templ',
        'data.json',
        expect.objectContaining({
          validateInput: false,
        })
      );
    });

    it('suppresses render stdout in quiet mode', async () => {
      vi.mocked(renderCommand).mockResolvedValue('rendered-output');

      await main([
        'node',
        'cli.js',
        '--quiet',
        'render',
        '-t',
        'template.templ',
        '-i',
        'data.json',
      ]);

      expect(renderCommand).toHaveBeenCalledWith(
        'template.templ',
        'data.json',
        expect.objectContaining({ outputFormat: 'text' })
      );
      expect(stdoutSpy).not.toHaveBeenCalledWith('rendered-output\n');
    });

    it('emits json envelope for render to stdout', async () => {
      vi.mocked(renderCommand).mockResolvedValue('rendered-output');

      await main(['node', 'cli.js', '--json', 'render', '-t', 'template.templ', '-i', 'data.json']);

      expect(renderCommand).toHaveBeenCalledWith(
        'template.templ',
        'data.json',
        expect.objectContaining({ outputFormat: 'text' })
      );
      const parsed = parseLastStdoutEnvelope();

      expect(parsed.ok).toBe(true);
      expect(parsed.command).toBe('render');
      expect(parsed.output).toBe('rendered-output');
    });

    it('emits json envelope for render with output file', async () => {
      vi.mocked(renderCommand).mockResolvedValue('rendered-output');

      await main([
        'node',
        'cli.js',
        '--json',
        'render',
        '-t',
        'template.templ',
        '-i',
        'data.json',
        '-o',
        'result.txt',
      ]);

      expect(writeFileSync).toHaveBeenCalledWith('result.txt', 'rendered-output', 'utf-8');
      const parsed = parseLastStdoutEnvelope();
      expect(parsed.ok).toBe(true);
      expect(parsed.command).toBe('render');
      expect(parsed.wroteFile).toBe(true);
      expect(parsed.outputPath).toBe('result.txt');
    });

    it('renders to file when output path is provided', async () => {
      vi.mocked(renderCommand).mockResolvedValue('rendered-output');

      await main([
        'node',
        'cli.js',
        'render',
        '-t',
        'template.templ',
        '-i',
        'data.json',
        '-o',
        'result.txt',
      ]);

      expect(renderCommand).toHaveBeenCalledWith(
        'template.templ',
        'data.json',
        expect.objectContaining({ outputFormat: 'text' })
      );
      expect(writeFileSync).toHaveBeenCalledWith('result.txt', 'rendered-output', 'utf-8');
    });

    it('writes verbose diagnostics to stderr', async () => {
      vi.mocked(renderCommand).mockResolvedValue('rendered-output');

      await main([
        'node',
        'cli.js',
        '--verbose',
        'render',
        '-t',
        'template.templ',
        '-i',
        'data.json',
      ]);

      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('[verbose]'));
    });

    it('quiet mode overrides verbose output', async () => {
      vi.mocked(renderCommand).mockResolvedValue('rendered-output');

      await main([
        'node',
        'cli.js',
        '--quiet',
        '--verbose',
        'render',
        '-t',
        'template.templ',
        '-i',
        'data.json',
      ]);

      expect(stderrSpy).not.toHaveBeenCalledWith(expect.stringContaining('[verbose]'));
      expect(stdoutSpy).not.toHaveBeenCalledWith('rendered-output\n');
    });

    it('passes supported render input format overrides to render command', async () => {
      vi.mocked(renderCommand).mockResolvedValue('rendered-output');

      await main([
        'node',
        'cli.js',
        'render',
        '-t',
        'template.templ',
        '-i',
        'data.yaml',
        '--input-format',
        'yaml',
      ]);

      expect(renderCommand).toHaveBeenCalledWith(
        'template.templ',
        'data.yaml',
        expect.objectContaining({
          inputFormat: 'yaml',
          outputFormat: 'text',
        })
      );
      expect(process.exitCode).toBeUndefined();
    });

    it('passes supported render output format overrides to render command', async () => {
      vi.mocked(renderCommand).mockResolvedValue('<p>ok</p>');

      await main([
        'node',
        'cli.js',
        'render',
        '-t',
        'template.templ',
        '-i',
        'data.json',
        '--output-format',
        'html',
      ]);

      expect(renderCommand).toHaveBeenCalledWith(
        'template.templ',
        'data.json',
        expect.objectContaining({
          outputFormat: 'html',
        })
      );
      expect(process.exitCode).toBeUndefined();
    });

    it('errors when render template is missing and no config default is available', async () => {
      await main(['node', 'cli.js', 'render', '-i', 'data.json']);

      expect(stderrSpy).toHaveBeenCalledWith(
        'Error: Template file path is required (pass --template or set defaultTemplate in .templjs.json)\n'
      );
      expect(process.exitCode).toBe(1);
    });

    it('errors when template path is explicitly empty', async () => {
      await main(['node', 'cli.js', 'render', '-t', '', '-i', 'data.json']);

      expect(stderrSpy).toHaveBeenCalledWith('Error: Template file path must not be empty\n');
      expect(process.exitCode).toBe(1);
    });

    it('errors on unsupported render input format values', async () => {
      await main([
        'node',
        'cli.js',
        'render',
        '-t',
        'template.templ',
        '-i',
        'data.json',
        '--input-format',
        'ini',
      ]);

      expect(stderrSpy).toHaveBeenCalledWith(
        'Error: Unsupported input format "ini". Use one of: json, yaml, toml, xml\n'
      );
      expect(process.exitCode).toBe(1);
    });

    it('errors on unsupported render output format values', async () => {
      await main([
        'node',
        'cli.js',
        'render',
        '-t',
        'template.templ',
        '-i',
        'data.json',
        '--output-format',
        'yaml',
      ]);

      expect(stderrSpy).toHaveBeenCalledWith(
        'Error: Unsupported output format "yaml". Use one of: text, json, html, markdown\n'
      );
      expect(process.exitCode).toBe(1);
    });
  });

  describe('watch mode', () => {
    it('delegates to watch mode when --watch is provided', async () => {
      vi.mocked(startRenderWatchMode).mockResolvedValue();

      await main([
        'node',
        'cli.js',
        'render',
        '-t',
        'template.templ',
        '-i',
        'data.json',
        '--watch',
      ]);

      expect(startRenderWatchMode).toHaveBeenCalledTimes(1);
      expect(vi.mocked(startRenderWatchMode).mock.calls[0]?.[0]).toEqual({
        template: 'template.templ',
        input: 'data.json',
        output: undefined,
      });
      const watchDeps = vi.mocked(startRenderWatchMode).mock.calls[0]?.[1];
      expect(watchDeps).toBeDefined();
      expect(typeof watchDeps?.writeOutput).toBe('function');
      expect(typeof watchDeps?.render).toBe('function');
      expect(renderCommand).not.toHaveBeenCalled();

      await watchDeps!.render('template.templ', 'data.json');
      expect(renderCommand).toHaveBeenCalledWith(
        'template.templ',
        'data.json',
        expect.objectContaining({ outputFormat: 'text' })
      );

      // CLI routes watch status messages (non-error) to stdout for cleaner output separation
      watchDeps?.writeStderr('Watching template.templ and data.json. Press Ctrl+C to stop.\n');
      expect(stdoutSpy).toHaveBeenCalledWith(
        'Watching template.templ and data.json. Press Ctrl+C to stop.\n'
      );

      watchDeps?.writeStderr('Watch error: exploded\n');
      expect(stderrSpy).toHaveBeenCalledWith('Watch error: exploded\n');
    });

    it('emits json envelopes for watch render output in json mode', async () => {
      vi.mocked(startRenderWatchMode).mockResolvedValue();

      await main([
        'node',
        'cli.js',
        '--json',
        'render',
        '-t',
        'template.templ',
        '-i',
        'data.json',
        '--watch',
      ]);

      const watchDeps = vi.mocked(startRenderWatchMode).mock.calls[0]?.[1];
      expect(watchDeps).toBeDefined();

      watchDeps?.writeStdout('rendered-output\n');
      const stdoutEnvelope = parseLastStdoutEnvelope();
      expect(stdoutEnvelope.ok).toBe(true);
      expect(stdoutEnvelope.command).toBe('render');
      expect(stdoutEnvelope.watch).toBe(true);
      expect(stdoutEnvelope.output).toBe('rendered-output');

      watchDeps?.writeStderr('Error: watch exploded\n');
      const stderrEnvelope = parseLastStderrEnvelope();
      expect(stderrEnvelope.ok).toBe(false);
      expect(stderrEnvelope.command).toBe('render');
      expect(stderrEnvelope.error).toBe('watch exploded');

      watchDeps?.writeStderr('\n');
      const fallbackEnvelope = parseLastStderrEnvelope();
      expect(fallbackEnvelope.ok).toBe(false);
      expect(fallbackEnvelope.error).toBe('\n');
    });

    it('suppresses non-error watch output in quiet mode', async () => {
      vi.mocked(startRenderWatchMode).mockResolvedValue();

      await main([
        'node',
        'cli.js',
        '--quiet',
        'render',
        '-t',
        'template.templ',
        '-i',
        'data.json',
        '--watch',
      ]);

      const watchDeps = vi.mocked(startRenderWatchMode).mock.calls[0]?.[1];
      expect(watchDeps).toBeDefined();
      watchDeps?.writeStdout('rendered-output\n');
      watchDeps?.writeStderr('Watching template.templ and data.json. Press Ctrl+C to stop.\n');
      expect(stdoutSpy).not.toHaveBeenCalledWith('rendered-output\n');
      expect(stderrSpy).not.toHaveBeenCalledWith(
        'Watching template.templ and data.json. Press Ctrl+C to stop.\n'
      );

      // Unrecognized warnings without known prefixes are promoted to errors in quiet mode
      watchDeps?.writeStderr('odd warning\n');
      expect(stderrSpy).toHaveBeenCalledWith('Error: odd warning\n');

      watchDeps?.writeStderr('Error: still loud\n');
      expect(stderrSpy).toHaveBeenCalledWith('Error: still loud\n');
    });

    it('emits json success envelope when watch mode writes to output file', async () => {
      vi.mocked(startRenderWatchMode).mockResolvedValue();

      await main([
        'node',
        'cli.js',
        '--json',
        'render',
        '-t',
        'template.templ',
        '-i',
        'data.json',
        '--watch',
        '-o',
        'out.txt',
      ]);

      const watchDeps = vi.mocked(startRenderWatchMode).mock.calls[0]?.[1];
      expect(watchDeps).toBeDefined();
      watchDeps?.writeOutput('out.txt', 'rendered-output', 'utf-8');

      expect(writeFileSync).toHaveBeenCalledWith('out.txt', 'rendered-output', 'utf-8');
      const parsed = parseLastStdoutEnvelope();
      expect(parsed.ok).toBe(true);
      expect(parsed.command).toBe('render');
      expect(parsed.watch).toBe(true);
      expect(parsed.wroteFile).toBe(true);
      expect(parsed.outputPath).toBe('out.txt');
    });

    it('reports watch mode startup failures', async () => {
      vi.mocked(startRenderWatchMode).mockRejectedValue(new Error('watch failed'));

      await main([
        'node',
        'cli.js',
        'render',
        '-t',
        'template.templ',
        '-i',
        'data.json',
        '--watch',
      ]);

      expect(stderrSpy).toHaveBeenCalledWith('Error: watch failed\n');
      expect(process.exitCode).toBe(1);
    });
  });

  describe('validate command', () => {
    it('reports template as valid when validation succeeds', async () => {
      vi.mocked(validateCommand).mockResolvedValue({ valid: true, errors: [] });

      await main(['node', 'cli.js', 'validate', '-t', 'template.templ']);

      expect(validateCommand).toHaveBeenCalledWith('template.templ', undefined, undefined);
      expect(stdoutSpy).toHaveBeenCalledWith('Template is valid\n');
      expect(process.exitCode).toBeUndefined();
    });

    it('emits json envelope for validate success', async () => {
      vi.mocked(validateCommand).mockResolvedValue({ valid: true, errors: [] });

      await main(['node', 'cli.js', '--json', 'validate', '-t', 'template.templ']);

      expect(validateCommand).toHaveBeenCalledWith('template.templ', undefined, undefined);
      const parsed = parseLastStdoutEnvelope();
      expect(parsed.ok).toBe(true);
      expect(parsed.command).toBe('validate');
      expect(parsed.valid).toBe(true);
    });

    it('treats validation failures as operational errors', async () => {
      vi.mocked(validateCommand).mockResolvedValue({
        valid: false,
        errors: ['ParserError: unexpected end tag'],
      });

      await main(['node', 'cli.js', 'validate', '-t', 'template.templ']);

      expect(validateCommand).toHaveBeenCalledWith('template.templ', undefined, undefined);
      expect(stderrSpy).toHaveBeenCalledWith(
        'Error: Validation failed: ParserError: unexpected end tag\n'
      );
      expect(process.exitCode).toBe(1);
    });

    it('passes schema and input through to validate command when provided', async () => {
      vi.mocked(validateCommand).mockResolvedValue({
        valid: true,
        errors: [],
      });

      await main([
        'node',
        'cli.js',
        'validate',
        '-t',
        'template.templ',
        '-s',
        'schema.json',
        '-i',
        'input.yaml',
      ]);

      expect(validateCommand).toHaveBeenCalledWith('template.templ', 'schema.json', 'input.yaml');
      expect(process.exitCode).toBeUndefined();
    });

    it('errors when validate template is missing and no config default is available', async () => {
      await main(['node', 'cli.js', 'validate']);

      expect(stderrSpy).toHaveBeenCalledWith(
        'Error: Template file path is required (pass --template or set defaultTemplate in .templjs.json)\n'
      );
      expect(process.exitCode).toBe(1);
    });

    it('errors when validate template path is explicitly empty', async () => {
      await main(['node', 'cli.js', 'validate', '-t', '']);

      expect(stderrSpy).toHaveBeenCalledWith('Error: Template file path must not be empty\n');
      expect(process.exitCode).toBe(1);
    });
  });

  describe('init command', () => {
    it('writes starter template to stdout when no init output is provided', async () => {
      vi.mocked(initCommand).mockResolvedValue('starter-template');

      await main(['node', 'cli.js', 'init', '-f', 'markdown']);

      expect(initCommand).toHaveBeenCalledWith({ format: 'markdown', output: undefined });
      expect(stdoutSpy).toHaveBeenCalledWith('starter-template');
    });

    it('emits json envelope for init without output path', async () => {
      vi.mocked(initCommand).mockResolvedValue('starter-template');

      await main(['node', 'cli.js', '--json', 'init', '-f', 'markdown']);

      expect(initCommand).toHaveBeenCalledWith({ format: 'markdown', output: undefined });
      const parsed = parseLastStdoutEnvelope();
      expect(parsed.ok).toBe(true);
      expect(parsed.command).toBe('init');
      expect(parsed.output).toBe('starter-template');
    });

    it('emits json envelope for init with output path', async () => {
      vi.mocked(initCommand).mockResolvedValue('starter-template');

      await main(['node', 'cli.js', '--json', 'init', '-f', 'json', '-o', 'starter.templ']);

      expect(initCommand).toHaveBeenCalledWith({ format: 'json', output: 'starter.templ' });
      const parsed = parseLastStdoutEnvelope();
      expect(parsed.ok).toBe(true);
      expect(parsed.command).toBe('init');
      expect(parsed.wroteFile).toBe(true);
      expect(parsed.outputPath).toBe('starter.templ');
    });

    it('does not write init output to stdout when output path is provided', async () => {
      vi.mocked(initCommand).mockResolvedValue('starter-template');

      await main(['node', 'cli.js', 'init', '-f', 'json', '-o', 'starter.templ']);

      expect(initCommand).toHaveBeenCalledWith({ format: 'json', output: 'starter.templ' });
      expect(stdoutSpy).not.toHaveBeenCalledWith('starter-template');
    });

    it('uses output-format as init format fallback when format is omitted', async () => {
      vi.mocked(initCommand).mockResolvedValue('starter-template');

      await main(['node', 'cli.js', 'init', '--output-format', 'json']);

      expect(initCommand).toHaveBeenCalledWith({ format: 'json', output: undefined });
    });

    it('errors when init format is missing and no fallback is provided', async () => {
      await main(['node', 'cli.js', 'init']);

      expect(stderrSpy).toHaveBeenCalledWith(
        'Error: Template format is required (pass --format or set outputFormat in .templjs.json)\n'
      );
      expect(process.exitCode).toBe(1);
    });

    it('errors when init fallback format is unsupported', async () => {
      await main(['node', 'cli.js', 'init', '--output-format', 'text']);

      expect(stderrSpy).toHaveBeenCalledWith(
        'Error: Unsupported init format "text". Use one of: markdown, html, json, yaml\n'
      );
      expect(process.exitCode).toBe(1);
    });
  });

  describe('error handling', () => {
    it('catches command failures and sets exit code', async () => {
      vi.mocked(renderCommand).mockRejectedValue(new Error('render exploded'));

      await main(['node', 'cli.js', 'render', '-t', 'template.templ', '-i', 'data.json']);

      expect(stderrSpy).toHaveBeenCalledWith('Error: render exploded\n');
      expect(process.exitCode).toBe(1);
    });

    it('emits json error envelope when json mode is enabled', async () => {
      vi.mocked(renderCommand).mockRejectedValue(new Error('render exploded'));

      await main(['node', 'cli.js', '--json', 'render', '-t', 'template.templ', '-i', 'data.json']);

      const parsed = parseLastStderrEnvelope();
      expect(parsed.ok).toBe(false);
      expect(parsed.command).toBe('main');
      expect(parsed.error).toBe('render exploded');
      expect(process.exitCode).toBe(1);
    });

    it('normalizes commander parse errors through error output policy', async () => {
      await main(['node', 'cli.js', 'unknown-command']);

      expect(stderrSpy).toHaveBeenCalledWith("Error: unknown command 'unknown-command'\n");
      expect(process.exitCode).toBe(1);
    });

    it('handles help output without setting an error exit code', async () => {
      await main(['node', 'cli.js', '--help']);

      expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('Usage: templjs'));
      expect(process.exitCode).toBeUndefined();
    });

    it('emits commander parse errors as json envelope in json mode', async () => {
      await main(['node', 'cli.js', '--json', 'render']);

      const parsed = parseLastStderrEnvelope();
      expect(parsed.ok).toBe(false);
      expect(parsed.command).toBe('main');
      expect(parsed.error).toContain("required option '-i, --input <path>' not specified");
      expect(process.exitCode).toBe(1);
    });
  });
});
