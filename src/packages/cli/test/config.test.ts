import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, mkdtempSync, chmodSync } from 'fs';
import { resolve, basename, join } from 'path';
import { tmpdir } from 'os';
import { cwd } from 'process';
import { loadConfig, applyConfig } from '../src/config/index.js';
import type { CliConfig, ResolvedConfig } from '../src/config/types.js';

describe('CLI Config File Support (WI-032)', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'templjs-config-test-'));
    originalCwd = cwd();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Config discovery and loading', () => {
    it('loads .templjs.json from current directory', () => {
      const config: CliConfig = {
        inputFormat: 'json',
        outputFormat: 'text',
        defaultTemplate: 'template.tmpl',
      };

      process.chdir(tempDir);
      writeFileSync(resolve(tempDir, '.templjs.json'), JSON.stringify(config));

      const loaded = loadConfig();

      expect(loaded.inputFormat).toBe('json');
      expect(loaded.outputFormat).toBe('text');
      expect(loaded.defaultTemplate).toBe('template.tmpl');
      expect(loaded.configPath ? basename(loaded.configPath) : undefined).toBe('.templjs.json');
    });

    it('searches parent directories for .templjs.json', () => {
      const config: CliConfig = {
        inputFormat: 'yaml',
        defaultOutput: 'output.md',
      };

      writeFileSync(resolve(tempDir, '.templjs.json'), JSON.stringify(config));

      const subdir = resolve(tempDir, 'nested', 'deep', 'dir');
      mkdirSync(subdir, { recursive: true });
      process.chdir(subdir);

      const loaded = loadConfig();

      expect(loaded.inputFormat).toBe('yaml');
      expect(loaded.defaultOutput).toBe('output.md');
      expect(loaded.configPath ? basename(loaded.configPath) : undefined).toBe('.templjs.json');
    });

    it('returns empty config when no .templjs.json found', () => {
      process.chdir(tempDir);
      const loaded = loadConfig();

      expect(loaded).toEqual({});
      expect(loaded.configPath).toBeUndefined();
    });

    it('applies supported CLI flags when no .templjs.json is found', () => {
      process.chdir(tempDir);
      const loaded = loadConfig({
        inputFormat: 'yaml',
        outputFormat: 'markdown',
        defaultTemplate: 'base.tmpl',
      });

      expect(loaded.inputFormat).toBe('yaml');
      expect(loaded.outputFormat).toBe('markdown');
      expect(loaded.defaultTemplate).toBe('base.tmpl');
      expect(loaded.configPath).toBeUndefined();
    });

    it('throws error for invalid JSON in config file', () => {
      process.chdir(tempDir);
      writeFileSync(resolve(tempDir, '.templjs.json'), '{invalid json');

      expect(() => loadConfig()).toThrow(/Invalid JSON/);
    });

    it('throws error for config that does not match schema', () => {
      const invalidConfig = {
        inputFormat: 'invalid-format',
        unknownField: 'value',
      };

      process.chdir(tempDir);
      writeFileSync(resolve(tempDir, '.templjs.json'), JSON.stringify(invalidConfig));

      expect(() => loadConfig()).toThrow(/Invalid .templjs.json/);
    });

    it('rethrows non-ENOENT access errors during config discovery', () => {
      const configPath = resolve(tempDir, '.templjs.json');
      process.chdir(tempDir);
      writeFileSync(configPath, '{"defaultTemplate":"x.tmpl"}');
      chmodSync(configPath, 0o000);

      try {
        expect(() => loadConfig()).toThrow(/EACCES|Failed to load \.templjs\.json/);
      } finally {
        chmodSync(configPath, 0o644);
      }
    });

    it('resolves environment variable placeholders in config values', () => {
      const previousTemplateEnv = process.env.TEMPLJS_TEMPLATE_PATH;
      process.env.TEMPLJS_TEMPLATE_PATH = 'env-template.tmpl';

      try {
        process.chdir(tempDir);
        writeFileSync(
          resolve(tempDir, '.templjs.json'),
          JSON.stringify({
            defaultTemplate: '${TEMPLJS_TEMPLATE_PATH}',
          })
        );

        const loaded = loadConfig();
        expect(loaded.defaultTemplate).toBe('env-template.tmpl');
      } finally {
        if (previousTemplateEnv === undefined) {
          delete process.env.TEMPLJS_TEMPLATE_PATH;
        } else {
          process.env.TEMPLJS_TEMPLATE_PATH = previousTemplateEnv;
        }
      }
    });

    it('supports environment variable placeholders with fallback values', () => {
      const previousOutputEnv = process.env.TEMPLJS_OUTPUT_PATH;
      delete process.env.TEMPLJS_OUTPUT_PATH;

      try {
        process.chdir(tempDir);
        writeFileSync(
          resolve(tempDir, '.templjs.json'),
          JSON.stringify({
            defaultOutput: '${TEMPLJS_OUTPUT_PATH:-out/result.txt}',
          })
        );

        const loaded = loadConfig();
        expect(loaded.defaultOutput).toBe('out/result.txt');
      } finally {
        if (previousOutputEnv !== undefined) {
          process.env.TEMPLJS_OUTPUT_PATH = previousOutputEnv;
        }
      }
    });

    it('throws when environment variable placeholder has no value and no fallback', () => {
      const previousTemplateEnv = process.env.TEMPLJS_TEMPLATE_PATH;
      delete process.env.TEMPLJS_TEMPLATE_PATH;

      try {
        process.chdir(tempDir);
        writeFileSync(
          resolve(tempDir, '.templjs.json'),
          JSON.stringify({
            defaultTemplate: '${TEMPLJS_TEMPLATE_PATH}',
          })
        );

        expect(() => loadConfig()).toThrow(/Missing environment variable "TEMPLJS_TEMPLATE_PATH"/);
      } finally {
        if (previousTemplateEnv !== undefined) {
          process.env.TEMPLJS_TEMPLATE_PATH = previousTemplateEnv;
        }
      }
    });
  });

  describe('Config validation', () => {
    it('validates inputFormat enum', () => {
      const validFormats = ['json', 'yaml', 'toml', 'xml'];

      for (const format of validFormats) {
        const config: CliConfig = { inputFormat: format as CliConfig['inputFormat'] };
        process.chdir(tempDir);
        writeFileSync(resolve(tempDir, '.templjs.json'), JSON.stringify(config));
        expect(() => loadConfig()).not.toThrow();
        rmSync(resolve(tempDir, '.templjs.json'));
      }
    });

    it('validates outputFormat enum', () => {
      const validFormats = ['text', 'json', 'html', 'markdown'];

      for (const format of validFormats) {
        const config: CliConfig = { outputFormat: format as CliConfig['outputFormat'] };
        process.chdir(tempDir);
        writeFileSync(resolve(tempDir, '.templjs.json'), JSON.stringify(config));
        expect(() => loadConfig()).not.toThrow();
        rmSync(resolve(tempDir, '.templjs.json'));
      }
    });

    it('validates templateDelimiters object', () => {
      const config: CliConfig = {
        templateDelimiters: {
          statement_start: '<%',
          statement_end: '%>',
          expression_start: '<:',
          expression_end: ':>',
        },
      };

      process.chdir(tempDir);
      writeFileSync(resolve(tempDir, '.templjs.json'), JSON.stringify(config));
      const loaded = loadConfig();

      expect(loaded.templateDelimiters?.statement_start).toBe('<%');
      expect(loaded.templateDelimiters?.expression_start).toBe('<:');
    });

    it('validates validation object with boolean flags', () => {
      const config: CliConfig = {
        validation: {
          validateInput: true,
          validateOutput: false,
          schemaPath: 'schema.json',
        },
      };

      process.chdir(tempDir);
      writeFileSync(resolve(tempDir, '.templjs.json'), JSON.stringify(config));
      const loaded = loadConfig();

      expect(loaded.validation?.validateInput).toBe(true);
      expect(loaded.validation?.validateOutput).toBe(false);
      expect(loaded.validation?.schemaPath).toBe('schema.json');
    });

    it('rejects additionalProperties', () => {
      const config = {
        inputFormat: 'json',
        unknownProperty: 'should fail',
      };

      process.chdir(tempDir);
      writeFileSync(resolve(tempDir, '.templjs.json'), JSON.stringify(config));

      expect(() => loadConfig()).toThrow(/Invalid .templjs.json/);
    });
  });

  describe('Config merging with CLI flags', () => {
    beforeEach(() => {
      const config: CliConfig = {
        inputFormat: 'json',
        outputFormat: 'text',
        defaultTemplate: 'default.tmpl',
      };
      process.chdir(tempDir);
      writeFileSync(resolve(tempDir, '.templjs.json'), JSON.stringify(config));
    });

    it('CLI flags override config file values', () => {
      const cliFlags = { inputFormat: 'yaml', outputFormat: 'html' };
      const loaded = loadConfig(cliFlags);

      expect(loaded.inputFormat).toBe('yaml');
      expect(loaded.outputFormat).toBe('html');
    });

    it('preserves config values when no CLI flag provided', () => {
      const cliFlags = { outputFormat: 'markdown' };
      const loaded = loadConfig(cliFlags);

      expect(loaded.inputFormat).toBe('json');
      expect(loaded.outputFormat).toBe('markdown');
      expect(loaded.defaultTemplate).toBe('default.tmpl');
    });

    it('ignores non-string CLI flag values', () => {
      const cliFlags = { inputFormat: 123 } as Record<string, unknown>;
      const loaded = loadConfig(cliFlags);

      expect(loaded.inputFormat).toBe('json');
    });

    it('throws when CLI flags include invalid enum values', () => {
      expect(() => loadConfig({ inputFormat: 'csv' })).toThrow(
        /Invalid \.templjs\.json \(merged config is invalid\)/
      );
    });

    it('ignores null object-like CLI flags', () => {
      const cliFlags = {
        templateDelimiters: null,
        validation: null,
      } as Record<string, unknown>;
      const loaded = loadConfig(cliFlags);

      expect(loaded.templateDelimiters).toBeUndefined();
      expect(loaded.validation).toBeUndefined();
    });

    it('applies object-like CLI overrides for template delimiters and validation', () => {
      const loaded = loadConfig({
        templateDelimiters: {
          statement_start: '<<',
          statement_end: '>>',
        },
        validation: {
          validateInput: false,
          schemaPath: 'override-schema.json',
        },
      });

      expect(loaded.templateDelimiters).toEqual({
        statement_start: '<<',
        statement_end: '>>',
      });
      expect(loaded.validation).toEqual({
        validateInput: false,
        schemaPath: 'override-schema.json',
      });
    });
  });

  describe('Config application to command options', () => {
    it('fills missing template from config', () => {
      const config: ResolvedConfig = {
        defaultTemplate: 'template.tmpl',
      };
      const options = { input: 'data.json' };
      const applied = applyConfig(options, config);

      expect(applied.template).toBe('template.tmpl');
      expect(applied.input).toBe('data.json');
    });

    it('does not override explicit CLI template option', () => {
      const config: ResolvedConfig = {
        defaultTemplate: 'config.tmpl',
      };
      const options = { template: 'cli.tmpl', input: 'data.json' };
      const applied = applyConfig(options, config);

      expect(applied.template).toBe('cli.tmpl');
    });

    it('does not override explicit falsy CLI option values', () => {
      const config: ResolvedConfig = {
        defaultTemplate: 'config.tmpl',
        validation: { schemaPath: 'schema.json' },
      };
      const options = { template: '', schema: '' };
      const applied = applyConfig(options, config);

      expect(applied.template).toBe('');
      expect(applied.schema).toBe('');
    });

    it('applies validation config defaults', () => {
      const config: ResolvedConfig = {
        validation: {
          validateInput: true,
          validateOutput: false,
          schemaPath: 'schema.json',
        },
      };
      const options = { template: 'test.tmpl' };
      const applied = applyConfig(options, config);

      expect(applied.validateInput).toBe(true);
      expect(applied.validateOutput).toBe(false);
      expect(applied.schema).toBe('schema.json');
    });

    it('does not override explicit validation options from CLI', () => {
      const config: ResolvedConfig = {
        validation: {
          validateInput: true,
          schemaPath: 'config-schema.json',
        },
      };
      const options = {
        template: 'test.tmpl',
        validateInput: false,
        schema: 'cli-schema.json',
      };
      const applied = applyConfig(options, config);

      expect(applied.validateInput).toBe(false);
      expect(applied.schema).toBe('cli-schema.json');
    });

    it('applies all config defaults to options', () => {
      const config: ResolvedConfig = {
        defaultTemplate: 'template.tmpl',
        defaultOutput: 'output.txt',
        inputFormat: 'json',
        outputFormat: 'text',
        validation: {
          validateInput: true,
        },
      };
      const options = { input: 'data.json' };
      const applied = applyConfig(options, config);

      expect(applied.template).toBe('template.tmpl');
      expect(applied.output).toBe('output.txt');
      expect(applied.inputFormat).toBe('json');
      expect(applied.outputFormat).toBe('text');
      expect(applied.validateInput).toBe(true);
    });
  });

  describe('Config file format spec', () => {
    it('preserves boolean values in validation config', () => {
      const config: CliConfig = {
        validation: {
          validateInput: false,
          validateOutput: true,
        },
      };

      process.chdir(tempDir);
      writeFileSync(resolve(tempDir, '.templjs.json'), JSON.stringify(config));
      const loaded = loadConfig();

      expect(loaded.validation?.validateInput).toBe(false);
      expect(loaded.validation?.validateOutput).toBe(true);
    });

    it('accepts all format enums in combined config', () => {
      const config: CliConfig = {
        inputFormat: 'toml',
        outputFormat: 'json',
        defaultTemplate: 'base.tmpl',
        defaultOutput: 'result.json',
        templateDelimiters: {
          statement_start: '<%',
          statement_end: '%>',
          expression_start: '<%=',
          expression_end: '%>',
        },
        validation: {
          validateInput: true,
          validateOutput: false,
          schemaPath: 'schema.json',
        },
      };

      process.chdir(tempDir);
      writeFileSync(resolve(tempDir, '.templjs.json'), JSON.stringify(config));
      const loaded = loadConfig();

      expect(loaded.inputFormat).toBe('toml');
      expect(loaded.outputFormat).toBe('json');
      expect(loaded.templateDelimiters?.statement_start).toBe('<%');
      expect(loaded.validation?.validateInput).toBe(true);
    });
  });

  describe('Integration with CLI commands', () => {
    it('config path is available when loaded', () => {
      const config: CliConfig = {
        defaultTemplate: 'test.tmpl',
      };

      process.chdir(tempDir);
      writeFileSync(resolve(tempDir, '.templjs.json'), JSON.stringify(config));
      const loaded = loadConfig();

      expect(loaded.configPath ? basename(loaded.configPath) : undefined).toBe('.templjs.json');
    });

    it('returns empty config with undefined configPath when not found', () => {
      process.chdir(tempDir);
      const loaded = loadConfig();

      expect(loaded.configPath).toBeUndefined();
      // Empty config should still be usable with applyConfig
      const applied = applyConfig({ template: 'test.tmpl' }, loaded);
      expect(applied.template).toBe('test.tmpl');
    });
  });
});
