import { execFileSync } from 'node:child_process';

const RELEASED_ARTIFACT_PREFIXES = ['src/packages/', 'src/extensions/vscode/'] as const;

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

function runGit(args: string[]): string {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function listChangedFiles(base: string, head: string): string[] {
  return runGit(['diff', '--name-only', `${base}...${head}`])
    .split('\n')
    .map((file) => file.trim())
    .filter(Boolean);
}

function isChangesetFile(file: string): boolean {
  return file.startsWith('.changeset/') && file.endsWith('.md');
}

function main(): void {
  const base = readArg('base') ?? process.env.PR_BASE_SHA;
  const head = readArg('head') ?? process.env.PR_HEAD_SHA ?? 'HEAD';
  const headRef = readArg('head-ref') ?? process.env.GITHUB_HEAD_REF ?? '';
  const prTitle = readArg('pr-title') ?? process.env.PR_TITLE ?? '';
  const actor = process.env.GITHUB_ACTOR ?? '';
  const isTrustedAutomationActor = actor === 'github-actions[bot]';
  const isAutomatedVersionPr =
    headRef.startsWith('changeset-release/') || prTitle === 'chore: version packages';

  if (!base) {
    console.log('No PR base SHA provided; skipping Changeset requirement check.');
    return;
  }

  if (isTrustedAutomationActor && isAutomatedVersionPr) {
    console.log('Skipping Changeset requirement for automated version PR.');
    return;
  }

  const changedFiles = listChangedFiles(base, head);
  const releasedArtifactFiles = changedFiles.filter((file) =>
    RELEASED_ARTIFACT_PREFIXES.some((prefix) => file.startsWith(prefix))
  );

  if (releasedArtifactFiles.length === 0) {
    console.log('No released artifact files changed; Changeset not required.');
    return;
  }

  const changesetFiles = changedFiles.filter(isChangesetFile);
  if (changesetFiles.length > 0) {
    console.log(
      `Changeset requirement satisfied by ${changesetFiles.length} file(s): ${changesetFiles.join(', ')}`
    );
    return;
  }

  const formattedFiles = releasedArtifactFiles.map((file) => `- ${file}`).join('\n');
  console.error(
    [
      'PR changes affect released artifacts but no Changeset file was added.',
      '',
      'Changed released-artifact files:',
      formattedFiles,
      '',
      'Add a Changeset with `pnpm changeset` and commit the generated `.changeset/*.md` file.',
      'This policy applies to package and VS Code extension changes so stable releases on `main` remain authoritative.',
    ].join('\n')
  );
  process.exit(1);
}

main();
