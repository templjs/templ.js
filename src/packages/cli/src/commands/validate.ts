/**
 * @templjs/cli - validate command
 * Validates a template and input data against schema
 */

import { readFileSync } from 'fs';
import { validateTemplate } from '@templjs/core';

export async function validateCommand(templatePath: string, schemaPath?: string): Promise<boolean> {
  try {
    const templateContent = readFileSync(templatePath, 'utf-8');
    const result = validateTemplate(templateContent);

    if (schemaPath) {
      console.warn(
        `Schema validation flag provided (${schemaPath}) but schema validation is not yet wired in @templjs/core`
      );
    }

    if (result.errors && result.errors.length > 0) {
      console.error('Validation errors:', result.errors);
    }
    return result.valid;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Validation failed: ${message}`, { cause: error });
  }
}
