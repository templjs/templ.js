/**
 * @templjs/cli - validate command
 * Validates template syntax and optionally validates input data against a schema
 */

import { readFileSync } from 'fs';
import { SchemaValidator, validateTemplate, type JSONSchema } from '@templjs/core';
import { parseDataAsync } from '../formats/index.js';

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
      const validator = new SchemaValidator(parsedSchema as JSONSchema);

      if (inputPath) {
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
      valid: errors.length === 0 && templateValidation.valid,
      errors,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Validation failed: ${message}`, { cause: error });
  }
}
