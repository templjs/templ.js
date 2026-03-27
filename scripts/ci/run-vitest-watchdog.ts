#!/usr/bin/env tsx
import { execSync, spawn } from 'node:child_process';

const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

function getSpawnOptions(): {
  stdio: 'inherit';
  env: NodeJS.ProcessEnv;
  detached: boolean;
  shell?: boolean;
} {
  return {
    stdio: 'inherit',
    env: process.env,
    detached: process.platform !== 'win32',
    // Windows frequently rejects direct .cmd spawns in CI; route through the shell there.
    ...(process.platform === 'win32' ? { shell: true } : {}),
  };
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function hasOption(args: string[], name: string): boolean {
  return args.some(
    (arg, index) => arg === name || arg.startsWith(`${name}=`) || args[index - 1] === name
  );
}

function resolveReporters(): string[] {
  const raw = process.env.VITEST_REPORTERS;
  if (!raw) return ['dot', 'hanging-process'];

  const reporters = raw
    .split(',')
    .map((reporter) => reporter.trim())
    .filter(Boolean);

  return reporters.length > 0 ? reporters : ['dot', 'hanging-process'];
}

function terminateProcessTree(pid: number, signal: NodeJS.Signals): void {
  if (process.platform === 'win32') {
    try {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
    } catch {
      try {
        process.kill(pid, signal);
      } catch {
        // Ignore kill errors; process may already have exited.
      }
    }
    return;
  }

  try {
    process.kill(-pid, signal);
  } catch {
    try {
      process.kill(pid, signal);
    } catch {
      // Ignore kill errors; process may already have exited.
    }
  }
}

function terminateChild(child: ReturnType<typeof spawn>, signal: NodeJS.Signals): void {
  const pid = child.pid;
  if (typeof pid !== 'number') return;
  terminateProcessTree(pid, signal);
}

function main(): void {
  const baseArgs = process.argv.slice(2);
  const args = ['exec', 'vitest', 'run', ...baseArgs];

  if (!hasOption(baseArgs, '--reporter')) {
    for (const reporter of resolveReporters()) {
      args.push(`--reporter=${reporter}`);
    }
  }

  if (!hasOption(baseArgs, '--testTimeout')) {
    const testTimeoutMs = parsePositiveInt(process.env.VITEST_TEST_TIMEOUT_MS, 15_000);
    args.push(`--testTimeout=${testTimeoutMs}`);
  }

  if (!hasOption(baseArgs, '--hookTimeout')) {
    const hookTimeoutMs = parsePositiveInt(process.env.VITEST_HOOK_TIMEOUT_MS, 15_000);
    args.push(`--hookTimeout=${hookTimeoutMs}`);
  }

  if (!hasOption(baseArgs, '--teardownTimeout')) {
    const teardownTimeoutMs = parsePositiveInt(process.env.VITEST_TEARDOWN_TIMEOUT_MS, 15_000);
    args.push(`--teardownTimeout=${teardownTimeoutMs}`);
  }

  const watchdogTimeoutMs = parsePositiveInt(process.env.TEST_WATCHDOG_TIMEOUT_MS, 10 * 60_000);
  const child = spawn(pnpmCmd, args, getSpawnOptions());

  let timedOut = false;
  let forceKillTimer: NodeJS.Timeout | undefined;
  const watchdogTimer = setTimeout(() => {
    timedOut = true;
    console.error(
      `watchdog timeout: vitest command exceeded ${watchdogTimeoutMs}ms and will be terminated`
    );
    terminateChild(child, 'SIGTERM');
    forceKillTimer = setTimeout(() => terminateChild(child, 'SIGKILL'), 10_000);
  }, watchdogTimeoutMs);

  process.on('SIGINT', () => terminateChild(child, 'SIGINT'));
  process.on('SIGTERM', () => terminateChild(child, 'SIGTERM'));

  child.on('error', (error) => {
    clearTimeout(watchdogTimer);
    if (forceKillTimer) clearTimeout(forceKillTimer);
    console.error(`failed to spawn vitest command: ${error.message}`);
    process.exit(1);
  });

  child.on('close', (code, signal) => {
    clearTimeout(watchdogTimer);
    if (forceKillTimer) clearTimeout(forceKillTimer);

    if (timedOut) {
      process.exit(124);
    }

    if (signal) {
      console.error(`vitest command terminated by signal: ${signal}`);
      process.exit(1);
    }

    process.exit(code ?? 1);
  });
}

main();
