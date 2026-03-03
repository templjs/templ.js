import { describe, expect, it, vi } from 'vitest';

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(() => false),
}));

vi.mock('@templjs/core', () => ({
  renderTemplate: vi.fn(),
}));

import { readFileSync } from 'fs';
import { renderTemplate } from '@templjs/core';
import { renderCommand } from './render';

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
});
