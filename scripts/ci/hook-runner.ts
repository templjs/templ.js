#!/usr/bin/env tsx
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

type HookName = 'pre-commit' | 'pre-push';

interface HookTask {
  script: string;
  optional: boolean;
}

interface TaskReport {
  exitCode: number;
  durationMs: number;
  output: string;
  metrics: string[];
  errors: string[];
}

const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

const hookTasks: Record<HookName, HookTask[]> = {
  'pre-commit': [{ script: 'lint:staged', optional: false }],
  'pre-push': [
    { script: 'lint:frontmatter', optional: false },
    { script: 'lint:eslint:pre-push', optional: false },
    { script: 'test:affected:pre-push', optional: false },
    { script: 'type-check', optional: false },
  ],
};

const ansiEscapePrefix = `${String.fromCharCode(27)}\\[`;
const stripAnsiRegex = new RegExp(`${ansiEscapePrefix}[0-9;]*m`, 'g');
const supportsColor =
  process.stdout.isTTY &&
  process.env.NO_COLOR !== '1' &&
  process.env.NO_COLOR !== 'true' &&
  process.env.TERM !== 'dumb';

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
} as const;

function colorize(text: string, color: keyof typeof colors): string {
  if (!supportsColor) return text;
  return `${colors[color]}${text}${colors.reset}`;
}

function stripAnsi(value: string): string {
  return value.replace(stripAnsiRegex, '');
}

function formatDurationMs(ms: number): string {
  return `${ms.toFixed(1)}ms`;
}

function toMs(value: number, unit: string): number {
  return unit.toLowerCase() === 's' ? value * 1000 : value;
}

function parseLintFrontmatterMetrics(output: string): string[] {
  const countMatch = output.match(/Validating\s+(\d+)\s+backlog frontmatter file\(s\)/i);
  const passed = /All backlog frontmatter files passed schema validation/i.test(output);
  if (countMatch && passed) {
    const count = Number.parseInt(countMatch[1], 10);
    return [`Files: ${count} passed (${count})`];
  }
  return [];
}

function parseLintStagedMetrics(output: string): string[] {
  if (/could not find any staged files/i.test(output)) {
    return ['Files: 0 staged'];
  }
  return [];
}

function parseLintEslintMetrics(output: string): string[] {
  const match = output.match(/Successfully ran target lint for\s+(\d+)\s+projects/i);
  if (match) {
    const count = Number.parseInt(match[1], 10);
    return [`Projects: ${count} passed (${count})`];
  }
  return [];
}

function parseTypecheckMetrics(output: string, exitCode: number): string[] {
  if (exitCode === 0) {
    return ['TypeScript: passed'];
  }

  const errorCount = output.match(/Found\s+(\d+)\s+errors?/i);
  if (errorCount) {
    return [`TypeScript: ${errorCount[1]} errors`];
  }
  return [];
}

interface ProjectMetric {
  name: string;
  durationMs?: number;
  files?: string;
  tests?: string;
  workingDirectory?: string;
  coverage?: CoverageSnapshot;
}

interface CoverageSnapshot {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
}

interface CoverageThresholds {
  statements?: number;
  branches?: number;
  functions?: number;
  lines?: number;
}

const coverageThresholdCache = new Map<string, CoverageThresholds | null>();

function parseAffectedTestMetrics(output: string): string[] {
  const lines = stripAnsi(output)
    .split('\n')
    .map((line) => line.trimEnd());

  const projects: ProjectMetric[] = [];
  let current: ProjectMetric | null = null;

  const flushCurrent = (): void => {
    if (current) {
      projects.push(current);
      current = null;
    }
  };

  for (const line of lines) {
    const runMatch = line.match(/^>\s+nx run\s+([^\s]+)/);
    if (runMatch) {
      flushCurrent();
      current = { name: runMatch[1] };
      continue;
    }

    if (!current) continue;

    const durationMatch = line.match(/^\s*Duration\s+([0-9.]+)(ms|s)\b/i);
    if (durationMatch && current.durationMs === undefined) {
      const durationValue = Number.parseFloat(durationMatch[1]);
      current.durationMs = toMs(durationValue, durationMatch[2]);
      continue;
    }

    const filesMatch = line.match(/^\s*Test Files\s+(.+)$/);
    if (filesMatch && !current.files) {
      current.files = filesMatch[1].trim();
      continue;
    }

    const testsMatch = line.match(/^\s*Tests\s+(.+)$/);
    if (testsMatch && !current.tests) {
      current.tests = testsMatch[1].trim();
      continue;
    }

    const packageScriptMatch = line.match(/^>\s+.+\s+test\s+((?:\/|[A-Za-z]:\\).+)$/);
    if (packageScriptMatch && !current.workingDirectory) {
      current.workingDirectory = packageScriptMatch[1].trim();
      continue;
    }

    const coverageMatch = line.match(
      /^\s*All files\s*\|\s*([0-9.]+)\s*\|\s*([0-9.]+)\s*\|\s*([0-9.]+)\s*\|\s*([0-9.]+)\s*\|/i
    );
    if (coverageMatch && !current.coverage) {
      current.coverage = {
        statements: Number.parseFloat(coverageMatch[1]),
        branches: Number.parseFloat(coverageMatch[2]),
        functions: Number.parseFloat(coverageMatch[3]),
        lines: Number.parseFloat(coverageMatch[4]),
      };
    }
  }

  flushCurrent();

  const metrics: string[] = [];
  for (const project of projects) {
    if (project.durationMs !== undefined) {
      metrics.push(`${project.name} (${formatDurationMs(project.durationMs)})`);
    } else {
      metrics.push(project.name);
    }

    if (project.files || project.tests) {
      const filesPart = `Files: ${project.files ?? 'n/a'}`;
      const testsPart = project.tests ? `    Tests: ${project.tests}` : '';
      metrics.push(`${filesPart}${testsPart}`);
    }

    if (project.coverage) {
      const coverageThresholds = resolveCoverageThresholds(project.workingDirectory);
      const summary = [
        `Stmts ${formatCoverageMetric(project.coverage.statements, coverageThresholds?.statements)}`,
        `Branches ${formatCoverageMetric(project.coverage.branches, coverageThresholds?.branches)}`,
        `Funcs ${formatCoverageMetric(project.coverage.functions, coverageThresholds?.functions)}`,
        `Lines ${formatCoverageMetric(project.coverage.lines, coverageThresholds?.lines)}`,
      ].join('  ');
      metrics.push(`Coverage: ${summary}`);
    }
  }

  return metrics;
}

function normalizeCoverageValue(value: number): string {
  if (!Number.isFinite(value)) return 'n/a';
  return Number.isInteger(value) ? `${value}` : value.toFixed(2);
}

function formatCoverageMetric(actual: number, target?: number): string {
  const actualLabel = `${normalizeCoverageValue(actual)}%`;
  if (typeof target !== 'number' || !Number.isFinite(target)) {
    return `${actualLabel} (n/a)`;
  }

  return `${actualLabel} (${normalizeCoverageValue(target)}%)`;
}

function parseCoverageThresholdsFromText(configText: string): CoverageThresholds {
  const thresholdBlockMatch = configText.match(/thresholds\s*:\s*\{([\s\S]*?)\}/m);
  if (!thresholdBlockMatch) return {};

  const thresholdBlock = thresholdBlockMatch[1];
  const metricValue = (key: keyof CoverageThresholds): number | undefined => {
    const match = thresholdBlock.match(new RegExp(`\\b${key}\\s*:\\s*([0-9.]+)`, 'i'));
    if (!match) return undefined;
    const value = Number.parseFloat(match[1]);
    return Number.isFinite(value) ? value : undefined;
  };

  return {
    statements: metricValue('statements'),
    branches: metricValue('branches'),
    functions: metricValue('functions'),
    lines: metricValue('lines'),
  };
}

function resolveCoverageThresholds(
  workingDirectory: string | undefined
): CoverageThresholds | undefined {
  if (!workingDirectory) return undefined;

  const configPath = path.resolve(workingDirectory, 'vitest.config.ts');
  if (coverageThresholdCache.has(configPath)) {
    const cached = coverageThresholdCache.get(configPath);
    return cached ?? undefined;
  }

  try {
    const configText = readFileSync(configPath, 'utf8');
    const parsed = parseCoverageThresholdsFromText(configText);
    const hasValues = Object.values(parsed).some((value) => typeof value === 'number');
    coverageThresholdCache.set(configPath, hasValues ? parsed : null);
    return hasValues ? parsed : undefined;
  } catch {
    coverageThresholdCache.set(configPath, null);
    return undefined;
  }
}

function parseTaskMetrics(taskScript: string, output: string, exitCode: number): string[] {
  if (taskScript === 'lint:frontmatter') return parseLintFrontmatterMetrics(output);
  if (taskScript === 'lint:staged') return parseLintStagedMetrics(output);
  if (taskScript === 'lint:eslint:pre-push') return parseLintEslintMetrics(output);
  if (taskScript === 'type-check') return parseTypecheckMetrics(output, exitCode);
  if (taskScript.startsWith('test:affected')) return parseAffectedTestMetrics(output);
  return [];
}

function extractErrorLines(output: string): string[] {
  const lines = stripAnsi(output)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const errors: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (
      /watchdog timeout/i.test(line) ||
      /ELIFECYCLE/i.test(line) ||
      /Error:/i.test(line) ||
      /^ERROR[:\s]/i.test(line) ||
      /^FAIL(?:ED)?\b/i.test(line) ||
      /Coverage .* does not meet/i.test(line) ||
      /Command failed with exit code/i.test(line)
    ) {
      errors.push(line);
      continue;
    }

    if (/^Failed tasks:/i.test(line)) {
      errors.push(line);
      for (let j = i + 1; j < lines.length && j <= i + 4; j++) {
        if (lines[j].startsWith('- ')) {
          errors.push(lines[j]);
        }
      }
    }
  }

  const unique = [...new Set(errors)];
  if (unique.length > 0) return unique.slice(0, 5);

  return lines.slice(-3);
}

function isVerbose(argv: string[]): boolean {
  if (argv.includes('--verbose') || argv.includes('-v')) {
    return true;
  }

  const verboseEnv = process.env.HOOKS_VERBOSE ?? process.env.HUSKY_VERBOSE;
  return verboseEnv === '1' || verboseEnv === 'true';
}

function printTaskSummary(task: HookTask, report: TaskReport, verbose: boolean): number {
  const duration = formatDurationMs(report.durationMs);

  if (report.exitCode === 0) {
    console.log(`${colorize('ok', 'green')}   ${task.script} (${duration})`);
    for (const metric of report.metrics.slice(0, 18)) {
      console.log(`       ${colorize(metric, 'dim')}`);
    }
    return 0;
  }

  if (task.optional) {
    console.log(
      `${colorize('warn', 'yellow')} ${task.script} (${duration}) [commit allowed, use --verbose for details]`
    );
    for (const metric of report.metrics.slice(0, 6)) {
      console.log(`       ${colorize(metric, 'dim')}`);
    }
    for (const errorLine of report.errors.slice(0, 5)) {
      console.log(`       ${colorize(errorLine, 'yellow')}`);
    }
    return 0;
  }

  const hint = verbose ? '' : ' [use --verbose for details]';
  console.log(`${colorize('fail', 'red')} ${task.script} (${duration})${hint}`);
  for (const metric of report.metrics.slice(0, 18)) {
    console.log(`       ${colorize(metric, 'dim')}`);
  }
  for (const errorLine of report.errors.slice(0, 5)) {
    console.log(`       ${colorize(errorLine, 'red')}`);
  }
  return report.exitCode;
}

function runTask(task: HookTask, verbose: boolean): number {
  const start = process.hrtime.bigint();
  const result = spawnSync(pnpmCmd, ['run', task.script], {
    shell: false,
    stdio: verbose ? 'inherit' : 'pipe',
    encoding: verbose ? undefined : 'utf8',
    env: process.env,
  });
  const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
  const exitCode = result.status ?? 1;
  const stdout = typeof result.stdout === 'string' ? result.stdout : '';
  const stderr = typeof result.stderr === 'string' ? result.stderr : '';
  const output = `${stdout}\n${stderr}`;

  const report: TaskReport = {
    exitCode,
    durationMs,
    output,
    metrics: verbose ? [] : parseTaskMetrics(task.script, output, exitCode),
    errors: verbose ? [] : extractErrorLines(output),
  };

  return printTaskSummary(task, report, verbose);
}

function main(): number {
  const [hookName, ...rest] = process.argv.slice(2);
  if (hookName !== 'pre-commit' && hookName !== 'pre-push') {
    console.error('Usage: tsx scripts/ci/hook-runner.ts <pre-commit|pre-push> [--verbose]');
    return 1;
  }

  const verbose = isVerbose(rest);
  for (const task of hookTasks[hookName]) {
    const code = runTask(task, verbose);
    if (code !== 0) {
      return code;
    }
  }

  return 0;
}

process.exit(main());
