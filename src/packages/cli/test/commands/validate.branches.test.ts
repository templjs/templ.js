import { describe, expect, it, vi } from 'vitest';

async function loadValidateCommand(options?: {
  readFileSyncImpl?: (path: string) => string;
  validateTemplateImpl?: (template: string) => { errors?: string[] };
  schemaValidatorFactory?: new (schema?: unknown) => {
    isCompiled: boolean;
    compilationError?: string;
    validate: (input: unknown) => {
      valid: boolean;
      errors: Array<{ path?: string; message: string }>;
    };
  };
  parseDataAsyncImpl?: (content: string, filePath: string) => Promise<unknown>;
}) {
  vi.resetModules();

  vi.doMock('fs', () => ({
    readFileSync: vi.fn(
      options?.readFileSyncImpl ??
        ((path: string) => {
          if (path === 'schema.json') {
            return '{}';
          }
          if (path === 'input.json') {
            return '{"name":"Taylor"}';
          }
          return 'Hello {{ name }}';
        })
    ),
  }));

  vi.doMock('@templjs/core', () => ({
    validateTemplate: vi.fn(options?.validateTemplateImpl ?? (() => ({ errors: [] }))),
    SchemaValidator:
      options?.schemaValidatorFactory ??
      class {
        isCompiled = true;
        compilationError = undefined;

        validate(): { valid: boolean; errors: Array<{ path?: string; message: string }> } {
          return { valid: true, errors: [] };
        }
      },
  }));

  vi.doMock('../../src/formats/index.js', () => ({
    parseDataAsync: vi.fn(
      options?.parseDataAsyncImpl ?? (async (_content: string, _filePath: string) => ({}))
    ),
  }));

  const module = await import('../../src/commands/validate.js');
  return module.validateCommand;
}

describe('validateCommand fallback branches', () => {
  it('reports schema compilation failures with explicit compiler details', async () => {
    const validateCommand = await loadValidateCommand({
      schemaValidatorFactory: class {
        isCompiled = false;
        compilationError = 'unknown keyword: nope';

        validate() {
          return { valid: true, errors: [] };
        }
      },
    });

    await expect(validateCommand('template.templ', 'schema.json')).resolves.toEqual({
      valid: false,
      errors: ['Schema compilation failed - unknown keyword: nope'],
    });
  });

  it('falls back to an unknown schema compilation message when the validator omits details', async () => {
    const validateCommand = await loadValidateCommand({
      schemaValidatorFactory: class {
        isCompiled = false;

        validate() {
          return { valid: true, errors: [] };
        }
      },
    });

    await expect(validateCommand('template.templ', 'schema.json')).resolves.toEqual({
      valid: false,
      errors: ["Schema compilation failed - unknown compilation error for schema 'schema.json'"],
    });
  });

  it('omits a path prefix when schema validation errors target the root value', async () => {
    const validateCommand = await loadValidateCommand({
      schemaValidatorFactory: class {
        isCompiled = true;
        compilationError = undefined;

        validate() {
          return {
            valid: false,
            errors: [{ path: '', message: 'must satisfy the root schema' }],
          };
        }
      },
    });

    await expect(validateCommand('template.templ', 'schema.json', 'input.json')).resolves.toEqual({
      valid: false,
      errors: ['Schema validation failed - must satisfy the root schema'],
    });
  });

  it('reuses schema validators for repeated validation with identical schema content', async () => {
    let validatorInstances = 0;
    const validateCommand = await loadValidateCommand({
      schemaValidatorFactory: class {
        isCompiled = true;
        compilationError = undefined;

        constructor() {
          validatorInstances += 1;
        }

        validate() {
          return { valid: true, errors: [] };
        }
      },
    });

    await expect(validateCommand('template.templ', 'schema.json', 'input.json')).resolves.toEqual({
      valid: true,
      errors: [],
    });
    await expect(validateCommand('template.templ', 'schema.json', 'input.json')).resolves.toEqual({
      valid: true,
      errors: [],
    });

    expect(validatorInstances).toBe(1);
  });

  it('creates fresh validators when schema content changes at the same path', async () => {
    let validatorInstances = 0;
    let schemaReads = 0;
    const validateCommand = await loadValidateCommand({
      readFileSyncImpl: (path: string) => {
        if (path === 'schema.json') {
          schemaReads += 1;
          return schemaReads === 1 ? '{"type":"object"}' : '{"type":"array"}';
        }
        if (path === 'input.json') {
          return '{"name":"Taylor"}';
        }
        return 'Hello {{ name }}';
      },
      schemaValidatorFactory: class {
        isCompiled = true;
        compilationError = undefined;

        constructor() {
          validatorInstances += 1;
        }

        validate() {
          return { valid: true, errors: [] };
        }
      },
    });

    await expect(validateCommand('template.templ', 'schema.json', 'input.json')).resolves.toEqual({
      valid: true,
      errors: [],
    });
    await expect(validateCommand('template.templ', 'schema.json', 'input.json')).resolves.toEqual({
      valid: true,
      errors: [],
    });

    expect(validatorInstances).toBe(2);
  });

  it('does not reuse validators for schema tuples that would collide with delimiter keys', async () => {
    let validatorInstances = 0;
    const validateCommand = await loadValidateCommand({
      readFileSyncImpl: (path: string) => {
        if (path === 'a.json') {
          return 'x::y';
        }
        if (path === 'a.json::x') {
          return 'y';
        }
        if (path === 'input.json') {
          return '{"name":"Taylor"}';
        }
        return 'Hello {{ name }}';
      },
      schemaValidatorFactory: class {
        isCompiled = true;
        compilationError = undefined;

        constructor() {
          validatorInstances += 1;
        }

        validate() {
          return { valid: true, errors: [] };
        }
      },
    });

    await expect(validateCommand('template.templ', 'a.json', 'input.json')).resolves.toEqual({
      valid: true,
      errors: [],
    });
    await expect(validateCommand('template.templ', 'a.json::x', 'input.json')).resolves.toEqual({
      valid: true,
      errors: [],
    });

    expect(validatorInstances).toBe(2);
  });

  it('stringifies non-Error failures raised during validation', async () => {
    const validateCommand = await loadValidateCommand({
      validateTemplateImpl: () => {
        throw 'validator panic';
      },
    });

    await expect(validateCommand('template.templ')).rejects.toThrow(
      'Validation failed: validator panic'
    );
  });
});
