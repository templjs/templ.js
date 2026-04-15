import { appendFileSync } from 'node:fs';

import {
  PACKAGE_SCOPE_PATHS,
  VSCODE_SCOPE_PATHS,
  computeStagingPackageVersion,
  computeStagingVscodeVersion,
  getChangedFiles,
  getWorkspaceVersions,
  hasPathPrefix,
} from './lib.ts';

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

function writeGithubOutput(name: string, value: string): void {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (!outputFile) {
    return;
  }

  appendFileSync(outputFile, `${name}=${value}\n`);
}

function main(): void {
  const base = readArg('base');
  const head = readArg('head') ?? 'HEAD';
  const runNumber = Number(readArg('run-number') ?? process.env.GITHUB_RUN_NUMBER ?? '0');
  const runAttempt = Number(readArg('run-attempt') ?? process.env.GITHUB_RUN_ATTEMPT ?? '1');

  if (!base) {
    throw new Error('Missing required --base=<gitRef> argument');
  }

  if (!Number.isInteger(runNumber) || runNumber <= 0) {
    throw new Error(`Invalid staging prerelease run number: ${runNumber}`);
  }

  if (!Number.isInteger(runAttempt) || runAttempt <= 0) {
    throw new Error(`Invalid staging prerelease run attempt: ${runAttempt}`);
  }

  const changedFiles = getChangedFiles(base, head);
  const versions = getWorkspaceVersions();
  const publishPackages = hasPathPrefix(changedFiles, PACKAGE_SCOPE_PATHS);
  const publishVscode = hasPathPrefix(changedFiles, VSCODE_SCOPE_PATHS);
  const packageVersion = computeStagingPackageVersion(runNumber, runAttempt);
  const vscodeVersion = computeStagingVscodeVersion(versions.vscodeVersion, runNumber, runAttempt);

  writeGithubOutput('publish_packages', String(publishPackages));
  writeGithubOutput('publish_vscode', String(publishVscode));
  writeGithubOutput('package_version', packageVersion);
  writeGithubOutput('vscode_version', vscodeVersion);

  console.log(
    JSON.stringify(
      {
        base,
        head,
        changedFiles,
        publishPackages,
        publishVscode,
        packageVersion,
        vscodeVersion,
      },
      null,
      2
    )
  );
}

main();
