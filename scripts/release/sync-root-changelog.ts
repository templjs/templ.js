import {
  buildSections,
  getCommits,
  getPreviousReleaseTag,
  getWorkspaceVersions,
  renderTemplateFile,
  renderSectionsMarkdown,
  upsertVersionSection,
} from './lib.ts';

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

function main(): void {
  const workspaceVersions = getWorkspaceVersions();
  const version = readArg('version') ?? workspaceVersions.packageVersion;
  const toRef = readArg('to-ref') ?? 'HEAD';
  const previousTag = readArg('previous-tag') ?? getPreviousReleaseTag('packages');
  const commits = getCommits({
    fromTag: previousTag,
    toRef,
    paths: ['src/packages'],
  });
  const sections = buildSections(commits);

  const section = renderTemplateFile('scripts/release/templates/root-changelog-entry.md.tmpl', {
    changesMarkdown: renderSectionsMarkdown(sections, 'Maintenance-only package updates.'),
    commitCount: commits.length,
    hasPreviousTag: Boolean(previousTag),
    previousTag: previousTag ?? '',
    releaseDate: new Date().toISOString().slice(0, 10),
    version,
  });

  upsertVersionSection('CHANGELOG.md', version, section);

  if (previousTag) {
    console.log(
      `Updated CHANGELOG.md for version ${version} using ${commits.length} commit(s) since ${previousTag}`
    );
    return;
  }

  console.log(
    `Updated CHANGELOG.md for version ${version} using ${commits.length} commit(s) from repository history`
  );
}

main();
