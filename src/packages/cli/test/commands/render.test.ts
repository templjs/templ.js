import { describe, expect, it, vi } from 'vitest';
import { Readable } from 'stream';

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(() => false),
  statSync: vi.fn(() => ({ size: 0 })),
  createReadStream: vi.fn(),
}));

vi.mock('@templjs/core', () => ({
  renderTemplate: vi.fn(),
}));

import { createReadStream, readFileSync, statSync } from 'fs';
import { renderTemplate } from '@templjs/core';
import { renderCommand } from '../../src/commands/render';

describe('renderCommand', () => {
  it('renders template output from file and JSON payload', async () => {
    vi.mocked(readFileSync).mockReturnValue('Hello {{ name }}');
    vi.mocked(renderTemplate).mockReturnValue('Hello World');

    const output = await renderCommand('template.templ', '{"name":"World"}');

    expect(output).toBe('Hello World');
    expect(readFileSync).toHaveBeenCalledWith('template.templ', 'utf-8');
    expect(renderTemplate).toHaveBeenCalledWith('Hello {{ name }}', { name: 'World' });
  });

  it('loads JSON payload from input file path when path exists', async () => {
    const { existsSync } = await import('fs');
    vi.mocked(existsSync).mockImplementation((value) => value === 'data.json');
    vi.mocked(statSync).mockReturnValue({ size: 1024 } as ReturnType<typeof statSync>);
    vi.mocked(readFileSync).mockImplementation((value) => {
      if (value === 'template.templ') {
        return 'Hello {{ name }}';
      }
      return '{"name":"FromFile"}';
    });
    vi.mocked(renderTemplate).mockReturnValue('Hello FromFile');

    const output = await renderCommand('template.templ', 'data.json');

    expect(output).toBe('Hello FromFile');
    expect(renderTemplate).toHaveBeenCalledWith('Hello {{ name }}', { name: 'FromFile' });
  });

  it('streams large input files and reports progress', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    try {
      const { existsSync } = await import('fs');
      vi.mocked(existsSync).mockImplementation((value) => value === 'huge.json');
      vi.mocked(statSync).mockReturnValue({ size: 20 * 1024 * 1024 } as ReturnType<
        typeof statSync
      >);
      vi.mocked(createReadStream).mockReturnValue(
        Readable.from(['{"name":"', 'Streamed"}']) as ReturnType<typeof createReadStream>
      );
      vi.mocked(readFileSync).mockReturnValue('Hello {{ name }}');
      vi.mocked(renderTemplate).mockReturnValue('Hello Streamed');

      const output = await renderCommand('template.templ', 'huge.json');

      expect(output).toBe('Hello Streamed');
      expect(createReadStream).toHaveBeenCalledWith('huge.json', { encoding: 'utf-8' });
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('Reading large input file'));
    } finally {
      stderrSpy.mockRestore();
    }
  });

  it('wraps failures with render context', async () => {
    vi.mocked(readFileSync).mockImplementation(() => {
      throw new Error('missing file');
    });

    await expect(renderCommand('missing.templ', '{"x":1}')).rejects.toThrow(
      'Render failed: missing file'
    );
  });

  it('surfaces JSON parsing failures with context', async () => {
    vi.mocked(readFileSync).mockReturnValue('Hello {{ name }}');

    await expect(renderCommand('template.templ', '{bad-json')).rejects.toThrow(
      'Render failed: Failed to parse input data as JSON'
    );
  });

  it('rejects non-object JSON payloads', async () => {
    vi.mocked(readFileSync).mockReturnValue('Hello {{ name }}');

    await expect(renderCommand('template.templ', '["array"]')).rejects.toThrow(
      'Render failed: Failed to parse input data as JSON: Input data must be a JSON object'
    );
  });

  it('reads JSON input from stdin when input is "-"', async () => {
    vi.mocked(readFileSync).mockReturnValue('Hello {{ name }}');
    vi.mocked(renderTemplate).mockReturnValue('Hello Pipe');

    const originalStdinDescriptor = Object.getOwnPropertyDescriptor(process, 'stdin');
    Object.defineProperty(process, 'stdin', {
      configurable: true,
      enumerable: true,
      get: () => Readable.from(['{"name":"Pipe"}']),
    });

    try {
      const output = await renderCommand('template.templ', '-');
      expect(output).toBe('Hello Pipe');
      expect(renderTemplate).toHaveBeenCalledWith('Hello {{ name }}', { name: 'Pipe' });
    } finally {
      if (originalStdinDescriptor) {
        Object.defineProperty(process, 'stdin', originalStdinDescriptor);
      }
    }
  });
});
