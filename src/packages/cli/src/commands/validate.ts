/**
 * @templjs/cli - validate command
 * Validates a template and input data against schema
 */

import { readFileSync } from 'fs';
import { validateTemplate } from '@templjs/core';

export interface ValidateCommandResult {
  valid: boolean;
  errors: string[];
  schemaWarning?: string;
}

export async function validateCommand(
  templatePath: string,
  schemaPath?: string
): Promise<ValidateCommandResult> {
  try {
    const templateContent = readFileSync(templatePath, 'utf-8');
    const result = validateTemplate(templateContent);
    const errors = result.errors ?? [];
    const schemaWarning = schemaPath
      ? `Schema validation flag provided (${schemaPath}) but schema validation is not yet wired in @templjs/core`
      : undefined;

    return {
      valid: result.valid,
      errors,
      ...(schemaWarning ? { schemaWarning } : {}),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Validation failed: ${message}`, { cause: error });
  }
}
