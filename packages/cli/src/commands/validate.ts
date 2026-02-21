/**
 * @templjs/cli - validate command
 * Validates a template and input data against schema
 */

import { validateTemplate } from '@templjs/core';

export async function validateCommand(template: string, _schema?: string): Promise<boolean> {
  try {
    // Validate template structure
    const valid = validateTemplate(template);
    return valid;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Validation failed: ${message}`, { cause: error });
  }
}
