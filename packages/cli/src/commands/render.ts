/**
 * @templjs/cli - render command
 * Renders a template with input data
 */

import { readFileSync } from 'fs';
import { renderTemplate } from '@templjs/core';

export async function renderCommand(template: string, data: string): Promise<string> {
  try {
    // Read template file
    const templateContent = readFileSync(template, 'utf-8');

    // Parse data (JSON for now)
    const parsedData = JSON.parse(data);

    // Render
    const result = renderTemplate(templateContent, parsedData);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Render failed: ${message}`, { cause: error });
  }
}
