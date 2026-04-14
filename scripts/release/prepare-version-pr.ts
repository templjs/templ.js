import { execFileSync } from 'node:child_process';

import { getWorkspaceVersions } from './lib.ts';

function main(): void {
  const before = getWorkspaceVersions();

  execFileSync('pnpm', ['changeset', 'version'], {
    stdio: 'inherit',
  });

  const after = getWorkspaceVersions();

  if (before.vscodeVersion !== after.vscodeVersion) {
    execFileSync('pnpm', ['exec', 'tsx', 'scripts/release/sync-vscode-changelog.ts'], {
      stdio: 'inherit',
    });
  } else {
    console.log(
      `vscode-templjs version unchanged (${after.vscodeVersion}); skipping changelog regeneration`
    );
  }
}

main();
