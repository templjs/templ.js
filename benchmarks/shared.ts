import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

export type BenchmarkMode = 'full' | 'ci';
export type BenchmarkClassification = 'regression' | 'improvement' | 'neutral' | 'new' | 'missing';

export interface BenchmarkMemorySample {
  gcAvailable: boolean;
  rssBeforeBytes: number;
  rssAfterBytes: number;
  rssDeltaBytes: number;
  heapUsedBeforeBytes: number;
  heapUsedAfterBytes: number;
  heapUsedDeltaBytes: number;
}

export interface BenchmarkDistribution {
  minMs: number;
  maxMs: number;
  meanMs: number;
  medianMs: number;
  p95Ms: number;
  stdDevMs: number;
  opsPerSecond: number;
}

export interface BenchmarkCaseResult {
  id: string;
  group: string;
  name: string;
  description: string;
  warmupIterations: number;
  measurementIterations: number;
  samplesMs: number[];
  metrics: BenchmarkDistribution;
  memory: BenchmarkMemorySample;
}

export interface BenchmarkRun {
  schemaVersion: 'benchmark-results.v1';
  generatedAt: string;
  suite: 'templjs';
  mode: BenchmarkMode;
  label: string;
  git: {
    branch: string | null;
    sha: string | null;
  };
  environment: {
    nodeVersion: string;
    platform: string;
    arch: string;
    cpuModel: string;
    cpuCount: number;
    ci: boolean;
  };
  settings: {
    defaultWarmupIterations: number;
    defaultMeasurementIterations: number;
    advisoryMemory: true;
    gcAvailable: boolean;
  };
  cases: BenchmarkCaseResult[];
  totals: {
    caseCount: number;
    totalMeasuredIterations: number;
  };
}

export interface ThresholdPolicy {
  schemaVersion: 'benchmark-policy.v1';
  enforce: boolean;
  latency: {
    warnPercent: number;
    failPercent: number;
    minAbsoluteDeltaMs: number;
  };
  memory: {
    warnHeapDeltaBytes: number;
    failHeapDeltaBytes: number;
    warnRssDeltaBytes: number;
    failRssDeltaBytes: number;
  };
}

export interface BenchmarkComparisonCase {
  id: string;
  group: string;
  name: string;
  classification: BenchmarkClassification;
  baselineMeanMs: number | null;
  candidateMeanMs: number | null;
  deltaMs: number | null;
  deltaPercent: number | null;
  heapDeltaBytes: number | null;
  rssDeltaBytes: number | null;
  exceedsWarningThreshold: boolean;
  exceedsFailureThreshold: boolean;
  advisoryMemoryWarning: boolean;
  advisoryMemoryFailure: boolean;
}

export interface BenchmarkComparison {
  schemaVersion: 'benchmark-comparison.v1';
  generatedAt: string;
  policy: ThresholdPolicy;
  baseline: {
    label: string;
    mode: BenchmarkMode;
    branch: string | null;
    sha: string | null;
  };
  candidate: {
    label: string;
    mode: BenchmarkMode;
    branch: string | null;
    sha: string | null;
  };
  summary: {
    regressionCount: number;
    improvementCount: number;
    neutralCount: number;
    newCount: number;
    missingCount: number;
    shouldFailIfEnforced: boolean;
  };
  cases: BenchmarkComparisonCase[];
}

export interface ParsedArgs {
  positionals: string[];
  values: Record<string, string | boolean>;
}

const BENCHMARKS_DIR = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(BENCHMARKS_DIR, '..');
export const ARTIFACTS_DIR = join(REPO_ROOT, 'artifacts', 'benchmarks');
export const DEFAULT_RESULT_OUTPUT = join(ARTIFACTS_DIR, 'benchmark-results.json');
export const DEFAULT_SUMMARY_OUTPUT = join(ARTIFACTS_DIR, 'benchmark-summary.md');
export const DEFAULT_COMPARISON_OUTPUT = join(ARTIFACTS_DIR, 'benchmark-comparison.json');
export const DEFAULT_COMPARISON_MARKDOWN_OUTPUT = join(ARTIFACTS_DIR, 'benchmark-comparison.md');
export const RESULT_SCHEMA_PATH = join(REPO_ROOT, 'schemas', 'benchmark-results.schema.json');
export const COMPARISON_SCHEMA_PATH = join(
  REPO_ROOT,
  'schemas',
  'benchmark-comparison.schema.json'
);
export const POLICY_PATH = join(REPO_ROOT, 'benchmarks', 'policy.json');

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

function loadValidator(schemaPath: string) {
  const schema = JSON.parse(readFileSync(schemaPath, 'utf-8')) as object;
  const validator = ajv.compile(schema);
  return validator;
}

const resultValidator = loadValidator(RESULT_SCHEMA_PATH);
const comparisonValidator = loadValidator(COMPARISON_SCHEMA_PATH);

export function ensureDirectory(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
}

export function parseArgs(argv: string[]): ParsedArgs {
  const values: Record<string, string | boolean> = {};
  const positionals: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith('--')) {
      positionals.push(current);
      continue;
    }

    const key = current.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      values[key] = true;
      continue;
    }

    values[key] = next;
    index += 1;
  }

  return { positionals, values };
}

export function getStringArg(args: ParsedArgs, key: string, fallback?: string): string | undefined {
  const value = args.values[key];
  if (typeof value === 'string') {
    return value;
  }
  return fallback;
}

export function getBooleanArg(args: ParsedArgs, key: string, fallback = false): boolean {
  const value = args.values[key];
  if (typeof value === 'boolean') {
    return value;
  }
  return fallback;
}

export function writeTextFile(filePath: string, content: string): void {
  ensureDirectory(filePath);
  writeFileSync(filePath, content, 'utf-8');
}

export function writeValidatedJson(
  filePath: string,
  value: BenchmarkRun | BenchmarkComparison
): void {
  if (isBenchmarkRun(value)) {
    validateBenchmarkRun(value);
  } else {
    validateBenchmarkComparison(value);
  }

  ensureDirectory(filePath);
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
}

export function readValidatedBenchmarkRun(filePath: string): BenchmarkRun {
  const value = JSON.parse(readFileSync(filePath, 'utf-8')) as unknown;
  return validateBenchmarkRun(value);
}

export function readValidatedBenchmarkComparison(filePath: string): BenchmarkComparison {
  const value = JSON.parse(readFileSync(filePath, 'utf-8')) as unknown;
  return validateBenchmarkComparison(value);
}

export function loadThresholdPolicy(filePath = POLICY_PATH): ThresholdPolicy {
  return JSON.parse(readFileSync(filePath, 'utf-8')) as ThresholdPolicy;
}

export function validateBenchmarkRun(value: unknown): BenchmarkRun {
  if (!resultValidator(value)) {
    throw new Error(ajv.errorsText(resultValidator.errors, { separator: '\n' }));
  }
  return value as BenchmarkRun;
}

export function validateBenchmarkComparison(value: unknown): BenchmarkComparison {
  if (!comparisonValidator(value)) {
    throw new Error(ajv.errorsText(comparisonValidator.errors, { separator: '\n' }));
  }
  return value as BenchmarkComparison;
}

export function computeDistribution(samplesMs: number[]): BenchmarkDistribution {
  if (samplesMs.length === 0) {
    throw new Error('Expected at least one benchmark sample');
  }

  const sorted = [...samplesMs].sort((left, right) => left - right);
  const total = samplesMs.reduce((sum, value) => sum + value, 0);
  const meanMs = total / samplesMs.length;
  const variance =
    samplesMs.reduce((sum, value) => sum + (value - meanMs) ** 2, 0) / samplesMs.length;
  const stdDevMs = Math.sqrt(variance);
  const medianMs = percentile(sorted, 0.5);
  const p95Ms = percentile(sorted, 0.95);
  const minMs = sorted[0];
  const maxMs = sorted[sorted.length - 1];

  return {
    minMs,
    maxMs,
    meanMs,
    medianMs,
    p95Ms,
    stdDevMs,
    opsPerSecond: meanMs === 0 ? 0 : 1000 / meanMs,
  };
}

function percentile(sortedSamples: number[], target: number): number {
  const index = Math.max(0, Math.ceil(sortedSamples.length * target) - 1);
  return sortedSamples[index];
}

export function formatDuration(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return 'n/a';
  }
  return `${value.toFixed(3)} ms`;
}

export function formatDeltaPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return 'n/a';
  }
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(1)}%`;
}

export function formatBytes(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return 'n/a';
  }

  const prefix = value > 0 ? '+' : '';
  const absolute = Math.abs(value);
  if (absolute >= 1024 * 1024) {
    return `${prefix}${(value / (1024 * 1024)).toFixed(2)} MiB`;
  }
  if (absolute >= 1024) {
    return `${prefix}${(value / 1024).toFixed(1)} KiB`;
  }
  return `${prefix}${value} B`;
}

export function compareBenchmarkRuns(
  baseline: BenchmarkRun,
  candidate: BenchmarkRun,
  policy: ThresholdPolicy
): BenchmarkComparison {
  const baselineCases = new Map(baseline.cases.map((value) => [value.id, value]));
  const candidateCases = new Map(candidate.cases.map((value) => [value.id, value]));
  const ids = Array.from(new Set([...baselineCases.keys(), ...candidateCases.keys()])).sort();

  const cases = ids.map((id) => {
    const baselineCase = baselineCases.get(id);
    const candidateCase = candidateCases.get(id);

    if (!baselineCase && candidateCase) {
      return {
        id,
        group: candidateCase.group,
        name: candidateCase.name,
        classification: 'new' as const,
        baselineMeanMs: null,
        candidateMeanMs: candidateCase.metrics.meanMs,
        deltaMs: null,
        deltaPercent: null,
        heapDeltaBytes: null,
        rssDeltaBytes: null,
        exceedsWarningThreshold: false,
        exceedsFailureThreshold: false,
        advisoryMemoryWarning: false,
        advisoryMemoryFailure: false,
      };
    }

    if (baselineCase && !candidateCase) {
      return {
        id,
        group: baselineCase.group,
        name: baselineCase.name,
        classification: 'missing' as const,
        baselineMeanMs: baselineCase.metrics.meanMs,
        candidateMeanMs: null,
        deltaMs: null,
        deltaPercent: null,
        heapDeltaBytes: null,
        rssDeltaBytes: null,
        exceedsWarningThreshold: false,
        exceedsFailureThreshold: false,
        advisoryMemoryWarning: false,
        advisoryMemoryFailure: false,
      };
    }

    const sharedBaseline = baselineCase as BenchmarkCaseResult;
    const sharedCandidate = candidateCase as BenchmarkCaseResult;
    const deltaMs = sharedCandidate.metrics.meanMs - sharedBaseline.metrics.meanMs;
    const deltaPercent =
      sharedBaseline.metrics.meanMs === 0 ? 0 : (deltaMs / sharedBaseline.metrics.meanMs) * 100;
    const meaningfulLatency = Math.abs(deltaMs) >= policy.latency.minAbsoluteDeltaMs;
    const exceedsWarningThreshold = meaningfulLatency && deltaPercent >= policy.latency.warnPercent;
    const exceedsFailureThreshold = meaningfulLatency && deltaPercent >= policy.latency.failPercent;
    const classification: BenchmarkClassification =
      meaningfulLatency && deltaPercent <= -policy.latency.warnPercent
        ? 'improvement'
        : exceedsWarningThreshold
          ? 'regression'
          : 'neutral';

    const heapDeltaBytes =
      sharedCandidate.memory.heapUsedDeltaBytes - sharedBaseline.memory.heapUsedDeltaBytes;
    const rssDeltaBytes =
      sharedCandidate.memory.rssDeltaBytes - sharedBaseline.memory.rssDeltaBytes;
    const advisoryMemoryWarning =
      heapDeltaBytes >= policy.memory.warnHeapDeltaBytes ||
      rssDeltaBytes >= policy.memory.warnRssDeltaBytes;
    const advisoryMemoryFailure =
      heapDeltaBytes >= policy.memory.failHeapDeltaBytes ||
      rssDeltaBytes >= policy.memory.failRssDeltaBytes;

    return {
      id,
      group: sharedCandidate.group,
      name: sharedCandidate.name,
      classification,
      baselineMeanMs: sharedBaseline.metrics.meanMs,
      candidateMeanMs: sharedCandidate.metrics.meanMs,
      deltaMs,
      deltaPercent,
      heapDeltaBytes,
      rssDeltaBytes,
      exceedsWarningThreshold,
      exceedsFailureThreshold,
      advisoryMemoryWarning,
      advisoryMemoryFailure,
    };
  });

  const regressionCount = cases.filter((value) => value.classification === 'regression').length;
  const improvementCount = cases.filter((value) => value.classification === 'improvement').length;
  const neutralCount = cases.filter((value) => value.classification === 'neutral').length;
  const newCount = cases.filter((value) => value.classification === 'new').length;
  const missingCount = cases.filter((value) => value.classification === 'missing').length;
  const shouldFailIfEnforced =
    policy.enforce &&
    cases.some((value) => value.exceedsFailureThreshold || value.advisoryMemoryFailure);

  return validateBenchmarkComparison({
    schemaVersion: 'benchmark-comparison.v1',
    generatedAt: new Date().toISOString(),
    policy,
    baseline: {
      label: baseline.label,
      mode: baseline.mode,
      branch: baseline.git.branch,
      sha: baseline.git.sha,
    },
    candidate: {
      label: candidate.label,
      mode: candidate.mode,
      branch: candidate.git.branch,
      sha: candidate.git.sha,
    },
    summary: {
      regressionCount,
      improvementCount,
      neutralCount,
      newCount,
      missingCount,
      shouldFailIfEnforced,
    },
    cases,
  });
}

export function formatRunSummaryMarkdown(run: BenchmarkRun): string {
  const header = [
    '# Benchmark Summary',
    '',
    `- Label: \`${run.label}\``,
    `- Mode: \`${run.mode}\``,
    `- Git: \`${run.git.branch ?? 'detached'}\` @ \`${run.git.sha ?? 'unknown'}\``,
    `- Environment: Node ${run.environment.nodeVersion} on ${run.environment.platform}/${run.environment.arch}`,
    `- Cases: ${run.totals.caseCount}`,
    '',
    '| Case | Mean | P95 | Ops/s | Heap delta |',
    '| --- | ---: | ---: | ---: | ---: |',
  ];

  const rows = [...run.cases]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(
      (value) =>
        `| \`${value.id}\` | ${formatDuration(value.metrics.meanMs)} | ${formatDuration(value.metrics.p95Ms)} | ${value.metrics.opsPerSecond.toFixed(1)} | ${formatBytes(value.memory.heapUsedDeltaBytes)} |`
    );

  return [...header, ...rows].join('\n');
}

export function formatComparisonMarkdown(comparison: BenchmarkComparison): string {
  const intro = [
    '# Benchmark Comparison',
    '',
    `- Baseline: \`${comparison.baseline.label}\` (${comparison.baseline.branch ?? 'detached'} @ ${comparison.baseline.sha ?? 'unknown'})`,
    `- Candidate: \`${comparison.candidate.label}\` (${comparison.candidate.branch ?? 'detached'} @ ${comparison.candidate.sha ?? 'unknown'})`,
    `- Policy: ${comparison.policy.enforce ? 'enforced' : 'informational only'}`,
    '',
    `Regressions: ${comparison.summary.regressionCount}, improvements: ${comparison.summary.improvementCount}, new: ${comparison.summary.newCount}, missing: ${comparison.summary.missingCount}.`,
    '',
  ];

  const importantRows = comparison.cases
    .filter((value) => value.classification !== 'neutral')
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(
      (value) =>
        `| \`${value.id}\` | ${value.classification} | ${formatDuration(value.baselineMeanMs)} | ${formatDuration(value.candidateMeanMs)} | ${formatDeltaPercent(value.deltaPercent)} | ${formatBytes(value.heapDeltaBytes)} |`
    );

  const fallbackRows =
    importantRows.length > 0 ? importantRows : ['| _none_ | neutral | n/a | n/a | n/a | n/a |'];

  return [
    ...intro,
    '| Case | Classification | Baseline | Candidate | Delta | Heap delta |',
    '| --- | --- | ---: | ---: | ---: | ---: |',
    ...fallbackRows,
  ].join('\n');
}

function isBenchmarkRun(value: BenchmarkRun | BenchmarkComparison): value is BenchmarkRun {
  return value.schemaVersion === 'benchmark-results.v1';
}
