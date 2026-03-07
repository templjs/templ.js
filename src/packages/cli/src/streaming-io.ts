/**
 * Streaming I/O utilities for handling large files
 * Provides efficient reading/writing of files larger than memory buffers
 */

import { createReadStream, createWriteStream } from 'fs';
import type { WriteStream } from 'fs';

export const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024; // 10MB

export interface StreamingReadOptions {
  encoding?: BufferEncoding;
  highWaterMark?: number;
  onProgress?: (bytesRead: number, totalBytes?: number) => void;
}

export interface StreamingWriteOptions {
  encoding?: BufferEncoding;
  highWaterMark?: number;
}

/**
 * Read a file in chunks, suitable for large files
 * @param path - File path to read
 * @param totalBytes - Total file size (optional, for progress)
 * @param options - Streaming options
 * @returns Async iterator of chunks
 */
export async function* readFileStream(
  path: string,
  totalBytes?: number,
  options: StreamingReadOptions = {}
): AsyncGenerator<string, void, unknown> {
  const stream = createReadStream(path, {
    encoding: options.encoding ?? 'utf-8',
    highWaterMark: options.highWaterMark ?? 16 * 1024, // 16KB chunks
  });

  let bytesRead = 0;
  let lastProgressUpdate = 0;
  let completed = false;

  try {
    for await (const chunk of stream) {
      const value = typeof chunk === 'string' ? chunk : chunk.toString(options.encoding ?? 'utf-8');
      bytesRead += Buffer.byteLength(value, options.encoding ?? 'utf-8');

      // Call progress callback periodically
      if (options.onProgress && bytesRead - lastProgressUpdate > 1024 * 1024) {
        options.onProgress(bytesRead, totalBytes);
        lastProgressUpdate = bytesRead;
      }

      yield value;
    }

    completed = true;
  } finally {
    if (!stream.destroyed) {
      stream.destroy();
    }

    // Final progress update (only after successful completion)
    if (completed && options.onProgress) {
      options.onProgress(bytesRead, totalBytes);
    }
  }
}

/**
 * Write data to a file using streaming
 * @param path - File path to write to
 * @param options - Streaming options
 * @returns Write stream
 */
export function createFileWriteStream(
  path: string,
  options: StreamingWriteOptions = {}
): WriteStream {
  return createWriteStream(path, {
    encoding: options.encoding ?? 'utf-8',
    highWaterMark: options.highWaterMark ?? 16 * 1024,
  });
}

/**
 * Check if a file should be streamed based on size
 * @param fileSize - File size in bytes
 * @param threshold - Threshold for streaming (default: 10MB)
 * @returns True if file should be streamed
 */
export function shouldStream(fileSize: number, threshold: number = LARGE_FILE_THRESHOLD): boolean {
  return fileSize >= threshold;
}

/**
 * Collect chunks from a stream into a single string
 * @param stream - Stream to read from
 * @returns Promise resolving to complete string
 */
export async function streamToString(stream: AsyncIterable<string>): Promise<string> {
  const chunks: string[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return chunks.join('');
}
