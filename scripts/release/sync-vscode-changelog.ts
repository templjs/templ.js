import {
  VSCODE_CHANGELOG_FILE,
  VSCODE_CHANGELOG_TEMPLATE,
  VSCODE_SCOPE_PATHS,
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
  const versions = getWorkspaceVersions();
  const version = readArg('version') ?? versions.vscodeVersion;
  const previousTag = readArg('previous-tag') ?? getPreviousReleaseTag('vscode');
  const toRef = readArg('to-ref') ?? 'HEAD';
  const changelogPath = readArg('changelog') ?? VSCODE_CHANGELOG_FILE;

  const commits = getCommits({
    fromTag: previousTag,
    toRef,
    paths: [...VSCODE_SCOPE_PATHS],
  });
  const sections = buildSections(commits);
  const renderedSection = renderTemplateFile(VSCODE_CHANGELOG_TEMPLATE, {
    version,
    changesMarkdown: renderSectionsMarkdown(
      sections,
      'Internal release alignment and dependency updates.'
    ),
    coreVersion: versions.coreVersion,
    volarVersion: versions.volarVersion,
  });

  upsertVersionSection(changelogPath, version, renderedSection);
  console.log(
    `Updated ${changelogPath} for vscode-templjs ${version} using ${commits.length} change entries`
  );
}

main();
