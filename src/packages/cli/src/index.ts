/**
 * @templjs/cli - Command-line interface for templjs
 *
 * Provides command-line tools for processing templates,
 * validating syntax, and generating output files.
 */

import { createRequire } from 'node:module';
import { renderTemplate, validateTemplate as validateTemplateCore } from '@templjs/core';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version: string };

export const version = packageJson.version;

/**
 * Process a template with data
 * @param template - Template string to process
 * @param data - Data for rendering
 * @returns Rendered template output
 */
export function processTemplate(template: string, data: Record<string, unknown>): string {
  return renderTemplate(template, data);
}

/**
 * Validate template syntax
 * @param template - Template string to validate
 * @returns Whether the template is valid
 */
export function validateTemplate(template: string): boolean {
  const result = validateTemplateCore(template);
  return result.valid;
}

export default {
  version,
  processTemplate,
  validateTemplate,
};
