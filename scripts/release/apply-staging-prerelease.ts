import { execFileSync } from 'node:child_process';

import { setPackageVersions, setVscodeVersion } from './lib.ts';

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

function main(): void {
  const packageVersion = readArg('package-version');
  const vscodeVersion = readArg('vscode-version');
  const refreshVscodeChangelog = readArg('refresh-vscode-changelog') !== 'false';

  if (!packageVersion && !vscodeVersion) {
    throw new Error(
      'Nothing to apply. Provide --package-version=<version> and/or --vscode-version=<version>.'
    );
  }

  if (packageVersion) {
    setPackageVersions(packageVersion);
    console.log(`Applied staging package version ${packageVersion}`);
  }

  if (vscodeVersion) {
    setVscodeVersion(vscodeVersion);
    console.log(`Applied staging VS Code version ${vscodeVersion}`);

    if (refreshVscodeChangelog) {
      execFileSync(
        'pnpm',
        ['exec', 'tsx', 'scripts/release/sync-vscode-changelog.ts', `--version=${vscodeVersion}`],
        {
          stdio: 'inherit',
        }
      );
    }
  }
}

main();
