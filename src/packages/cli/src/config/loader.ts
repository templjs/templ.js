/**
 * Config file discovery, loading, validation, and merging
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { cwd } from 'process';
import Ajv from 'ajv';
import { CliConfig, ResolvedConfig } from './types.js';
import { CLI_CONFIG_SCHEMA } from './schema.js';

const CONFIG_FILENAME = '.templjs.json';

/**
 * Validates config object against schema
 */
function validateConfig(config: unknown): config is CliConfig {
  const ajv = new Ajv();
  const validate = ajv.compile(CLI_CONFIG_SCHEMA);
  return validate(config);
}

/**
 * Recursively searches for .templjs.json from current directory up to root
 */
function findConfigFile(startDir: string = cwd()): string | null {
  let currentDir = resolve(startDir);
  const root = resolve('/');

  while (true) {
    const configPath = resolve(currentDir, CONFIG_FILENAME);

    try {
      // Check if file exists by attempting to read it
      readFileSync(configPath, 'utf-8');
      return configPath;
    } catch {
      // File not found or unreadable, continue searching
    }

    if (currentDir === root) {
      break;
    }

    currentDir = dirname(currentDir);
  }

  return null;
}

/**
 * Loads and parses .templjs.json config file
 */
function loadConfigFile(configPath: string): CliConfig {
  try {
    const content = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content);

    if (!validateConfig(config)) {
      throw new Error(
        `Invalid .templjs.json: config does not match schema. Check types: inputFormat, outputFormat, templateDelimiters, validation`
      );
    }

    return config;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in ${configPath}: ${error.message}`, { cause: error });
    }
    throw error;
  }
}

/**
 * Merges config file with CLI flags (CLI flags take precedence)
 */
function mergeConfigs(configFile: CliConfig, cliFlags: Record<string, unknown>): CliConfig {
  const merged: CliConfig = { ...configFile };

  // CLI flags override config file values (only override if explicitly provided)
  if (cliFlags.inputFormat !== undefined && typeof cliFlags.inputFormat === 'string') {
    merged.inputFormat = cliFlags.inputFormat as 'json' | 'yaml' | 'toml' | 'xml';
  }
  if (cliFlags.outputFormat !== undefined && typeof cliFlags.outputFormat === 'string') {
    merged.outputFormat = cliFlags.outputFormat as 'text' | 'json' | 'html' | 'markdown';
  }
  if (cliFlags.defaultTemplate !== undefined && typeof cliFlags.defaultTemplate === 'string') {
    merged.defaultTemplate = cliFlags.defaultTemplate;
  }
  if (cliFlags.defaultOutput !== undefined && typeof cliFlags.defaultOutput === 'string') {
    merged.defaultOutput = cliFlags.defaultOutput;
  }
  if (
    cliFlags.templateDelimiters !== undefined &&
    typeof cliFlags.templateDelimiters === 'object'
  ) {
    merged.templateDelimiters = cliFlags.templateDelimiters as Record<string, string>;
  }
  if (cliFlags.validation !== undefined && typeof cliFlags.validation === 'object') {
    merged.validation = cliFlags.validation as Record<string, unknown>;
  }

  return merged;
}

/**
 * Loads CLI config with full discovery, validation, and merging
 */
export function loadConfig(cliFlags: Record<string, unknown> = {}): ResolvedConfig {
  const configPath = findConfigFile();

  if (!configPath) {
    // No config file found, return empty config with CLI flags only
    return {};
  }

  try {
    const configFile = loadConfigFile(configPath);
    const merged = mergeConfigs(configFile, cliFlags);

    return {
      ...merged,
      configPath,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load .templjs.json: ${message}`, { cause: error });
  }
}

/**
 * Applies config values to command options (as plain object).
 * Config defaults only fill in missing values (not overriding explicit options).
 */
export function applyConfig(
  options: Record<string, unknown>,
  config: ResolvedConfig
): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = { ...options };

  // Apply config defaults only if CLI option was not provided
  if (config.defaultTemplate && !options.template) {
    result.template = config.defaultTemplate;
  }
  if (config.defaultOutput && !options.output) {
    result.output = config.defaultOutput;
  }
  if (config.inputFormat && !options.inputFormat) {
    result.inputFormat = config.inputFormat;
  }
  if (config.outputFormat && !options.outputFormat) {
    result.outputFormat = config.outputFormat;
  }

  // Validation config
  if (config.validation) {
    if (config.validation.validateInput !== undefined && options.validateInput === undefined) {
      result.validateInput = config.validation.validateInput;
    }
    if (config.validation.validateOutput !== undefined && options.validateOutput === undefined) {
      result.validateOutput = config.validation.validateOutput;
    }
    if (config.validation.schemaPath && !options.schema) {
      result.schema = config.validation.schemaPath;
    }
  }

  return result;
}

export type { CliConfig, ResolvedConfig };
