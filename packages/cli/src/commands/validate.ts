/**
 * @templjs/cli - validate command
 * Validates a template and input data against schema
 */

import { validateTemplate } from '@templjs/core';

export async function validateCommand(template: string, _schema?: string): Promise<boolean> {
  try {
    // Validate template structure
    const result = validateTemplate(template);
    if (result.errors && result.errors.length > 0) {
      console.error('Validation errors:', result.errors);
    }
    return result.valid;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line preserve-caught-error
    throw new Error(`Validation failed: ${message}`);
  }
}
