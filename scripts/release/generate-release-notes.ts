import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  RELEASE_NOTES_TEMPLATE,
  VSCODE_PATHS,
  buildSections,
  getCommits,
  getPreviousReleaseTag,
  getWorkspaceVersions,
  parseReleaseTag,
  renderTemplateFile,
  renderSectionsMarkdown,
} from './lib.ts';

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

function main(): void {
  const tagName = readArg('tag');
  if (!tagName) {
    throw new Error('Missing required --tag=<tagName> argument');
  }

  const parsed = parseReleaseTag(tagName);
  if (!parsed) {
    throw new Error(`Unsupported release tag: ${tagName}`);
  }

  const channel = readArg('channel') ?? 'release';
  const outputPath = readArg('output') ?? 'artifacts/release/release-notes.md';
  const versions = getWorkspaceVersions();
  const previousTag = getPreviousReleaseTag(parsed.kind, tagName);
  const commits =
    parsed.kind === 'vscode'
      ? getCommits({
          fromTag: previousTag,
          toRef: tagName,
          paths: [...VSCODE_PATHS],
        })
      : getCommits({
          fromTag: previousTag,
          toRef: tagName,
        });
  const sections = buildSections(commits);

  const releaseKindLabel = parsed.kind === 'packages' ? 'npm packages' : 'VS Code extension';
  const channelLabel = channel === 'pre-release' ? 'Prerelease' : 'Stable release';
  const distributionNote =
    parsed.kind === 'packages'
      ? `npm dist-tag \`${channel === 'pre-release' ? 'next' : 'latest'}\``
      : `VS Code Marketplace ${channel === 'pre-release' ? 'pre-release' : 'stable'} publish`;

  const rendered = renderTemplateFile(RELEASE_NOTES_TEMPLATE, {
    changesMarkdown: renderSectionsMarkdown(
      sections,
      'Automated release alignment and dependency updates.'
    ),
    releaseKindLabel,
    channelLabel,
    packageVersion: versions.packageVersion,
    vscodeVersion: versions.vscodeVersion,
    distributionNote,
    hasDistributionNote: true,
    previousTag,
    hasPreviousTag: Boolean(previousTag),
  });

  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${rendered.trim()}\n`, 'utf8');
  console.log(`Generated release notes for ${tagName} at ${outputPath}`);
}

main();
