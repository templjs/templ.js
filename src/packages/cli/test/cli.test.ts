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
});
