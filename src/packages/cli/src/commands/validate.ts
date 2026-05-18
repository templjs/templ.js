/**
 * @templjs/cli - validate command
 * Validates template syntax and optionally validates input data against a schema
 */

import { readFileSync } from 'fs';
import { SchemaValidator, validateTemplate, type JSONSchema } from '@templjs/core';
import { parseDataAsync } from '../formats/index.js';
import { createHash } from 'crypto';

const DEFAULT_SHARED_SCHEMA_VALIDATOR_CACHE_LIMIT = 128;
const schemaValidatorCache = new Map<string, Map<string, SchemaValidator>>();
const schemaValidatorCacheOrder: Array<{ schemaPath: string; schemaDigest: string }> = [];

function getSchemaDigest(schemaContent: string): string {
  const hash = createHash('sha256').update(schemaContent).digest('hex');
  return `${schemaContent.length}:${hash}`;
}

function markSharedSchemaValidatorAsRecentlyUsed(schemaPath: string, schemaDigest: string): void {
  const entryIndex = schemaValidatorCacheOrder.findIndex(
    (entry) => entry.schemaPath === schemaPath && entry.schemaDigest === schemaDigest
  );
  if (entryIndex === -1) {
    return;
  }

  const [entry] = schemaValidatorCacheOrder.splice(entryIndex, 1);
  if (entry) {
    schemaValidatorCacheOrder.push(entry);
  }
}

function evictOldestSharedSchemaValidator(): void {
  const oldestEntry = schemaValidatorCacheOrder.shift();
  if (!oldestEntry) {
    return;
  }

  const validatorsByContent = schemaValidatorCache.get(oldestEntry.schemaPath);
  if (!validatorsByContent) {
    return;
  }

  validatorsByContent.delete(oldestEntry.schemaDigest);
  if (validatorsByContent.size === 0) {
    schemaValidatorCache.delete(oldestEntry.schemaPath);
  }
}

function getSharedSchemaValidator(
  schemaPath: string,
  schemaDigest: string,
  schema: JSONSchema
): SchemaValidator {
  const cached = schemaValidatorCache.get(schemaPath)?.get(schemaDigest);
  if (cached) {
    markSharedSchemaValidatorAsRecentlyUsed(schemaPath, schemaDigest);
    return cached;
  }

  const validator = new SchemaValidator(schema);
  if (schemaValidatorCacheOrder.length >= DEFAULT_SHARED_SCHEMA_VALIDATOR_CACHE_LIMIT) {
    evictOldestSharedSchemaValidator();
  }

  let validatorsByContent = schemaValidatorCache.get(schemaPath);
  if (!validatorsByContent) {
    validatorsByContent = new Map<string, SchemaValidator>();
    schemaValidatorCache.set(schemaPath, validatorsByContent);
  }
  validatorsByContent.set(schemaDigest, validator);
  schemaValidatorCacheOrder.push({ schemaPath, schemaDigest });

  return validator;
}

export function clearSharedSchemaValidatorCache(): void {
  schemaValidatorCache.clear();
  schemaValidatorCacheOrder.length = 0;
}

export interface ValidateCommandResult {
  valid: boolean;
  errors: string[];
}

export async function validateCommand(
  templatePath: string,
  schemaPath?: string,
  inputPath?: string
): Promise<ValidateCommandResult> {
  try {
    const templateContent = readFileSync(templatePath, 'utf-8');
    const templateValidation = validateTemplate(templateContent);
    const errors = [...(templateValidation.errors ?? [])];

    if (inputPath && !schemaPath) {
      throw new Error('Schema path is required when validating input data (pass --schema)');
    }

    if (schemaPath) {
      const schemaContent = readFileSync(schemaPath, 'utf-8');
      const parsedSchema = await parseDataAsync(schemaContent, schemaPath);
      const schema = parsedSchema as JSONSchema;
      const validator = getSharedSchemaValidator(
        schemaPath,
        getSchemaDigest(schemaContent),
        schema
      );

      if (!validator.isCompiled) {
        const compilationDetail =
          validator.compilationError ?? `unknown compilation error for schema '${schemaPath}'`;
        errors.push(`Schema compilation failed - ${compilationDetail}`);
      } else if (inputPath) {
        const inputContent = readFileSync(inputPath, 'utf-8');
        const parsedInput = await parseDataAsync(inputContent, inputPath);
        const schemaValidation = validator.validate(parsedInput);

        if (!schemaValidation.valid) {
          for (const validationError of schemaValidation.errors) {
            const pathPrefix = validationError.path ? `${validationError.path}: ` : '';
            errors.push(`Schema validation failed - ${pathPrefix}${validationError.message}`);
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Validation failed: ${message}`, { cause: error });
  }
}
