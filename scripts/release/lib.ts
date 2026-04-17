import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderTemplate } from '../../src/packages/core/src/index.ts';

export type ReleaseKind = 'packages' | 'vscode';

export type ReleaseCommit = {
  hash: string;
  subject: string;
  body: string;
  type: string;
  scope: string | null;
  summary: string;
  prNumber: string | null;
};

export type ReleaseEntry = {
  summary: string;
  reference: string;
};

export type ReleaseSections = {
  added: ReleaseEntry[];
  fixed: ReleaseEntry[];
  changed: ReleaseEntry[];
  maintenance: ReleaseEntry[];
};

type ConventionalParts = {
  type: string;
  scope: string | null;
  summary: string;
  prNumber: string | null;
};

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const PACKAGE_VERSION_FILES = [
  'src/packages/core/package.json',
  'src/packages/cli/package.json',
  'src/packages/volar/package.json',
  'src/packages/context-graph/package.json',
] as const;

export const VSCODE_PACKAGE_FILE = 'src/extensions/vscode/package.json';
export const VSCODE_CHANGELOG_FILE = 'src/extensions/vscode/CHANGELOG.md';
export const PACKAGE_SCOPE_PATHS = ['src/packages'] as const;
export const VSCODE_SCOPE_PATHS = [
  'src/extensions/vscode',
  'src/packages/core',
  'src/packages/volar',
  'src/packages/context-graph',
] as const;
export const VSCODE_PATHS = VSCODE_SCOPE_PATHS;
export const VSCODE_CHANGELOG_TEMPLATE = path.join(
  ROOT,
  'scripts/release/templates/vscode-changelog-entry.md.tmpl'
);
export const RELEASE_NOTES_TEMPLATE = path.join(
  ROOT,
  'scripts/release/templates/github-release-notes.md.tmpl'
);

function runGit(args: string[]): string {
  try {
    return execFileSync('git', args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`git ${args.join(' ')} failed: ${message}`, {
      cause: error,
    });
  }
}

function readJsonFile<T>(relativePath: string): T {
  const absolutePath = path.join(ROOT, relativePath);
  return JSON.parse(readFileSync(absolutePath, 'utf8')) as T;
}

function writeJsonFile(relativePath: string, value: unknown): void {
  const absolutePath = path.join(ROOT, relativePath);
  writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function parseSemver(version: string): [number, number, number] {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Unsupported semver version: ${version}`);
  }

  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareSemver(left: string, right: string): number {
  const leftParts = parseSemver(left);
  const rightParts = parseSemver(right);

  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] - rightParts[index];
    }
  }

  return 0;
}

export function getChangedFiles(fromRef: string, toRef: string): string[] {
  const output = runGit(['diff', '--name-only', fromRef, toRef]);
  return output
    .split('\n')
    .map((file) => file.trim())
    .filter(Boolean);
}

export function hasPathPrefix(files: string[], prefixes: readonly string[]): boolean {
  return files.some((file) =>
    prefixes.some((prefix) => file === prefix || file.startsWith(`${prefix}/`))
  );
}

export function computeStagingPackageVersion(runNumber: number, runAttempt: number): string {
  return `0.0.0-staging.${runNumber}.${runAttempt}`;
}

export function computeStagingVscodeVersion(
  stableVersion: string,
  runNumber: number,
  runAttempt: number
): string {
  const [major, minor] = parseSemver(stableVersion);
  const patch = runNumber * 100 + runAttempt;
  return `${major}.${minor + 1}.${patch}`;
}

export function setPackageVersions(version: string): void {
  for (const relativePath of PACKAGE_VERSION_FILES) {
    const packageJson = readJsonFile<Record<string, unknown>>(relativePath);
    packageJson.version = version;
    writeJsonFile(relativePath, packageJson);
  }
}

export function setVscodeVersion(version: string): void {
  const packageJson = readJsonFile<Record<string, unknown>>(VSCODE_PACKAGE_FILE);
  packageJson.version = version;
  writeJsonFile(VSCODE_PACKAGE_FILE, packageJson);
}

export function parseReleaseTag(tagName: string): { kind: ReleaseKind; version: string } | null {
  const packageMatch = tagName.match(/^v(\d+\.\d+\.\d+)$/);
  if (packageMatch) {
    return {
      kind: 'packages',
      version: packageMatch[1],
    };
  }

  const vscodeMatch = tagName.match(/^vscode-v(\d+\.\d+\.\d+)$/);
  if (vscodeMatch) {
    return {
      kind: 'vscode',
      version: vscodeMatch[1],
    };
  }

  return null;
}

export function getWorkspaceVersions(): {
  packageVersion: string;
  vscodeVersion: string;
  coreVersion: string;
  volarVersion: string;
} {
  const packageVersions = PACKAGE_VERSION_FILES.map((relativePath) => {
    const packageJson = readJsonFile<{ version: string }>(relativePath);
    return packageJson.version;
  });

  const uniquePackageVersions = new Set(packageVersions);
  if (uniquePackageVersions.size !== 1) {
    throw new Error(
      `Workspace package versions are not synchronized: ${packageVersions.join(', ')}`
    );
  }

  const vscodePackage = readJsonFile<{ version: string }>(VSCODE_PACKAGE_FILE);
  const corePackage = readJsonFile<{ version: string }>('src/packages/core/package.json');
  const volarPackage = readJsonFile<{ version: string }>('src/packages/volar/package.json');

  return {
    packageVersion: packageVersions[0],
    vscodeVersion: vscodePackage.version,
    coreVersion: corePackage.version,
    volarVersion: volarPackage.version,
  };
}

export function getReleaseTagName(kind: ReleaseKind, version: string): string {
  return kind === 'packages' ? `v${version}` : `vscode-v${version}`;
}

export function getPreviousReleaseTag(kind: ReleaseKind, currentTagName?: string): string | null {
  const pattern = kind === 'packages' ? 'v*' : 'vscode-v*';
  const tags = runGit(['tag', '--list', pattern])
    .split('\n')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tagName) => {
      const parsed = parseReleaseTag(tagName);
      return parsed && parsed.kind === kind ? { tagName, version: parsed.version } : null;
    })
    .filter((tag): tag is { tagName: string; version: string } => tag !== null)
    .sort((left, right) => compareSemver(right.version, left.version));

  if (!currentTagName) {
    return tags.length > 0 ? tags[0].tagName : null;
  }

  const currentIndex = tags.findIndex((tag) => tag.tagName === currentTagName);
  if (currentIndex === -1) {
    return null;
  }

  return tags[currentIndex + 1]?.tagName ?? null;
}

function parseConventionalSummary(subject: string): ConventionalParts {
  const prNumberMatch = subject.match(/\(#(\d+)\)\s*$/);
  const prNumber = prNumberMatch ? prNumberMatch[1] : null;
  const withoutPr = subject.replace(/\s*\(#\d+\)\s*$/, '').trim();
  const conventionalMatch = withoutPr.match(/^([a-z]+)(?:\(([^)]+)\))?!?:\s*(.+)$/i);

  if (!conventionalMatch) {
    return {
      type: 'changed',
      scope: null,
      summary: withoutPr,
      prNumber,
    };
  }

  return {
    type: conventionalMatch[1].toLowerCase(),
    scope: conventionalMatch[2] ?? null,
    summary: conventionalMatch[3].trim(),
    prNumber,
  };
}

function extractReleaseNote(body: string): string | null {
  const lines = body.split(/\r?\n/);
  const chunks: string[] = [];
  let collecting = false;

  for (const line of lines) {
    if (!collecting) {
      const match = line.match(/^\s*release(?:[- ]notes?)?\s*:\s*(.+)\s*$/i);
      if (match) {
        chunks.push(match[1].trim());
        collecting = true;
      }
      continue;
    }

    if (/^\s+\S/.test(line)) {
      chunks.push(line.trim());
      continue;
    }

    break;
  }

  if (chunks.length === 0) {
    return null;
  }

  return chunks.join(' ').replace(/\s+/g, ' ').trim();
}

export function getCommits(options: {
  fromTag?: string | null;
  toRef?: string;
  paths?: string[];
}): ReleaseCommit[] {
  const range = options.fromTag
    ? `${options.fromTag}..${options.toRef ?? 'HEAD'}`
    : (options.toRef ?? 'HEAD');
  const args = ['log', '--reverse', '--format=%H%x1f%s%x1f%b%x1e', range];

  if (options.paths && options.paths.length > 0) {
    args.push('--', ...options.paths);
  }

  const output = runGit(args);
  if (!output) {
    return [];
  }

  return output
    .split('\x1e')
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [hash, subject, body] = record.split('\x1f');
      const normalizedBody = body?.trim() ?? '';
      const conventional = parseConventionalSummary(subject);
      const releaseNote = extractReleaseNote(normalizedBody);
      return {
        hash,
        subject,
        body: normalizedBody,
        type: conventional.type,
        scope: conventional.scope,
        summary: releaseNote ?? conventional.summary,
        prNumber: conventional.prNumber,
      };
    });
}

function createReference(prNumber: string | null, hash: string): string {
  if (prNumber) {
    return `#${prNumber}`;
  }

  return hash.slice(0, 7);
}

function sectionForCommit(commit: ReleaseCommit): keyof ReleaseSections {
  switch (commit.type) {
    case 'feat':
      return 'added';
    case 'fix':
      return 'fixed';
    case 'docs':
    case 'ci':
    case 'test':
    case 'build':
    case 'chore':
      return 'maintenance';
    default:
      return 'changed';
  }
}

export function buildSections(commits: ReleaseCommit[]): ReleaseSections {
  const sections: ReleaseSections = {
    added: [],
    fixed: [],
    changed: [],
    maintenance: [],
  };
  const seen = new Set<string>();

  for (const commit of commits) {
    if (commit.subject.startsWith('Merge ')) {
      continue;
    }

    const key = `${sectionForCommit(commit)}:${commit.summary}`;
    if (seen.has(key)) {
      continue;
    }

    sections[sectionForCommit(commit)].push({
      summary: commit.summary,
      reference: createReference(commit.prNumber, commit.hash),
    });
    seen.add(key);
  }

  return sections;
}

export function countSectionEntries(sections: ReleaseSections): number {
  return (
    sections.added.length +
    sections.fixed.length +
    sections.changed.length +
    sections.maintenance.length
  );
}

export function renderSectionsMarkdown(sections: ReleaseSections, fallbackLine: string): string {
  const chunks: string[] = [];
  const orderedSections: Array<[keyof ReleaseSections, string]> = [
    ['added', 'Added'],
    ['fixed', 'Fixed'],
    ['changed', 'Changed'],
    ['maintenance', 'Maintenance'],
  ];

  for (const [key, title] of orderedSections) {
    const entries = sections[key];
    if (entries.length === 0) {
      continue;
    }

    chunks.push(
      `### ${title}\n\n${entries.map((entry) => `- ${entry.summary} (${entry.reference})`).join('\n')}`
    );
  }

  if (chunks.length === 0) {
    return `### Changed\n\n- ${fallbackLine}`;
  }

  return chunks.join('\n\n');
}

export function renderTemplateFile(templatePath: string, data: Record<string, unknown>): string {
  const template = readFileSync(templatePath, 'utf8');
  return renderTemplate(template, data, { throwOnError: true });
}

export function upsertVersionSection(
  changelogPath: string,
  version: string,
  renderedSection: string
): void {
  const absolutePath = path.join(ROOT, changelogPath);
  const currentContent = readFileSync(absolutePath, 'utf8').trimEnd();
  const normalizedSection = renderedSection.trim();

  let nextContent: string;
  const headingMatches = [...currentContent.matchAll(/^##\s+(.+)$/gm)].map((match) => ({
    heading: match[1].trim(),
    index: match.index ?? 0,
  }));
  const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const versionHeadingPattern = new RegExp(`^\\[${escapedVersion}\\](?:\\s*-\\s*.+)?$`);
  const matchingIndexes = headingMatches
    .map((match, index) =>
      match.heading === version || versionHeadingPattern.test(match.heading) ? index : -1
    )
    .filter((index) => index >= 0);

  if (matchingIndexes.length > 0) {
    const startIndex = headingMatches[matchingIndexes[0]].index;
    const lastMatchingIndex = matchingIndexes[matchingIndexes.length - 1];
    const endIndex = headingMatches[lastMatchingIndex + 1]?.index ?? currentContent.length;
    nextContent =
      `${currentContent.slice(0, startIndex).trimEnd()}\n\n${normalizedSection}\n\n${currentContent
        .slice(endIndex)
        .trimStart()}`.trimEnd();
  } else {
    const firstVersionHeading = headingMatches.find((match) =>
      /^\[\d+\.\d+\.\d+\](?:\s*-\s*.+)?$/.test(match.heading)
    );
    if (firstVersionHeading) {
      nextContent =
        `${currentContent.slice(0, firstVersionHeading.index).trimEnd()}\n\n${normalizedSection}\n\n${currentContent
          .slice(firstVersionHeading.index)
          .trimStart()}`.trimEnd();
      writeFileSync(absolutePath, `${nextContent.trimEnd()}\n`, 'utf8');
      return;
    }

    const titleMatch = currentContent.match(/^# .+$/m);
    if (!titleMatch || titleMatch.index === undefined) {
      nextContent = `${currentContent}\n\n${normalizedSection}`;
    } else {
      const insertAt = titleMatch.index + titleMatch[0].length;
      nextContent = `${currentContent.slice(0, insertAt)}\n\n${normalizedSection}\n\n${currentContent
        .slice(insertAt)
        .trimStart()}`;
    }
  }

  writeFileSync(absolutePath, `${nextContent.trimEnd()}\n`, 'utf8');
}
