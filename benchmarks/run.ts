import { execFileSync } from 'node:child_process';
import os from 'node:os';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import {
  parse,
  QueryEngine,
  render,
  SchemaValidator,
  tokenize,
} from '../src/packages/core/src/index.ts';
import {
  createContextGraph,
  type ContextProvider,
} from '../src/packages/context-graph/src/index.ts';
import { TempljsServicePlugin } from '../src/packages/volar/src/service-plugin.ts';
import schemaLoadingModule from '../src/extensions/vscode/src/schema-loading.ts';
import {
  buildCoreFixtureData,
  contentSchema,
  coreTemplate,
  vscodeWorkspaceFixture,
} from './fixtures.ts';
import {
  type BenchmarkCaseResult,
  type BenchmarkMemorySample,
  type BenchmarkMode,
  type BenchmarkRun,
  computeDistribution,
  DEFAULT_RESULT_OUTPUT,
  formatRunSummaryMarkdown,
  getStringArg,
  parseArgs,
  writeTextFile,
  writeValidatedJson,
} from './shared.ts';

const { loadSchemaSourceSync, resolveDocumentSchemaSources } = schemaLoadingModule;

type MaybePromise<T> = Promise<T> | T;

interface BenchmarkCase<TContext> {
  id: string;
  group: string;
  name: string;
  description: string;
  setup: () => MaybePromise<TContext>;
  run: (context: TContext) => MaybePromise<void>;
  warmupIterations?: Partial<Record<BenchmarkMode, number>>;
  measurementIterations?: Partial<Record<BenchmarkMode, number>>;
}

const DEFAULT_ITERATIONS: Record<BenchmarkMode, { warmup: number; measurement: number }> = {
  full: { warmup: 8, measurement: 24 },
  ci: { warmup: 4, measurement: 12 },
};

const plugin = new TempljsServicePlugin();

const cases: Array<BenchmarkCase<unknown>> = [
  {
    id: 'core.parser.parse',
    group: 'core',
    name: 'Core parser parse',
    description: 'Parses a pre-tokenized, deterministic template fixture.',
    setup: () => ({ tokens: tokenize(coreTemplate) }),
    run: ({ tokens }: { tokens: ReturnType<typeof tokenize> }) => {
      const result = parse(tokens);
      if (result.errors.length > 0 || !result.ast) {
        throw new Error('Expected parser benchmark fixture to parse cleanly');
      }
    },
  },
  {
    id: 'core.renderer.render',
    group: 'core',
    name: 'Core renderer render',
    description: 'Renders a parsed AST with a fixed nested data fixture.',
    setup: () => {
      const parsed = parse(tokenize(coreTemplate));
      if (!parsed.ast || parsed.errors.length > 0) {
        throw new Error('Expected renderer benchmark fixture to parse cleanly');
      }
      return { ast: parsed.ast, data: buildCoreFixtureData() };
    },
    run: ({ ast, data }: { ast: NonNullable<ReturnType<typeof parse>['ast']>; data: unknown }) => {
      const result = render(ast, data);
      if (!result.success) {
        throw new Error('Expected renderer benchmark fixture to render cleanly');
      }
    },
  },
  {
    id: 'core.query-engine.filter-chain',
    group: 'core',
    name: 'Core query-engine filter chain',
    description: 'Resolves nested paths and applies representative filters.',
    setup: () => ({ engine: new QueryEngine(), data: buildCoreFixtureData() }),
    run: ({
      engine,
      data,
    }: {
      engine: QueryEngine;
      data: ReturnType<typeof buildCoreFixtureData>;
    }) => {
      const name = engine.query(data, 'projects[5].tasks[6].assignee.name');
      const upperName = engine.applyFilter(name, 'upper', []);
      const points = engine.query(data, 'projects[5].tasks[6].points');
      const roundedPoints = engine.applyFilter(points, 'round', [1]);

      if (typeof upperName !== 'string' || typeof roundedPoints !== 'number') {
        throw new Error('Expected query-engine benchmark fixture to resolve values');
      }
    },
  },
  {
    id: 'core.schema-analysis',
    group: 'core',
    name: 'Core schema analysis',
    description: 'Builds schema metadata and validates representative query paths.',
    setup: () => ({ schema: contentSchema }),
    run: ({ schema }: { schema: typeof contentSchema }) => {
      const validator = new SchemaValidator(schema);
      validator.getMetadata();
      validator.validateQueryPath('projects[0].tasks[0].assignee.name');
      validator.validateQueryPath('projects[0].tasks[0].status');
      validator.validateQueryPath('summary.totalPoints');
    },
  },
  {
    id: 'volar.diagnostics.document',
    group: 'ide',
    name: 'Volar diagnostics',
    description: 'Collects diagnostics for a schema-backed markdown template document.',
    setup: () => ({
      text: vscodeWorkspaceFixture.diagnosticsText,
      options: {
        documentUri: vscodeWorkspaceFixture.documentUri,
        schema: vscodeWorkspaceFixture.loadedFrontmatterSchema,
        contentSchema: vscodeWorkspaceFixture.loadedContentSchema,
        frontmatterRange: vscodeWorkspaceFixture.frontmatterRange,
      },
    }),
    run: ({
      text,
      options,
    }: {
      text: string;
      options: Parameters<TempljsServicePlugin['collectDiagnostics']>[1];
    }) => {
      const diagnostics = plugin.collectDiagnostics(text, options);
      if (diagnostics.length === 0) {
        throw new Error('Expected diagnostics benchmark fixture to emit diagnostics');
      }
    },
  },
  {
    id: 'volar.completions.alias-scope',
    group: 'ide',
    name: 'Volar completions',
    description: 'Computes completions inside a loop-scoped expression with schema data.',
    setup: () => ({
      text: vscodeWorkspaceFixture.documentText,
      offset: vscodeWorkspaceFixture.completionOffset,
      options: {
        documentUri: vscodeWorkspaceFixture.documentUri,
        schema: vscodeWorkspaceFixture.loadedFrontmatterSchema,
        contentSchema: vscodeWorkspaceFixture.loadedContentSchema,
        frontmatterRange: vscodeWorkspaceFixture.frontmatterRange,
      },
    }),
    run: ({
      text,
      offset,
      options,
    }: {
      text: string;
      offset: number;
      options: Parameters<TempljsServicePlugin['getCompletions']>[2];
    }) => {
      const completions = plugin.getCompletions(text, offset, options);
      if (!completions.some((value) => value.label === 'id')) {
        throw new Error('Expected completion benchmark fixture to include task properties');
      }
    },
  },
  {
    id: 'vscode.schema-loading.document-context',
    group: 'ide',
    name: 'VS Code schema loading',
    description:
      'Resolves document-scoped schema sources and loads frontmatter/content schemas synchronously.',
    setup: () => vscodeWorkspaceFixture,
    run: (context: typeof vscodeWorkspaceFixture) => {
      const params = {
        rootUri: pathToFileURL(context.workspaceRoot).toString(),
        initializationOptions: context.initializationOptions,
      };
      const resolved = resolveDocumentSchemaSources(params);
      const loadedFrontmatter = resolved.schemaPath
        ? loadSchemaSourceSync(resolved.schemaPath, context.workspaceRoot, context.documentUri, {
            cache: new Map<string, unknown>(),
          })
        : {};
      const loadedContent = resolved.contentSchemaPath
        ? loadSchemaSourceSync(
            resolved.contentSchemaPath,
            context.workspaceRoot,
            context.documentUri,
            {
              cache: new Map<string, unknown>(),
            }
          )
        : {};

      if (!loadedFrontmatter.schema || !loadedContent.schema) {
        throw new Error('Expected VS Code schema benchmark fixture to resolve both schemas');
      }
    },
  },
  {
    id: 'context-graph.query.filtered',
    group: 'context-graph',
    name: 'Context graph filtered query',
    description: 'Runs representative node and edge filters against a seeded context graph.',
    setup: async () => {
      const graph = createContextGraph();
      const providers: ContextProvider[] = Array.from({ length: 4 }, (_, providerIndex) => ({
        id: `provider-${providerIndex + 1}`,
        onInvalidate: (_uri, ctx) => {
          for (let nodeIndex = 0; nodeIndex < 180; nodeIndex += 1) {
            const nodeId = `provider-${providerIndex + 1}-node-${nodeIndex + 1}`;
            ctx.upsertNode({
              id: nodeId,
              profileId: nodeIndex % 2 === 0 ? 'runtime' : 'editor-location',
              kind: nodeIndex % 3 === 0 ? 'task' : 'symbol',
              attributes: {
                status: nodeIndex % 3 === 0 ? 'doing' : 'done',
                lane: providerIndex % 2 === 0 ? 'core' : 'ide',
              },
            });

            if (nodeIndex > 0) {
              ctx.upsertEdge({
                id: `provider-${providerIndex + 1}-edge-${nodeIndex + 1}`,
                profileId: nodeIndex % 2 === 0 ? 'runtime' : 'editor-location',
                from: `provider-${providerIndex + 1}-node-${nodeIndex}`,
                to: nodeId,
                kind: nodeIndex % 2 === 0 ? 'depends-on' : 'references',
                attributes: {
                  weight: nodeIndex % 5,
                },
              });
            }
          }
        },
      }));

      for (const provider of providers) {
        graph.use(provider);
      }

      await graph.invalidate('file:///bench/context-graph.md.templ');
      return { graph };
    },
    run: ({ graph }: { graph: ReturnType<typeof createContextGraph> }) => {
      const nodeQuery = graph.query({
        version: 'v1',
        nodes: {
          kind: 'task',
          profileIds: ['runtime'],
          attributeEquals: { status: 'doing' },
        },
      });
      const edgeQuery = graph.query({
        version: 'v1',
        edges: {
          kind: 'depends-on',
          from: 'provider-2-node-78',
        },
      });

      if (nodeQuery.nodes.length === 0 || edgeQuery.edges.length === 0) {
        throw new Error('Expected context-graph benchmark fixture to return filtered results');
      }
    },
  },
];

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const mode = (getStringArg(args, 'mode', 'full') ?? 'full') as BenchmarkMode;
  if (mode !== 'full' && mode !== 'ci') {
    throw new Error(`Unsupported benchmark mode '${mode}'`);
  }

  const outputPath = getStringArg(args, 'output', DEFAULT_RESULT_OUTPUT) ?? DEFAULT_RESULT_OUTPUT;
  const label = getStringArg(args, 'label', mode) ?? mode;
  const summaryOutputPath = getStringArg(args, 'summary-output');

  const caseResults: BenchmarkCaseResult[] = [];
  for (const benchmarkCase of cases) {
    const context = await benchmarkCase.setup();
    const warmupIterations =
      benchmarkCase.warmupIterations?.[mode] ?? DEFAULT_ITERATIONS[mode].warmup;
    const measurementIterations =
      benchmarkCase.measurementIterations?.[mode] ?? DEFAULT_ITERATIONS[mode].measurement;

    for (let index = 0; index < warmupIterations; index += 1) {
      await benchmarkCase.run(context);
    }

    const samplesMs: number[] = [];
    for (let index = 0; index < measurementIterations; index += 1) {
      const startedAt = performance.now();
      await benchmarkCase.run(context);
      samplesMs.push(performance.now() - startedAt);
    }

    const memory = await measureMemory(benchmarkCase, context);
    caseResults.push({
      id: benchmarkCase.id,
      group: benchmarkCase.group,
      name: benchmarkCase.name,
      description: benchmarkCase.description,
      warmupIterations,
      measurementIterations,
      samplesMs,
      metrics: computeDistribution(samplesMs),
      memory,
    });
  }

  const run = buildRun(mode, label, caseResults);
  writeValidatedJson(outputPath, run);

  const markdown = formatRunSummaryMarkdown(run);
  if (summaryOutputPath) {
    writeTextFile(summaryOutputPath, markdown);
  }

  console.log(markdown);
  console.log(`\nWrote benchmark results to ${outputPath}`);
}

async function measureMemory<TContext>(
  benchmarkCase: BenchmarkCase<TContext>,
  context: TContext
): Promise<BenchmarkMemorySample> {
  const gc = (globalThis as typeof globalThis & { gc?: () => void }).gc;
  gc?.();
  const before = process.memoryUsage();
  await benchmarkCase.run(context);
  gc?.();
  const after = process.memoryUsage();

  return {
    gcAvailable: typeof gc === 'function',
    rssBeforeBytes: before.rss,
    rssAfterBytes: after.rss,
    rssDeltaBytes: after.rss - before.rss,
    heapUsedBeforeBytes: before.heapUsed,
    heapUsedAfterBytes: after.heapUsed,
    heapUsedDeltaBytes: after.heapUsed - before.heapUsed,
  };
}

function buildRun(
  mode: BenchmarkMode,
  label: string,
  casesForRun: BenchmarkCaseResult[]
): BenchmarkRun {
  const branch = tryGit(['rev-parse', '--abbrev-ref', 'HEAD']);
  const sha = tryGit(['rev-parse', 'HEAD']);
  const cpu = os.cpus();

  return {
    schemaVersion: 'benchmark-results.v1',
    generatedAt: new Date().toISOString(),
    suite: 'templjs',
    mode,
    label,
    git: {
      branch,
      sha,
    },
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cpuModel: cpu[0]?.model ?? 'unknown',
      cpuCount: cpu.length,
      ci: process.env.CI === 'true' || process.env.CI === '1',
    },
    settings: {
      defaultWarmupIterations: DEFAULT_ITERATIONS[mode].warmup,
      defaultMeasurementIterations: DEFAULT_ITERATIONS[mode].measurement,
      advisoryMemory: true,
      gcAvailable: typeof (globalThis as typeof globalThis & { gc?: () => void }).gc === 'function',
    },
    cases: casesForRun,
    totals: {
      caseCount: casesForRun.length,
      totalMeasuredIterations: casesForRun.reduce(
        (sum, value) => sum + value.measurementIterations,
        0
      ),
    },
  };
}

function tryGit(args: string[]): string | null {
  try {
    return execFileSync('git', args, {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf-8',
    }).trim();
  } catch {
    return null;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
