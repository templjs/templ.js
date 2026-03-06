/**
 * Signal handler for CLI process
 * Registers handlers for SIGINT, SIGTERM, and SIGPIPE
 */

export interface SignalHandlerOptions {
  onSigInt?: () => void | Promise<void>;
  onSigTerm?: () => void | Promise<void>;
  onSigPipe?: () => void | Promise<void>;
}

/**
 * Register signal handlers with cleanup logic
 * - SIGINT (Ctrl+C): Graceful shutdown, exit code 130
 * - SIGTERM: Graceful shutdown, exit code 143
 * - SIGPIPE: Silent exit (broken pipe in pipelines), exit code 141
 */
export function registerSignalHandlers(options: SignalHandlerOptions = {}): () => void {
  let isHandling = false;

  const handleSignal = async (
    signal: string,
    exitCode: number,
    handler?: () => void | Promise<void>
  ) => {
    if (isHandling) {
      return;
    }
    isHandling = true;

    try {
      if (handler) {
        let timeoutId: NodeJS.Timeout;
        // Create a timeout promise that rejects after 5 seconds
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error(`Handler timeout for ${signal}`));
          }, 5000);
        });
        // Race the handler against the timeout
        try {
          await Promise.race([handler(), timeoutPromise]);
        } finally {
          clearTimeout(timeoutId!);
        }
      }
    } catch (error) {
      // Prevent handler errors from interfering with shutdown
      const message = error instanceof Error ? error.message : String(error);
      // Only write errors to stderr if not SIGPIPE (silent exit)
      if (signal !== 'SIGPIPE') {
        process.stderr.write(`Error during ${signal} cleanup: ${message}\n`);
      }
    } finally {
      process.exit(exitCode);
    }
  };

  // Handle SIGINT (Ctrl+C)
  const sigintHandler = () => {
    void handleSignal('SIGINT', 130, options.onSigInt);
  };

  // Handle SIGTERM (termination signal)
  const sigtermHandler = () => {
    void handleSignal('SIGTERM', 143, options.onSigTerm);
  };

  // Handle SIGPIPE (broken pipe - should exit silently)
  const sigpipeHandler = () => {
    void handleSignal('SIGPIPE', 141, options.onSigPipe);
  };

  process.on('SIGINT', sigintHandler);
  process.on('SIGTERM', sigtermHandler);
  process.on('SIGPIPE', sigpipeHandler);

  // Return cleanup function to remove handlers
  return () => {
    process.removeListener('SIGINT', sigintHandler);
    process.removeListener('SIGTERM', sigtermHandler);
    process.removeListener('SIGPIPE', sigpipeHandler);
  };
}
