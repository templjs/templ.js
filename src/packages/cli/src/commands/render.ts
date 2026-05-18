/**
 * @templjs/cli - render command
 * Renders a template with input data
 */

import { readFileSync, statSync } from 'fs';
import { renderTemplate } from '@templjs/core';
import JSONParser from 'jsonparse';
import {
  LARGE_FILE_THRESHOLD,
  readFileStream,
  shouldStream,
  streamToString,
} from '../streaming-io.js';
import { detectFormat, getParser, XmlParser } from '../formats/index.js';
import type { SupportedFormat } from '../formats/types.js';

export interface RenderCommandOptions {
  experimentalStreamJson?: boolean;
  inputFormat?: SupportedFormat;
  outputFormat?: 'text' | 'json' | 'html' | 'markdown';
  validateInput?: boolean;
  validateOutput?: boolean;
  progressReporter?: (message: string) => void;
}

async function parsePayloadByFormat(
  payload: string,
  inputFormat: SupportedFormat,
  validateInput: boolean
): Promise<unknown> {
  if (inputFormat === 'xml') {
    return new XmlParser().parseAsync(payload);
  }

  if (inputFormat === 'json' && !validateInput) {
    try {
      return JSON.parse(payload) as unknown;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid JSON: ${message}`, { cause: error });
    }
  }

  return getParser(inputFormat).parse(payload);
}

function validateParsedObject(parsed: unknown): Record<string, unknown> {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Input data must be a JSON object');
  }
  return parsed as Record<string, unknown>;
}

function normalizeParsedInput(parsed: unknown, validateInput: boolean): Record<string, unknown> {
  if (validateInput) {
    return validateParsedObject(parsed);
  }

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }

  return { data: parsed };
}

export function calculateProgressPercent(bytesRead: number, totalBytes: number): number {
  if (!Number.isFinite(totalBytes) || totalBytes <= 0) {
    return 100;
  }

  if (!Number.isFinite(bytesRead)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.floor((bytesRead / totalBytes) * 100)));
}

async function parseJsonObjectStream(
  stream: AsyncIterable<string>,
  validateInput: boolean
): Promise<Record<string, unknown>> {
  const parser = new JSONParser();
  let rootValue: unknown;
  let sawRootValue = false;

  parser.onValue = function onValue(this: { stack: unknown[] }, value: unknown): void {
    if (this.stack.length === 0) {
      if (sawRootValue) {
        throw new Error('Multiple JSON root values are not supported');
      }
      rootValue = value;
      sawRootValue = true;
    }
  };

  for await (const chunk of stream) {
    parser.write(chunk);
  }

  if (!sawRootValue) {
    throw new Error('Input data is empty or incomplete JSON');
  }

  return normalizeParsedInput(rootValue, validateInput);
}

class RenderCommandExecutor {
  private readonly options: RenderCommandOptions;

  constructor(options?: RenderCommandOptions) {
    this.options = options ?? {};
  }

  async parseData(dataOrPath: string): Promise<Record<string, unknown>> {
    const inputFormat = this.resolveInputFormat(dataOrPath);
    const validateInput = this.options.validateInput !== false;

    if (this.shouldUseStreamingJson(dataOrPath, inputFormat)) {
      return this.parseDataStream(dataOrPath, validateInput);
    }

    const payload = await this.readPayload(dataOrPath);

    try {
      const parsed = await parsePayloadByFormat(payload, inputFormat, validateInput);
      return normalizeParsedInput(parsed, validateInput);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to parse input data as ${inputFormat.toUpperCase()}: ${message}`, {
        cause: error,
      });
    }
  }

  formatOutput(rendered: string): string {
    const outputFormat = this.options.outputFormat ?? 'text';
    const validateOutput = this.options.validateOutput !== false;

    switch (outputFormat) {
      case 'text':
      case 'html':
      case 'markdown':
        return rendered;
      case 'json':
        try {
          return JSON.stringify(JSON.parse(rendered), null, 2);
        } catch (error) {
          if (validateOutput) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Rendered output is not valid JSON: ${message}`, { cause: error });
          }
          return rendered;
        }
    }
  }

  private async readPayload(dataOrPath: string): Promise<string> {
    if (dataOrPath === '-') {
      process.stdin.setEncoding('utf-8');
      // For stdin, we must read full content since we don't know format/size upfront
      // and streaming JSON parser needs to know the structure
      return await streamToString(process.stdin as AsyncIterable<string>);
    }

    // Handle file errors gracefully: attempt stat/read directly and handle file errors in catch block
    try {
      const inputStats = statSync(dataOrPath);
      if (!shouldStream(inputStats.size, LARGE_FILE_THRESHOLD)) {
        return readFileSync(dataOrPath, 'utf-8');
      }

      // Large file: use streaming approach to avoid buffering entire content
      const stream = readFileStream(dataOrPath, inputStats.size, {
        encoding: 'utf-8',
        onProgress: this.createProgressReporter(inputStats.size),
      });

      // For streaming JSON, use incremental parser; for others, buffer is necessary
      if (this.streamJsonEnabled() && this.resolveInputFormat(dataOrPath) === 'json') {
        // parseJsonObjectStream will consume stream incrementally without full buffering
        const parsed = await parseJsonObjectStream(stream, false);
        // Return serialized version for downstream consistency
        return JSON.stringify(parsed);
      }

      // YAML, XML, TOML: must buffer entire content for parsing
      return await streamToString(stream);
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
      if (code === 'EISDIR' || code === 'ENOTDIR') {
        throw new Error(`Invalid input file path (not a regular file): ${dataOrPath}`, {
          cause: error,
        });
      }
      // Propagate other file system errors
      throw error;
    }
  }

  private streamJsonEnabled(): boolean {
    return (
      this.options.experimentalStreamJson === true ||
      process.env.TEMPLJS_EXPERIMENTAL_STREAM_JSON === '1'
    );
  }

  private resolveInputFormat(dataOrPath: string): SupportedFormat {
    if (this.options.inputFormat !== undefined) {
      return this.options.inputFormat;
    }

    if (dataOrPath === '-') {
      return 'json';
    }

    const detectedFormat = detectFormat(dataOrPath);
    if (detectedFormat !== null) {
      return detectedFormat;
    }

    throw new Error(
      `Unable to detect input format from "${dataOrPath}". Use --input-format=json|yaml|toml|xml or a supported file extension.`
    );
  }

  private createProgressReporter(totalBytes: number): (bytesRead: number) => void {
    let lastProgressBucket = -1;

    return (bytesRead: number) => {
      if (!Number.isFinite(bytesRead)) {
        return;
      }
      const progress = calculateProgressPercent(bytesRead, totalBytes);
      const progressBucket = Math.floor(progress / 25);
      if (progressBucket > lastProgressBucket) {
        this.options.progressReporter?.(`Reading large input file (${progress}%)\n`);
        lastProgressBucket = progressBucket;
      }
    };
  }

  private createFileInputStream(dataOrPath: string): AsyncIterable<string> {
    const inputStats = statSync(dataOrPath);
    const onProgress = shouldStream(inputStats.size, LARGE_FILE_THRESHOLD)
      ? this.createProgressReporter(inputStats.size)
      : undefined;

    return readFileStream(dataOrPath, inputStats.size, {
      encoding: 'utf-8',
      onProgress,
    });
  }

  private async parseDataStream(
    dataOrPath: string,
    validateInput: boolean
  ): Promise<Record<string, unknown>> {
    try {
      if (dataOrPath === '-') {
        process.stdin.setEncoding('utf-8');
        return await parseJsonObjectStream(process.stdin as AsyncIterable<string>, validateInput);
      }

      return await parseJsonObjectStream(this.createFileInputStream(dataOrPath), validateInput);
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
      if (code === 'EISDIR' || code === 'ENOTDIR') {
        throw new Error(`Invalid input file path (not a regular file): ${dataOrPath}`, {
          cause: error,
        });
      }

      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to parse input data as JSON: ${message}`, { cause: error });
    }
  }

  private shouldUseStreamingJson(dataOrPath: string, inputFormat: SupportedFormat): boolean {
    if (inputFormat !== 'json') {
      return false;
    }

    if (this.streamJsonEnabled()) {
      return true;
    }

    if (dataOrPath === '-') {
      return false;
    }

    try {
      return shouldStream(statSync(dataOrPath).size, LARGE_FILE_THRESHOLD);
    } catch {
      return false;
    }
  }
}

export async function renderCommand(
  templatePath: string,
  dataOrPath: string,
  options?: RenderCommandOptions
): Promise<string> {
  try {
    const templateContent = readFileSync(templatePath, 'utf-8');
    const executor = new RenderCommandExecutor(options);
    const parsedData = await executor.parseData(dataOrPath);
    const rendered = renderTemplate(templateContent, parsedData, {
      throwOnError: true,
    });
    return executor.formatOutput(rendered);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Render failed: ${message}`, { cause: error });
  }
}
