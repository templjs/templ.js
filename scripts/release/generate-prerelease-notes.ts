import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  RELEASE_NOTES_TEMPLATE,
  buildSections,
  getCommits,
  renderTemplateFile,
  renderSectionsMarkdown,
} from './lib.ts';

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

function parseBoolean(value: string | undefined): boolean {
  return value === 'true';
}

function requireArg(name: string): string {
  const value = readArg(name);
  if (!value) {
    throw new Error(`Missing required --${name}=... argument`);
  }
  return value;
}

function main(): void {
  const base = requireArg('base');
  const head = requireArg('head');
  const packageVersion = readArg('package-version') ?? '';
  const vscodeVersion = readArg('vscode-version') ?? '';
  const publishPackages = parseBoolean(readArg('publish-packages'));
  const publishVscode = parseBoolean(readArg('publish-vscode'));
  const outputPath = requireArg('output');

  const paths: string[] = [];
  if (publishPackages) {
    paths.push('src/packages');
  }
  if (publishVscode) {
    paths.push('src/extensions/vscode');
  }

  const hasPublishedArtifacts = paths.length > 0;
  const commits = hasPublishedArtifacts ? getCommits({ fromTag: base, toRef: head, paths }) : [];
  const sections = buildSections(commits);

  const releaseKindLabel =
    publishPackages && publishVscode
      ? 'workspace prerelease'
      : publishPackages
        ? 'npm packages prerelease'
        : publishVscode
          ? 'VS Code extension prerelease'
          : 'staging prerelease';

  const versionLabel =
    publishPackages && publishVscode
      ? `${packageVersion || 'n/a'} / ${vscodeVersion || 'n/a'}`
      : publishPackages
        ? packageVersion || 'n/a'
        : publishVscode
          ? vscodeVersion || 'n/a'
          : 'n/a';

  const rendered = renderTemplateFile(RELEASE_NOTES_TEMPLATE, {
    changesMarkdown: renderSectionsMarkdown(
      sections,
      'Automated staging prerelease alignment and dependency updates.'
    ),
    releaseKindLabel,
    channelLabel: 'Prerelease',
    packageVersion: packageVersion || 'n/a',
    vscodeVersion: vscodeVersion || 'n/a',
    distributionNote: 'Staging prerelease candidate awaiting maintainer approval',
    hasDistributionNote: true,
    previousTag: base.slice(0, 12),
    hasPreviousTag: true,
  });

  const notes = `${rendered.trim()}\n\n<!-- commit-count: ${commits.length}; version: ${versionLabel} -->\n`;

  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, notes, 'utf8');
  console.log(`Generated staging prerelease notes (${commits.length} commits) -> ${outputPath}`);
}

main();
