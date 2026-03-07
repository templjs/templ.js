/**
 * @templjs/cli - render command
 * Renders a template with input data
 */

import { createReadStream, readFileSync, statSync } from 'fs';
import { renderTemplate } from '@templjs/core';
import { parseDataAsync } from '../formats/index.js';

const LARGE_INPUT_THRESHOLD_BYTES = 10 * 1024 * 1024;

async function readPayload(dataOrPath: string): Promise<string> {
  if (dataOrPath === '-') {
    const chunks: string[] = [];
    for await (const chunk of process.stdin) {
      const value = typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
      chunks.push(value);
    }
    return chunks.join('');
  }

  // Handle file errors gracefully: attempt stat/read directly and handle file errors in catch block
  try {
    const inputStats = statSync(dataOrPath);
    if (inputStats.size <= LARGE_INPUT_THRESHOLD_BYTES) {
      return readFileSync(dataOrPath, 'utf-8');
    }

    const chunks: string[] = [];
    const stream = createReadStream(dataOrPath, { encoding: 'utf-8' });
    let bytesRead = 0;
    let lastProgressBucket = -1;

    for await (const chunk of stream) {
      const value = typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
      chunks.push(value);
      bytesRead += Buffer.byteLength(value);

      const progress = Math.min(100, Math.floor((bytesRead / inputStats.size) * 100));
      const progressBucket = Math.floor(progress / 25);
      if (progressBucket > lastProgressBucket) {
        process.stderr.write(`Reading large input file (${progress}%)\n`);
        lastProgressBucket = progressBucket;
      }
    }

    return chunks.join('');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      throw new Error(
        `Input file not found: ${dataOrPath}. Use "-" to read from stdin or provide a valid file path.`,
        { cause: error }
      );
    }
    if (code === 'EACCES' || code === 'EPERM') {
      throw new Error(`Permission denied reading input file: ${dataOrPath}`, { cause: error });
    }
    // Propagate other file system errors
    throw error;
  }
}

async function parseData(dataOrPath: string): Promise<Record<string, unknown>> {
  const payload = await readPayload(dataOrPath);

  try {
    return await parseDataAsync(payload, dataOrPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse input data: ${message}`, { cause: error });
  }
}

export async function renderCommand(templatePath: string, dataOrPath: string): Promise<string> {
  try {
    const templateContent = readFileSync(templatePath, 'utf-8');
    const parsedData = await parseData(dataOrPath);
    const result = renderTemplate(templateContent, parsedData);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Render failed: ${message}`, { cause: error });
  }
}
