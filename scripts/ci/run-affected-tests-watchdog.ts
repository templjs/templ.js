#!/usr/bin/env tsx
import { spawn, spawnSync, execSync } from 'node:child_process';

type Mode = 'ci' | 'pre-push' | 'local';

const VALID_MODES = new Set<Mode>(['ci', 'pre-push', 'local']);
const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseMode(argv: string[]): Mode {
  const mode = argv[0] as Mode | undefined;
  if (mode && VALID_MODES.has(mode)) {
    return mode;
  }

  console.error('Usage: tsx scripts/ci/run-affected-tests-watchdog.ts <ci|pre-push|local>');
  process.exit(1);
}

function resolveBaseBranch(mode: Mode): string {
  if (mode === 'ci') {
    return 'origin/main';
  }

  const result = spawnSync('git', ['rev-parse', '--verify', 'origin/main'], {
    stdio: 'ignore',
  });

  return result.status === 0 ? 'origin/main' : 'main';
}

function resolveReporters(): string[] {
  const envValue = process.env.VITEST_REPORTERS;
  if (!envValue) return ['dot', 'hanging-process'];

  const reporters = envValue
    .split(',')
    .map((reporter) => reporter.trim())
    .filter(Boolean);

  return reporters.length > 0 ? reporters : ['dot', 'hanging-process'];
}

function buildArgs(mode: Mode): string[] {
  const nxParallel = process.env.NX_PARALLEL ?? '3';
  const baseBranch = resolveBaseBranch(mode);

  const args = [
    'exec',
    'nx',
    'affected',
    '-t',
    'test',
    `--base=${baseBranch}`,
    `--parallel=${nxParallel}`,
  ];

  if (['ci', 'pre-push'].includes(mode)) {
    args.push('--outputStyle=static');
  }

  const testTimeoutMs = parsePositiveInt(process.env.VITEST_TEST_TIMEOUT_MS, 15_000);
  const hookTimeoutMs = parsePositiveInt(process.env.VITEST_HOOK_TIMEOUT_MS, 15_000);
  const teardownTimeoutMs = parsePositiveInt(process.env.VITEST_TEARDOWN_TIMEOUT_MS, 15_000);
  const reporters = resolveReporters();

  args.push('--');
  if (['ci', 'pre-push'].includes(mode)) {
    args.push('--coverage');
  }
  for (const reporter of reporters) {
    args.push(`--reporter=${reporter}`);
  }
  args.push(
    `--testTimeout=${testTimeoutMs}`,
    `--hookTimeout=${hookTimeoutMs}`,
    `--teardownTimeout=${teardownTimeoutMs}`
  );

  return args;
}

function terminateProcessTree(pid: number, signal: NodeJS.Signals): void {
  if (process.platform === 'win32') {
    // Use taskkill to terminate the entire process tree on Windows
    try {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
    } catch {
      // Fallback to process.kill if taskkill fails
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
  const mode = parseMode(process.argv.slice(2));
  const args = buildArgs(mode);

  const defaultWatchdogMs = mode === 'ci' ? 20 * 60_000 : 10 * 60_000;
  const watchdogTimeoutMs = parsePositiveInt(
    process.env.TEST_WATCHDOG_TIMEOUT_MS,
    defaultWatchdogMs
  );

  const child = spawn(pnpmCmd, args, {
    stdio: 'inherit',
    env: process.env,
    detached: process.platform !== 'win32',
  });

  let timedOut = false;
  let forceKillTimer: NodeJS.Timeout | undefined;
  const watchdogTimer = setTimeout(() => {
    timedOut = true;
    console.error(
      `watchdog timeout: test command exceeded ${watchdogTimeoutMs}ms and will be terminated`
    );
    terminateChild(child, 'SIGTERM');
    forceKillTimer = setTimeout(() => terminateChild(child, 'SIGKILL'), 10_000);
  }, watchdogTimeoutMs);

  const forwardSignal = (signal: NodeJS.Signals): void => {
    terminateChild(child, signal);
  };

  process.on('SIGINT', () => forwardSignal('SIGINT'));
  process.on('SIGTERM', () => forwardSignal('SIGTERM'));

  child.on('error', (error) => {
    clearTimeout(watchdogTimer);
    if (forceKillTimer) clearTimeout(forceKillTimer);
    console.error(`failed to spawn test command: ${error.message}`);
    process.exit(1);
  });

  child.on('close', (code, signal) => {
    clearTimeout(watchdogTimer);
    if (forceKillTimer) clearTimeout(forceKillTimer);

    if (timedOut) {
      process.exit(124);
    }

    if (signal) {
      console.error(`test command terminated by signal: ${signal}`);
      process.exit(1);
    }

    process.exit(code ?? 1);
  });
}

main();
