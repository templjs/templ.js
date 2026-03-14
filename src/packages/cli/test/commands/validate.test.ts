import { beforeEach, describe, expect, it, vi } from 'vitest';

// Only mock file I/O -- validateTemplate, SchemaValidator, and parseDataAsync
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
}));

import { readFileSync } from 'fs';
import { validateCommand } from '../../src/commands/validate.js';

const SCHEMA = JSON.stringify({
  type: 'object',
  properties: { name: { type: 'string' } },
  required: ['name'],
});

describe('validateCommand', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('accepts a syntactically valid template', async () => {
    vi.mocked(readFileSync).mockReturnValue('Hello {{ name }}!');

    await expect(validateCommand('template.templ')).resolves.toEqual({ valid: true, errors: [] });
  });

  it('reports syntax errors from an invalid template', async () => {
    vi.mocked(readFileSync).mockReturnValue('{{unclosed');

    const result = await validateCommand('template.templ');

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toMatch(/Unclosed expression starting at line/);
  });

  it('accepts input that satisfies the schema', async () => {
    vi.mocked(readFileSync).mockImplementation((path) => {
      if (path === 'schema.json') return SCHEMA;
      if (path === 'input.json') return '{"name":"Taylor"}';
      return 'Hello {{ name }}!';
    });

    await expect(validateCommand('template.templ', 'schema.json', 'input.json')).resolves.toEqual({
      valid: true,
      errors: [],
    });
  });

  it('reports a type error when input field has the wrong type', async () => {
    vi.mocked(readFileSync).mockImplementation((path) => {
      if (path === 'schema.json') return SCHEMA;
      if (path === 'input.json') return '{"name":42}';
      return 'Hello {{ name }}!';
    });

    const result = await validateCommand('template.templ', 'schema.json', 'input.json');

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Schema validation failed - name: must be string');
  });

  it('reports an error when a required field is absent from input', async () => {
    vi.mocked(readFileSync).mockImplementation((path) => {
      if (path === 'schema.json') return SCHEMA;
      if (path === 'input.json') return '{}';
      return 'Hello {{ name }}!';
    });

    const result = await validateCommand('template.templ', 'schema.json', 'input.json');

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('name'))).toBe(true);
  });

  it('throws when input path is provided without a schema path', async () => {
    vi.mocked(readFileSync).mockReturnValue('Hello {{ name }}!');

    await expect(validateCommand('template.templ', undefined, 'input.json')).rejects.toThrow(
      'Validation failed: Schema path is required when validating input data (pass --schema)'
    );
  });

  it('wraps file system errors with validation context', async () => {
    vi.mocked(readFileSync).mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory');
    });

    await expect(validateCommand('missing.templ')).rejects.toThrow(
      'Validation failed: ENOENT: no such file or directory'
    );
  });
  it('gracefully handles invalid schema parsing', async () => {
    vi.mocked(readFileSync).mockImplementation((path) => {
      if (path === 'schema.json') return 'invalid schema';
      return 'Hello {{ name }}';
    });
    await expect(validateCommand('template.templ', 'schema.json')).rejects.toThrow(
      'Invalid JSON: Unexpected token \'i\', "invalid schema" is not valid JSON'
    );
  });
});
