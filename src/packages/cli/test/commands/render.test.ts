import { describe, expect, it, vi } from 'vitest';
import { Readable } from 'stream';

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  statSync: vi.fn(() => ({ size: 0 })),
  createReadStream: vi.fn(),
}));

vi.mock('@templjs/core', () => ({
  renderTemplate: vi.fn(),
}));

import { createReadStream, readFileSync, statSync } from 'fs';
import { renderTemplate } from '@templjs/core';
import { renderCommand } from '../../src/commands/render.js';

describe('renderCommand', () => {
  it('renders template output from file and JSON data', async () => {
    vi.mocked(statSync).mockReturnValue({ size: 1024 } as ReturnType<typeof statSync>);
    vi.mocked(readFileSync).mockImplementation((value) => {
      if (value === 'template.templ') {
        return 'Hello {{ name }}';
      }
      return '{"name":"World"}';
    });
    vi.mocked(renderTemplate).mockReturnValue('Hello World');

    const output = await renderCommand('template.templ', 'data.json');

    expect(output).toBe('Hello World');
    expect(readFileSync).toHaveBeenCalledWith('template.templ', 'utf-8');
    expect(renderTemplate).toHaveBeenCalledWith(
      'Hello {{ name }}',
      { name: 'World' },
      { throwOnError: true }
    );
  });

  it('loads JSON payload from input file path when path exists', async () => {
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
    expect(renderTemplate).toHaveBeenCalledWith(
      'Hello {{ name }}',
      { name: 'FromFile' },
      { throwOnError: true }
    );
  });

  it('parses YAML payloads from input files', async () => {
    vi.mocked(statSync).mockReturnValue({ size: 1024 } as ReturnType<typeof statSync>);
    vi.mocked(readFileSync).mockImplementation((value) => {
      if (value === 'template.templ') {
        return 'Hello {{ name }}';
      }
      return 'name: World';
    });
    vi.mocked(renderTemplate).mockReturnValue('Hello World');

    const output = await renderCommand('template.templ', 'data.yaml');

    expect(output).toBe('Hello World');
    expect(renderTemplate).toHaveBeenCalledWith(
      'Hello {{ name }}',
      { name: 'World' },
      { throwOnError: true }
    );
  });

  it('parses TOML payloads from input files', async () => {
    vi.mocked(statSync).mockReturnValue({ size: 1024 } as ReturnType<typeof statSync>);
    vi.mocked(readFileSync).mockImplementation((value) => {
      if (value === 'template.templ') {
        return 'Hello {{ name }}';
      }
      return 'name = "World"';
    });
    vi.mocked(renderTemplate).mockReturnValue('Hello World');

    const output = await renderCommand('template.templ', 'data.toml');

    expect(output).toBe('Hello World');
    expect(renderTemplate).toHaveBeenCalledWith(
      'Hello {{ name }}',
      { name: 'World' },
      { throwOnError: true }
    );
  });

  it('parses XML payloads with explicit input format', async () => {
    vi.mocked(statSync).mockReturnValue({ size: 1024 } as ReturnType<typeof statSync>);
    vi.mocked(readFileSync).mockImplementation((value) => {
      if (value === 'template.templ') {
        return 'Hello {{ xml }}';
      }
      return '<root><name>World</name></root>';
    });
    vi.mocked(renderTemplate).mockReturnValue('Hello XML');

    const output = await renderCommand('template.templ', 'data.input', {
      inputFormat: 'xml',
    });

    expect(output).toBe('Hello XML');
    expect(renderTemplate).toHaveBeenCalledWith(
      'Hello {{ xml }}',
      {
        root: {
          name: ['World'],
        },
      },
      { throwOnError: true }
    );
  });

  it.each([
    {
      format: 'json' as const,
      payload: '{"name":"JsonOverride"}',
      expectedData: { name: 'JsonOverride' },
    },
    {
      format: 'yaml' as const,
      payload: 'name: YamlOverride',
      expectedData: { name: 'YamlOverride' },
    },
    {
      format: 'toml' as const,
      payload: 'name = "TomlOverride"',
      expectedData: { name: 'TomlOverride' },
    },
  ])(
    'parses $format payloads with explicit input format override on non-standard file extensions',
    async ({ format, payload, expectedData }) => {
      vi.mocked(statSync).mockReturnValue({ size: 1024 } as ReturnType<typeof statSync>);
      vi.mocked(readFileSync).mockImplementation((value) => {
        if (value === 'template.templ') {
          return 'Hello {{ name }}';
        }
        return payload;
      });
      vi.mocked(renderTemplate).mockReturnValue(`Hello ${expectedData.name}`);

      const output = await renderCommand('template.templ', 'data.input', {
        inputFormat: format,
      });

      expect(output).toBe(`Hello ${expectedData.name}`);
      expect(renderTemplate).toHaveBeenCalledWith('Hello {{ name }}', expectedData, {
        throwOnError: true,
      });
    }
  );

  it('streams large input files and reports progress', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    try {
      vi.mocked(statSync).mockReturnValue({ size: 20 * 1024 * 1024 } as ReturnType<
        typeof statSync
      >);
      vi.mocked(createReadStream).mockReturnValue(
        Readable.from(['{"name":"', 'Streamed"}']) as ReturnType<typeof createReadStream>
      );
      vi.mocked(readFileSync).mockReturnValue('Hello {{ name }}');
      vi.mocked(renderTemplate).mockReturnValue('Hello Streamed');

      const output = await renderCommand('template.templ', 'huge.json', {
        progressReporter: (message: string) => {
          process.stderr.write(`${message}\n`);
        },
      });

      expect(output).toBe('Hello Streamed');
      expect(createReadStream).toHaveBeenCalledWith(
        'huge.json',
        expect.objectContaining({ encoding: 'utf-8' })
      );
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('Reading large input file'));
    } finally {
      stderrSpy.mockRestore();
    }
  });

  it('does not emit progress to stderr by default for large files', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    try {
      vi.mocked(statSync).mockReturnValue({ size: 20 * 1024 * 1024 } as ReturnType<
        typeof statSync
      >);
      vi.mocked(createReadStream).mockReturnValue(
        Readable.from(['{"name":"', 'NoNoise"}']) as ReturnType<typeof createReadStream>
      );
      vi.mocked(readFileSync).mockReturnValue('Hello {{ name }}');
      vi.mocked(renderTemplate).mockReturnValue('Hello NoNoise');

      const output = await renderCommand('template.templ', 'huge.json');

      expect(output).toBe('Hello NoNoise');
      expect(stderrSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Reading large input file')
      );
    } finally {
      stderrSpy.mockRestore();
    }
  });

  it('routes progress through progressReporter when provided', async () => {
    const progressReporter = vi.fn();
    vi.mocked(statSync).mockReturnValue({ size: 20 * 1024 * 1024 } as ReturnType<typeof statSync>);
    vi.mocked(createReadStream).mockReturnValue(
      Readable.from(['{"name":"', 'ProgressHook"}']) as ReturnType<typeof createReadStream>
    );
    vi.mocked(readFileSync).mockReturnValue('Hello {{ name }}');
    vi.mocked(renderTemplate).mockReturnValue('Hello ProgressHook');

    const output = await renderCommand('template.templ', 'huge.json', {
      progressReporter,
    } as any);

    expect(output).toBe('Hello ProgressHook');
    expect(progressReporter).toHaveBeenCalled();
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
    vi.mocked(statSync).mockReturnValue({ size: 1024 } as ReturnType<typeof statSync>);
    vi.mocked(readFileSync).mockImplementation((value) => {
      if (value === 'template.templ') {
        return 'Hello {{ name }}';
      }
      return '{bad-json';
    });

    await expect(renderCommand('template.templ', 'bad.json')).rejects.toThrow(
      /Render failed: Failed to parse input data as JSON:/
    );
  });

  it('rejects non-object JSON payloads', async () => {
    vi.mocked(statSync).mockReturnValue({ size: 1024 } as ReturnType<typeof statSync>);
    vi.mocked(readFileSync).mockImplementation((value) => {
      if (value === 'template.templ') {
        return 'Hello {{ name }}';
      }
      return '["array"]';
    });

    await expect(renderCommand('template.templ', 'array.json')).rejects.toThrow(
      'Render failed: Failed to parse input data as JSON: Invalid JSON: Input data must be a JSON object'
    );
  });

  it('allows non-object JSON payloads when input validation is disabled', async () => {
    vi.mocked(statSync).mockReturnValue({ size: 1024 } as ReturnType<typeof statSync>);
    vi.mocked(readFileSync).mockImplementation((value) => {
      if (value === 'template.templ') {
        return 'Hello {{ data }}';
      }
      return '["array"]';
    });
    vi.mocked(renderTemplate).mockReturnValue('array output');

    const output = await renderCommand('template.templ', 'array.json', {
      validateInput: false,
    });

    expect(output).toBe('array output');
    expect(renderTemplate).toHaveBeenCalledWith(
      'Hello {{ data }}',
      { data: ['array'] },
      { throwOnError: true }
    );
  });

  it('formats JSON output when output-format json is requested', async () => {
    vi.mocked(statSync).mockReturnValue({ size: 1024 } as ReturnType<typeof statSync>);
    vi.mocked(readFileSync).mockImplementation((value) => {
      if (value === 'template.templ') {
        return 'Hello {{ name }}';
      }
      return '{"name":"World"}';
    });
    vi.mocked(renderTemplate).mockReturnValue('{"ok":true,"count":2}');

    const output = await renderCommand('template.templ', 'data.json', { outputFormat: 'json' });

    expect(output).toBe('{\n  "ok": true,\n  "count": 2\n}');
  });

  it('fails on invalid JSON output when output validation is enabled', async () => {
    vi.mocked(statSync).mockReturnValue({ size: 1024 } as ReturnType<typeof statSync>);
    vi.mocked(readFileSync).mockImplementation((value) => {
      if (value === 'template.templ') {
        return 'Hello {{ name }}';
      }
      return '{"name":"World"}';
    });
    vi.mocked(renderTemplate).mockReturnValue('not-json');

    await expect(
      renderCommand('template.templ', 'data.json', { outputFormat: 'json', validateOutput: true })
    ).rejects.toThrow('Render failed: Rendered output is not valid JSON:');
  });

  it('returns raw output when JSON formatting is requested without output validation', async () => {
    vi.mocked(statSync).mockReturnValue({ size: 1024 } as ReturnType<typeof statSync>);
    vi.mocked(readFileSync).mockImplementation((value) => {
      if (value === 'template.templ') {
        return 'Hello {{ name }}';
      }
      return '{"name":"World"}';
    });
    vi.mocked(renderTemplate).mockReturnValue('not-json');

    const output = await renderCommand('template.templ', 'data.json', {
      outputFormat: 'json',
      validateOutput: false,
    });

    expect(output).toBe('not-json');
  });

  it('throws error when input file does not exist', async () => {
    vi.mocked(readFileSync).mockReturnValue('Hello {{ name }}');
    vi.mocked(statSync).mockImplementation(() => {
      const error: NodeJS.ErrnoException = new Error('ENOENT: no such file or directory');
      error.code = 'ENOENT';
      throw error;
    });

    await expect(renderCommand('template.templ', 'missing.json')).rejects.toThrow(
      'Render failed: Input file not found: missing.json. Use "-" to read from stdin or provide a valid file path.'
    );
  });

  it('throws error when permission denied reading input file', async () => {
    vi.mocked(readFileSync).mockReturnValue('Hello {{ name }}');
    vi.mocked(statSync).mockImplementation(() => {
      const error: NodeJS.ErrnoException = new Error('EACCES: permission denied');
      error.code = 'EACCES';
      throw error;
    });

    await expect(renderCommand('template.templ', 'forbidden.json')).rejects.toThrow(
      'Render failed: Permission denied reading input file: forbidden.json'
    );
  });

  it('throws a file-path specific error for directory-style input paths', async () => {
    vi.mocked(readFileSync).mockReturnValue('Hello {{ name }}');
    vi.mocked(statSync).mockImplementation(() => {
      const error: NodeJS.ErrnoException = new Error('EISDIR: illegal operation on a directory');
      error.code = 'EISDIR';
      throw error;
    });

    await expect(
      renderCommand('template.templ', 'directory', {
        inputFormat: 'json',
      })
    ).rejects.toThrow('Render failed: Invalid input file path (not a regular file): directory');
  });

  it('rethrows unexpected file errors while reading input payload', async () => {
    vi.mocked(readFileSync).mockReturnValue('Hello {{ name }}');
    vi.mocked(statSync).mockImplementation(() => {
      const error: NodeJS.ErrnoException = new Error('EBUSY: resource busy');
      error.code = 'EBUSY';
      throw error;
    });

    await expect(renderCommand('template.templ', 'busy.json')).rejects.toThrow(
      'Render failed: EBUSY: resource busy'
    );
  });

  it('stringifies non-Error JSON parse failures when input validation is disabled', async () => {
    const parseSpy = vi.spyOn(JSON, 'parse').mockImplementation(() => {
      throw 'broken-json';
    });

    vi.mocked(statSync).mockReturnValue({ size: 1024 } as ReturnType<typeof statSync>);
    vi.mocked(readFileSync).mockImplementation((value) => {
      if (value === 'template.templ') {
        return 'Hello {{ name }}';
      }
      return '{"name":"World"}';
    });

    try {
      await expect(
        renderCommand('template.templ', 'data.json', {
          validateInput: false,
        })
      ).rejects.toThrow(
        'Render failed: Failed to parse input data as JSON: Invalid JSON: broken-json'
      );
    } finally {
      parseSpy.mockRestore();
    }
  });

  it('stringifies non-Error render failures', async () => {
    vi.mocked(statSync).mockReturnValue({ size: 1024 } as ReturnType<typeof statSync>);
    vi.mocked(readFileSync).mockImplementation((value) => {
      if (value === 'template.templ') {
        return 'Hello {{ name }}';
      }
      return '{"name":"World"}';
    });
    vi.mocked(renderTemplate).mockImplementation(() => {
      throw 'renderer panic';
    });

    await expect(renderCommand('template.templ', 'data.json')).rejects.toThrow(
      'Render failed: renderer panic'
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
      expect(renderTemplate).toHaveBeenCalledWith(
        'Hello {{ name }}',
        { name: 'Pipe' },
        { throwOnError: true }
      );
    } finally {
      if (originalStdinDescriptor) {
        Object.defineProperty(process, 'stdin', originalStdinDescriptor);
      }
    }
  });

  it('parses input file with experimental streaming JSON parser when enabled', async () => {
    vi.mocked(statSync).mockReturnValue({ size: 1024 } as ReturnType<typeof statSync>);
    vi.mocked(createReadStream).mockReturnValue(
      Readable.from(['{"name":"', 'StreamJson"}']) as ReturnType<typeof createReadStream>
    );
    vi.mocked(readFileSync).mockImplementation((value) => {
      if (value === 'template.templ') {
        return 'Hello {{ name }}';
      }
      throw new Error('data file should not be read with readFileSync in stream-json mode');
    });
    vi.mocked(renderTemplate).mockReturnValue('Hello StreamJson');

    const output = await renderCommand('template.templ', 'data.json', {
      experimentalStreamJson: true,
    });

    expect(output).toBe('Hello StreamJson');
    expect(renderTemplate).toHaveBeenCalledWith(
      'Hello {{ name }}',
      { name: 'StreamJson' },
      { throwOnError: true }
    );
  });

  it('parses stdin with experimental streaming JSON parser when enabled', async () => {
    vi.mocked(readFileSync).mockReturnValue('Hello {{ name }}');
    vi.mocked(renderTemplate).mockReturnValue('Hello StreamStdin');

    const originalStdinDescriptor = Object.getOwnPropertyDescriptor(process, 'stdin');
    Object.defineProperty(process, 'stdin', {
      configurable: true,
      enumerable: true,
      get: () => Readable.from(['{"name":"StreamStdin"}']),
    });

    try {
      const output = await renderCommand('template.templ', '-', {
        experimentalStreamJson: true,
      });

      expect(output).toBe('Hello StreamStdin');
      expect(renderTemplate).toHaveBeenCalledWith(
        'Hello {{ name }}',
        { name: 'StreamStdin' },
        { throwOnError: true }
      );
    } finally {
      if (originalStdinDescriptor) {
        Object.defineProperty(process, 'stdin', originalStdinDescriptor);
      }
    }
  });

  it('enables stream-json parser via environment variable', async () => {
    const previousFlag = process.env.TEMPLJS_EXPERIMENTAL_STREAM_JSON;
    process.env.TEMPLJS_EXPERIMENTAL_STREAM_JSON = '1';

    vi.mocked(statSync).mockReturnValue({ size: 1024 } as ReturnType<typeof statSync>);
    vi.mocked(createReadStream).mockReturnValue(
      Readable.from(['{"name":"', 'EnvFlag"}']) as ReturnType<typeof createReadStream>
    );
    vi.mocked(readFileSync).mockImplementation((value) => {
      if (value === 'template.templ') {
        return 'Hello {{ name }}';
      }
      throw new Error('data file should not be read with readFileSync in stream-json mode');
    });
    vi.mocked(renderTemplate).mockReturnValue('Hello EnvFlag');

    try {
      const output = await renderCommand('template.templ', 'data.json');
      expect(output).toBe('Hello EnvFlag');
      expect(renderTemplate).toHaveBeenCalledWith(
        'Hello {{ name }}',
        { name: 'EnvFlag' },
        { throwOnError: true }
      );
    } finally {
      if (previousFlag === undefined) {
        delete process.env.TEMPLJS_EXPERIMENTAL_STREAM_JSON;
      } else {
        process.env.TEMPLJS_EXPERIMENTAL_STREAM_JSON = previousFlag;
      }
    }
  });

  it('reports progress for large files in experimental stream-json mode', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    vi.mocked(statSync).mockReturnValue({ size: 20 * 1024 * 1024 } as ReturnType<typeof statSync>);
    vi.mocked(createReadStream).mockReturnValue(
      Readable.from(['{"name":"', 'LargeStream"}']) as ReturnType<typeof createReadStream>
    );
    vi.mocked(readFileSync).mockReturnValue('Hello {{ name }}');
    vi.mocked(renderTemplate).mockReturnValue('Hello LargeStream');

    try {
      const output = await renderCommand('template.templ', 'huge.json', {
        experimentalStreamJson: true,
        progressReporter: (message: string) => {
          process.stderr.write(`${message}\n`);
        },
      });

      expect(output).toBe('Hello LargeStream');
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('Reading large input file'));
    } finally {
      stderrSpy.mockRestore();
    }
  });

  it('rejects array payloads in experimental stream-json mode', async () => {
    vi.mocked(statSync).mockReturnValue({ size: 1024 } as ReturnType<typeof statSync>);
    vi.mocked(createReadStream).mockReturnValue(
      Readable.from(['["not-object"]']) as ReturnType<typeof createReadStream>
    );
    vi.mocked(readFileSync).mockReturnValue('Hello {{ name }}');

    await expect(
      renderCommand('template.templ', 'array.json', {
        experimentalStreamJson: true,
      })
    ).rejects.toThrow(
      'Render failed: Failed to parse input data as JSON: Input data must be a JSON object'
    );
  });

  it('allows array payloads in stream-json mode when input validation is disabled', async () => {
    vi.mocked(statSync).mockReturnValue({ size: 1024 } as ReturnType<typeof statSync>);
    vi.mocked(createReadStream).mockReturnValue(
      Readable.from(['["streamed-array"]']) as ReturnType<typeof createReadStream>
    );
    vi.mocked(readFileSync).mockReturnValue('Hello {{ data }}');
    vi.mocked(renderTemplate).mockReturnValue('streamed array output');

    const output = await renderCommand('template.templ', 'array.json', {
      experimentalStreamJson: true,
      validateInput: false,
    });

    expect(output).toBe('streamed array output');
    expect(renderTemplate).toHaveBeenCalledWith(
      'Hello {{ data }}',
      { data: ['streamed-array'] },
      { throwOnError: true }
    );
  });

  it('rejects multiple root values in experimental stream-json mode', async () => {
    vi.mocked(statSync).mockReturnValue({ size: 1024 } as ReturnType<typeof statSync>);
    vi.mocked(createReadStream).mockReturnValue(
      Readable.from(['{"name":"A"}{"name":"B"}']) as ReturnType<typeof createReadStream>
    );
    vi.mocked(readFileSync).mockReturnValue('Hello {{ name }}');

    await expect(
      renderCommand('template.templ', 'multi-root.json', {
        experimentalStreamJson: true,
      })
    ).rejects.toThrow(
      'Render failed: Failed to parse input data as JSON: Multiple JSON root values are not supported'
    );
  });

  it('surfaces non-JSON filesystem errors in stream-json mode with file-path context', async () => {
    vi.mocked(readFileSync).mockReturnValue('Hello {{ name }}');
    vi.mocked(statSync).mockImplementation(() => {
      const error: NodeJS.ErrnoException = new Error('ENOTDIR: not a directory');
      error.code = 'ENOTDIR';
      throw error;
    });

    await expect(
      renderCommand('template.templ', 'not-a-directory', {
        experimentalStreamJson: true,
        inputFormat: 'json',
      })
    ).rejects.toThrow(
      'Render failed: Invalid input file path (not a regular file): not-a-directory'
    );
  });

  it('reports stream-json permission errors from file creation', async () => {
    vi.mocked(readFileSync).mockReturnValue('Hello {{ name }}');
    vi.mocked(statSync).mockImplementation(() => {
      const error: NodeJS.ErrnoException = new Error('EPERM: operation not permitted');
      error.code = 'EPERM';
      throw error;
    });

    await expect(
      renderCommand('template.templ', 'restricted.json', {
        experimentalStreamJson: true,
        inputFormat: 'json',
      })
    ).rejects.toThrow('Render failed: Permission denied reading input file: restricted.json');
  });

  it('rejects empty stdin in experimental stream-json mode', async () => {
    vi.mocked(readFileSync).mockReturnValue('Hello {{ name }}');

    const originalStdinDescriptor = Object.getOwnPropertyDescriptor(process, 'stdin');
    Object.defineProperty(process, 'stdin', {
      configurable: true,
      enumerable: true,
      get: () => Readable.from([]),
    });

    try {
      await expect(
        renderCommand('template.templ', '-', {
          experimentalStreamJson: true,
        })
      ).rejects.toThrow(
        'Render failed: Failed to parse input data as JSON: Input data is empty or incomplete JSON'
      );
    } finally {
      if (originalStdinDescriptor) {
        Object.defineProperty(process, 'stdin', originalStdinDescriptor);
      }
    }
  });
});
