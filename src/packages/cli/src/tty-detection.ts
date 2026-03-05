/**
 * TTY (terminal) detection for CLI
 * Determines if input/output is interactive or piped
 */

export interface TTYDetectionResult {
  stdinIsTTY: boolean;
  stdoutIsTTY: boolean;
  stderrIsTTY: boolean;
  isInteractive: boolean;
}

/**
 * Detect if we're running in an interactive terminal
 * @returns TTY detection result
 */
export function detectTTY(): TTYDetectionResult {
  const stdinIsTTY = process.stdin.isTTY ?? false;
  const stdoutIsTTY = process.stdout.isTTY ?? false;
  const stderrIsTTY = process.stderr.isTTY ?? false;

  // Interactive mode is when all streams are TTYs
  // Or at minimum when stdin and stdout are TTYs
  const isInteractive = stdinIsTTY && stdoutIsTTY;

  return {
    stdinIsTTY,
    stdoutIsTTY,
    stderrIsTTY,
    isInteractive,
  };
}

/**
 * Get appropriate timeout based on interactive mode
 * Interactive mode typically needs longer timeout for user input
 * Pipe mode should timeout faster to avoid hanging in pipelines
 * @param isInteractive - Whether running in interactive mode
 * @param interactiveMs - Timeout for interactive mode (default: 30000ms)
 * @param pipeMs - Timeout for pipe mode (default: 5000ms)
 * @returns Timeout in milliseconds
 */
export function getTimeoutForMode(
  isInteractive: boolean,
  interactiveMs: number = 30000,
  pipeMs: number = 5000
): number {
  return isInteractive ? interactiveMs : pipeMs;
}
