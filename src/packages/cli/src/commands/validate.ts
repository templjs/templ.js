/**
 * @templjs/cli - validate command
 * Validates template syntax and optionally validates input data against a schema
 */

import { readFileSync } from 'fs';
import { SchemaValidator, validateTemplate, type JSONSchema } from '@templjs/core';
import { parseDataAsync } from '../formats/index.js';

const schemaValidatorCache = new Map<string, SchemaValidator>();

function getSharedSchemaValidator(cacheKey: string, schema: JSONSchema): SchemaValidator {
  const cached = schemaValidatorCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const validator = new SchemaValidator(schema);
  schemaValidatorCache.set(cacheKey, validator);
  return validator;
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
      const validator = getSharedSchemaValidator(`${schemaPath}::${schemaContent}`, schema);

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
