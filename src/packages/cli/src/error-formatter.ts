/**
 * Error formatter for CLI output
 * Formats error messages with context snippets showing code around the error
 */

export interface ErrorContextOptions {
  contextLines?: number; // Number of lines before/after error (default: 3)
  showLineNumbers?: boolean; // Show line numbers (default: true)
  highlightColumn?: boolean; // Show ^ marker for column (default: true)
}

export interface FormattedError {
  message: string;
  context?: string;
}

/**
 * Get a source snippet with context around a specific line
 * @param source - The source code/content
 * @param lineNumber - Line number (1-indexed) where error occurred
 * @param column - Column number (1-indexed) for error position
 * @param options - Formatting options
 * @returns Formatted error with context
 */
export function formatErrorContext(
  source: string,
  lineNumber: number,
  column: number,
  options: ErrorContextOptions = {}
): FormattedError {
  const contextLines = options.contextLines ?? 3;
  const showLineNumbers = options.showLineNumbers ?? true;
  const highlightColumn = options.highlightColumn ?? true;

  const lines = source.split(/\r?\n/);

  // Validate line number
  if (lineNumber < 1 || lineNumber > lines.length) {
    return {
      message: `Error at line ${lineNumber}, column ${column}`,
    };
  }

  // Calculate start and end lines
  const startLine = Math.max(0, lineNumber - contextLines - 1); // Convert to 0-indexed
  const endLine = Math.min(lines.length - 1, lineNumber + contextLines - 1);

  // Build context
  const contextParts: string[] = [];

  for (let i = startLine; i <= endLine; i++) {
    const currentLine = lines[i];
    const lineNum = i + 1;
    const prefix = showLineNumbers ? `${String(lineNum).padStart(3)} | ` : '';

    contextParts.push(`${prefix}${currentLine}`);

    // Add column marker for the error line
    if (i === lineNumber - 1 && highlightColumn && column > 0) {
      const offset = showLineNumbers ? prefix.length : 0;
      const marker = ' '.repeat(offset + column - 1) + '^';
      contextParts.push(marker);
    }
  }

  return {
    message: `Error at line ${lineNumber}, column ${column}`,
    context: contextParts.join('\n'),
  };
}

/**
 * Format a generic error with optional context
 * @param error - The error message or Error object
 * @param source - Optional source code to provide context
 * @param lineNumber - Optional line number for error location
 * @param column - Optional column number for error position
 * @param options - Formatting options
 * @returns Formatted error string
 */
export function formatError(
  error: string | Error,
  source?: string,
  lineNumber?: number,
  column?: number,
  options: ErrorContextOptions = {}
): string {
  const message = error instanceof Error ? error.message : error;
  const parts: string[] = [message];

  if (source && lineNumber !== undefined && column !== undefined) {
    const formatted = formatErrorContext(source, lineNumber, column, options);
    if (formatted.context) {
      parts.push('');
      parts.push(formatted.context);
    }
  }

  return parts.join('\n');
}

/**
 * Try to provide helpful error message for common template/data errors
 */
export function provideErrorSuggestion(errorMessage: string): string | undefined {
  if (!errorMessage) return undefined;
  if (!errorMessage?.toLowerCase) return String(errorMessage);

  const normalized = errorMessage.toLowerCase();

  // File not found (check before generic "not found")
  if (
    normalized.includes('enoent') ||
    normalized.includes('file not found') ||
    normalized.includes('no such file')
  ) {
    return 'Verify the file path exists and is readable';
  }

  // Directory provided where file is expected
  if (normalized.includes('eisdir') || normalized.includes('illegal operation on a directory')) {
    return 'Expected a file path but received a directory path';
  }

  // Permission errors
  if (
    normalized.includes('eacces') ||
    normalized.includes('eperm') ||
    normalized.includes('permission')
  ) {
    return 'Check file permissions for read/write access';
  }

  // Undefined variable suggestions
  if (normalized.includes('undefined') || normalized.includes('not found')) {
    return 'Did you check that the variable exists in your data?';
  }

  // JSON parsing errors
  if (normalized.includes('json')) {
    return 'Ensure your input data is valid JSON format';
  }

  // YAML/TOML errors (future)
  if (normalized.includes('yaml') || normalized.includes('toml')) {
    return 'Check the syntax of your input file';
  }

  return undefined;
}
