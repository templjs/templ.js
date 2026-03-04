import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('../src/commands/init.js', () => ({
  initCommand: vi.fn(),
}));

vi.mock('../src/commands/render.js', () => ({
  renderCommand: vi.fn(),
}));

vi.mock('../src/commands/validate.js', () => ({
  validateCommand: vi.fn(),
}));

import { writeFileSync } from 'fs';
import { main } from '../src/cli';
import { initCommand } from '../src/commands/init.js';
import { renderCommand } from '../src/commands/render.js';
import { validateCommand } from '../src/commands/validate.js';

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

  it('renders to stdout when no output path is provided', async () => {
    vi.mocked(renderCommand).mockResolvedValue('rendered-output');

    await main(['node', 'cli.js', 'render', '-t', 'template.templ', '-i', '{"name":"World"}']);

    expect(renderCommand).toHaveBeenCalledWith('template.templ', '{"name":"World"}');
    expect(stdoutSpy).toHaveBeenCalledWith('rendered-output\n');
    expect(writeFileSync).not.toHaveBeenCalled();
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
      '{"name":"World"}',
      '-o',
      'result.txt',
    ]);

    expect(renderCommand).toHaveBeenCalledWith('template.templ', '{"name":"World"}');
    expect(writeFileSync).toHaveBeenCalledWith('result.txt', 'rendered-output', 'utf-8');
  });

  it('reports template as valid when validation succeeds', async () => {
    vi.mocked(validateCommand).mockResolvedValue(true);

    await main(['node', 'cli.js', 'validate', '-t', 'template.templ']);

    expect(validateCommand).toHaveBeenCalledWith('template.templ', undefined);
    expect(stdoutSpy).toHaveBeenCalledWith('Template is valid\n');
    expect(process.exitCode).toBeUndefined();
  });

  it('sets exit code when validation fails', async () => {
    vi.mocked(validateCommand).mockResolvedValue(false);

    await main(['node', 'cli.js', 'validate', '-t', 'template.templ']);

    expect(validateCommand).toHaveBeenCalledWith('template.templ', undefined);
    expect(stdoutSpy).toHaveBeenCalledWith('Template has errors\n');
    expect(process.exitCode).toBe(1);
  });

  it('writes starter template to stdout when no init output is provided', async () => {
    vi.mocked(initCommand).mockResolvedValue('starter-template');

    await main(['node', 'cli.js', 'init', '-f', 'markdown']);

    expect(initCommand).toHaveBeenCalledWith({ format: 'markdown', output: undefined });
    expect(stdoutSpy).toHaveBeenCalledWith('starter-template');
  });

  it('does not write init output to stdout when output path is provided', async () => {
    vi.mocked(initCommand).mockResolvedValue('starter-template');

    await main(['node', 'cli.js', 'init', '-f', 'json', '-o', 'starter.templ']);

    expect(initCommand).toHaveBeenCalledWith({ format: 'json', output: 'starter.templ' });
    expect(stdoutSpy).not.toHaveBeenCalledWith('starter-template');
  });

  it('catches command failures and sets exit code', async () => {
    vi.mocked(renderCommand).mockRejectedValue(new Error('render exploded'));

    await main(['node', 'cli.js', 'render', '-t', 'template.templ', '-i', '{"name":"World"}']);

    expect(stderrSpy).toHaveBeenCalledWith('Error: render exploded\n');
    expect(process.exitCode).toBe(1);
  });

  it('errors when render template is missing and no config default is available', async () => {
    await main(['node', 'cli.js', 'render', '-i', '{"name":"World"}']);

    expect(stderrSpy).toHaveBeenCalledWith(
      'Error: Template file path is required (pass --template or set defaultTemplate in .templjs.json)\n'
    );
    expect(process.exitCode).toBe(1);
  });

  it('errors when validate template is missing and no config default is available', async () => {
    await main(['node', 'cli.js', 'validate']);

    expect(stderrSpy).toHaveBeenCalledWith(
      'Error: Template file path is required (pass --template or set defaultTemplate in .templjs.json)\n'
    );
    expect(process.exitCode).toBe(1);
  });

  it('errors when template path is explicitly empty', async () => {
    await main(['node', 'cli.js', 'render', '-t', '', '-i', '{"name":"World"}']);

    expect(stderrSpy).toHaveBeenCalledWith('Error: Template file path must not be empty\n');
    expect(process.exitCode).toBe(1);
  });

  it('errors on unsupported render input format', async () => {
    await main([
      'node',
      'cli.js',
      'render',
      '-t',
      'template.templ',
      '-i',
      '{"name":"World"}',
      '--input-format',
      'yaml',
    ]);

    expect(stderrSpy).toHaveBeenCalledWith(
      'Error: Unsupported input format "yaml". Only "json" is currently supported in render\n'
    );
    expect(process.exitCode).toBe(1);
  });

  it('errors on unsupported render output format', async () => {
    await main([
      'node',
      'cli.js',
      'render',
      '-t',
      'template.templ',
      '-i',
      '{"name":"World"}',
      '--output-format',
      'html',
    ]);

    expect(stderrSpy).toHaveBeenCalledWith(
      'Error: Unsupported output format "html". Only "text" is currently supported in render\n'
    );
    expect(process.exitCode).toBe(1);
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
