import { describe, expect, it, vi } from 'vitest';

async function loadValidateModule(options?: {
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

  return await import('../../src/commands/validate.js');
}

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
  const module = await loadValidateModule(options);
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
    let schemaParseCalls = 0;
    const validateCommand = await loadValidateCommand({
      parseDataAsyncImpl: async (content: string, filePath: string) => {
        if (filePath === 'schema.json') {
          schemaParseCalls += 1;
        }

        return JSON.parse(content);
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

    expect(validatorInstances).toBe(1);
    expect(schemaParseCalls).toBe(1);
  });

  it('creates fresh validators when schema content changes at the same path', async () => {
    let validatorInstances = 0;
    let schemaContent = '{"type":"object"}';
    const validateCommand = await loadValidateCommand({
      readFileSyncImpl: (path: string) => {
        if (path === 'schema.json') {
          return schemaContent;
        }
        if (path === 'input.json') {
          return '{"name":"Taylor"}';
        }
        return 'Hello {{ name }}';
      },
      parseDataAsyncImpl: async (content: string) => JSON.parse(content),
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

    schemaContent = '{"type":"array"}';

    await expect(validateCommand('template.templ', 'schema.json', 'input.json')).resolves.toEqual({
      valid: true,
      errors: [],
    });

    expect(validatorInstances).toBe(2);
  });

  it('does not reuse validators for distinct path and schema-content pairs', async () => {
    let validatorInstances = 0;
    const validateCommand = await loadValidateCommand({
      readFileSyncImpl: (path: string) => {
        if (path === 'a.json') {
          return '{"type":"string","$comment":"schema for a.json"}';
        }
        if (path === 'a.json::x') {
          return '{"type":"number","$comment":"schema for a.json::x"}';
        }
        if (path === 'input.json') {
          return '{"name":"Taylor"}';
        }
        return 'Hello {{ name }}';
      },
      parseDataAsyncImpl: async (content: string) => JSON.parse(content),
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

  it('clears cached validators when the shared cache reset helper is called', async () => {
    let validatorInstances = 0;
    const { clearSharedSchemaValidatorCache, validateCommand } = await loadValidateModule({
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

    await expect(validateCommand('template.templ', 'schema.json')).resolves.toEqual({
      valid: true,
      errors: [],
    });

    clearSharedSchemaValidatorCache();

    await expect(validateCommand('template.templ', 'schema.json')).resolves.toEqual({
      valid: true,
      errors: [],
    });

    expect(validatorInstances).toBe(2);
  });

  it('evicts the oldest cached validator once the shared cache reaches its limit', async () => {
    let validatorInstances = 0;
    const { validateCommand } = await loadValidateModule({
      readFileSyncImpl: (path: string) => {
        if (path.startsWith('schema-')) {
          return `{"$id":"${path}"}`;
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

    for (let index = 0; index <= 128; index += 1) {
      await expect(validateCommand('template.templ', `schema-${index}.json`)).resolves.toEqual({
        valid: true,
        errors: [],
      });
    }

    await expect(validateCommand('template.templ', 'schema-0.json')).resolves.toEqual({
      valid: true,
      errors: [],
    });

    expect(validatorInstances).toBe(130);
  });

  it('keeps recently reused validators when eviction occurs', async () => {
    let validatorInstances = 0;
    const { validateCommand } = await loadValidateModule({
      readFileSyncImpl: (path: string) => {
        if (path.startsWith('schema-')) {
          return `{"$id":"${path}"}`;
        }
        return 'Hello {{ name }}';
      },
      parseDataAsyncImpl: async (content: string) => JSON.parse(content),
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

    await expect(validateCommand('template.templ', 'schema-0.json')).resolves.toEqual({
      valid: true,
      errors: [],
    });
    await expect(validateCommand('template.templ', 'schema-1.json')).resolves.toEqual({
      valid: true,
      errors: [],
    });
    await expect(validateCommand('template.templ', 'schema-0.json')).resolves.toEqual({
      valid: true,
      errors: [],
    });

    for (let index = 2; index <= 128; index += 1) {
      await expect(validateCommand('template.templ', `schema-${index}.json`)).resolves.toEqual({
        valid: true,
        errors: [],
      });
    }

    const instancesBeforeReusedLookup = validatorInstances;
    await expect(validateCommand('template.templ', 'schema-0.json')).resolves.toEqual({
      valid: true,
      errors: [],
    });
    expect(validatorInstances).toBe(instancesBeforeReusedLookup);

    const instancesBeforeEvictedLookup = validatorInstances;
    await expect(validateCommand('template.templ', 'schema-1.json')).resolves.toEqual({
      valid: true,
      errors: [],
    });
    expect(validatorInstances).toBe(instancesBeforeEvictedLookup + 1);
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
