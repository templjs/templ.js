import {
  compareBenchmarkRuns,
  formatComparisonMarkdown,
  getStringArg,
  loadThresholdPolicy,
  parseArgs,
  POLICY_PATH,
  readValidatedBenchmarkRun,
  writeTextFile,
  writeValidatedJson,
} from './shared.ts';

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const baselinePath = getStringArg(args, 'baseline') ?? args.positionals[0];
  const candidatePath = getStringArg(args, 'candidate') ?? args.positionals[1];

  if (!baselinePath || !candidatePath) {
    throw new Error(
      'Usage: tsx benchmarks/compare.ts --baseline <baseline.json> --candidate <candidate.json>'
    );
  }

  const outputPath = getStringArg(args, 'output');
  const markdownPath = getStringArg(args, 'markdown');
  const policyPath = getStringArg(args, 'policy', POLICY_PATH);

  const baseline = readValidatedBenchmarkRun(baselinePath);
  const candidate = readValidatedBenchmarkRun(candidatePath);
  const comparison = compareBenchmarkRuns(baseline, candidate, loadThresholdPolicy(policyPath));
  const markdown = formatComparisonMarkdown(comparison);

  if (outputPath) {
    writeValidatedJson(outputPath, comparison);
  }
  if (markdownPath) {
    writeTextFile(markdownPath, markdown);
  }

  console.log(markdown);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
