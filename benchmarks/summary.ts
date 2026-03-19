import {
  DEFAULT_RESULT_OUTPUT,
  formatRunSummaryMarkdown,
  getStringArg,
  parseArgs,
  readValidatedBenchmarkRun,
  writeTextFile,
} from './shared.ts';

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const inputPath =
    getStringArg(args, 'input') ?? args.positionals[0] ?? DEFAULT_RESULT_OUTPUT;
  const outputPath = getStringArg(args, 'output');

  const run = readValidatedBenchmarkRun(inputPath);
  const markdown = formatRunSummaryMarkdown(run);

  if (outputPath) {
    writeTextFile(outputPath, markdown);
  }

  console.log(markdown);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
