import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import yaml from 'yaml';

const RELEASED_ARTIFACT_PREFIXES = ['src/packages/', 'src/extensions/vscode/'] as const;
const PACKAGE_SCOPES = ['core', 'cli', 'volar', 'context-graph'] as const;
const RELEASE_TYPES = ['feat', 'fix', 'perf', 'refactor', 'docs', 'chore'] as const;
const RELEASE_SCOPES = [
  'core',
  'cli',
  'volar',
  'context-graph',
  'vscode',
  'docs',
  'infra',
] as const;
const CHANGELOG_TARGETS = ['root', 'vscode', 'none'] as const;

type ReleaseType = (typeof RELEASE_TYPES)[number];
type ReleaseScope = (typeof RELEASE_SCOPES)[number];
type ChangelogTarget = (typeof CHANGELOG_TARGETS)[number];

type PullRequestEvent = {
  pull_request?: {
    title?: string;
    body?: string | null;
    base?: { sha?: string };
    head?: { sha?: string; ref?: string };
  };
};

type ReleaseNoteMetadata = {
  release_note?: {
    type?: ReleaseType;
    scope?: ReleaseScope[];
    summary?: string;
    changelog?: ChangelogTarget[];
    breaking?: boolean;
  };
};

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

function parseReleaseMetadata(prBody: string): ReleaseNoteMetadata['release_note'] {
  const blockMatches = [...prBody.matchAll(/```ya?ml\n([\s\S]*?)```/gi)];

  for (const blockMatch of blockMatches) {
    const raw = blockMatch[1]?.trim();
    if (!raw || !raw.includes('release_note:')) {
      continue;
    }
    const parsed = yaml.parse(raw) as ReleaseNoteMetadata;
    return parsed.release_note;
  }

  return undefined;
}

function validateMetadata(metadata: ReleaseNoteMetadata['release_note']): string[] {
  const errors: string[] = [];

  if (!metadata) {
    return [
      'Missing `release_note` YAML block in PR body.',
      'Use `.github/pull_request_template.md` and complete the `Release Metadata` block.',
    ];
  }

  if (!metadata.type || !RELEASE_TYPES.includes(metadata.type)) {
    errors.push(`release_note.type must be one of: ${RELEASE_TYPES.join(', ')}`);
  }

  if (!Array.isArray(metadata.scope) || metadata.scope.length === 0) {
    errors.push('release_note.scope must be a non-empty array.');
  } else {
    const invalidScopes = metadata.scope.filter((scope) => !RELEASE_SCOPES.includes(scope));
    if (invalidScopes.length > 0) {
      errors.push(`release_note.scope contains unsupported values: ${invalidScopes.join(', ')}`);
    }
  }

  if (typeof metadata.summary !== 'string' || metadata.summary.trim().length < 12) {
    errors.push('release_note.summary must be at least 12 characters.');
  }

  if (!Array.isArray(metadata.changelog) || metadata.changelog.length === 0) {
    errors.push('release_note.changelog must be a non-empty array.');
  } else {
    const invalidTargets = metadata.changelog.filter(
      (target) => !CHANGELOG_TARGETS.includes(target)
    );
    if (invalidTargets.length > 0) {
      errors.push(
        `release_note.changelog contains unsupported values: ${invalidTargets.join(', ')}`
      );
    }
  }

  if (typeof metadata.breaking !== 'boolean') {
    errors.push('release_note.breaking must be a boolean (`true` or `false`).');
  }

  if (errors.length > 0) {
    return errors;
  }

  const scopes = metadata.scope as ReleaseScope[];
  const changelogTargets = metadata.changelog as ChangelogTarget[];
  const touchesPackages = scopes.some((scope) =>
    PACKAGE_SCOPES.includes(scope as (typeof PACKAGE_SCOPES)[number])
  );
  const touchesVscode = scopes.includes('vscode');

  if (touchesPackages && !changelogTargets.includes('root')) {
    errors.push('release_note.changelog must include `root` when package scopes are listed.');
  }

  if (touchesVscode && !changelogTargets.includes('vscode')) {
    errors.push('release_note.changelog must include `vscode` when `vscode` scope is listed.');
  }

  return errors;
}

function main(): void {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    console.log('GITHUB_EVENT_PATH is not available; skipping release-note guard.');
    return;
  }

  const event = JSON.parse(readFileSync(eventPath, 'utf8')) as PullRequestEvent;
  const pullRequest = event.pull_request;
  if (!pullRequest) {
    console.log('Not a pull_request event; skipping release-note guard.');
    return;
  }

  const base = pullRequest.base?.sha;
  const head = pullRequest.head?.sha;
  const headRef = pullRequest.head?.ref ?? '';
  const title = pullRequest.title ?? '';
  const actor = process.env.GITHUB_ACTOR ?? '';
  const isTrustedAutomationActor = actor === 'github-actions[bot]';
  const isAutomatedVersionPr =
    headRef.startsWith('changeset-release/') || title === 'chore: version packages';

  if (!base || !head) {
    console.log('Missing PR base/head SHA; skipping release-note guard.');
    return;
  }

  if (isTrustedAutomationActor && isAutomatedVersionPr) {
    console.log('Skipping release-note guard for automated version PR.');
    return;
  }

  const changedFiles = listChangedFiles(base, head);
  const releasedArtifactFiles = changedFiles.filter((file) =>
    RELEASED_ARTIFACT_PREFIXES.some((prefix) => file.startsWith(prefix))
  );

  if (releasedArtifactFiles.length === 0) {
    console.log('No released artifact files changed; release-note metadata not required.');
    return;
  }

  const prBody = pullRequest.body ?? '';
  const metadata = parseReleaseMetadata(prBody);
  const errors = validateMetadata(metadata);
  if (errors.length === 0) {
    console.log('Release-note metadata requirement satisfied.');
    return;
  }

  const changedFilesMarkdown = releasedArtifactFiles.map((file) => `- ${file}`).join('\n');
  console.error(
    [
      'PR changes affect released artifacts but release metadata is incomplete or invalid.',
      '',
      'Changed released-artifact files:',
      changedFilesMarkdown,
      '',
      'Validation errors:',
      ...errors.map((error) => `- ${error}`),
      '',
      'Update the `Release Metadata` block in the PR description using `.github/pull_request_template.md`.',
    ].join('\n')
  );
  process.exit(1);
}

main();
