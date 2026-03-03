/**
 * @templjs/cli - render command
 * Renders a template with input data
 */

import { existsSync, readFileSync } from 'fs';
import { renderTemplate } from '@templjs/core';

function parseData(dataOrPath: string): Record<string, unknown> {
  const payload = existsSync(dataOrPath) ? readFileSync(dataOrPath, 'utf-8') : dataOrPath;

  try {
    const parsed = JSON.parse(payload) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Input data must be a JSON object');
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse input data as JSON: ${message}`, { cause: error });
  }
}

export async function renderCommand(templatePath: string, dataOrPath: string): Promise<string> {
  try {
    const templateContent = readFileSync(templatePath, 'utf-8');
    const parsedData = parseData(dataOrPath);
    const result = renderTemplate(templateContent, parsedData);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Render failed: ${message}`, { cause: error });
  }
}
