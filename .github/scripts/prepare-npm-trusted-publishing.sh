#!/usr/bin/env bash

#
# prepare-npm-trusted-publishing.sh
#
# Prints the exact npm trusted publisher configuration required for templjs and
# optionally checks whether each published package already exists on npm.
#
# Usage:
#   ./.github/scripts/prepare-npm-trusted-publishing.sh
#   ./.github/scripts/prepare-npm-trusted-publishing.sh --check-registry
#

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OWNER='templjs'
REPO='templ.js'
WORKFLOW='release.yml'
CHECK_REGISTRY='false'

log() {
    printf '%s\n' "$*"
}

die() {
    printf 'error: %s\n' "$*" >&2
    exit 1
}

while [ $# -gt 0 ]; do
    case "$1" in
        --check-registry)
            CHECK_REGISTRY='true'
            ;;
        -h|--help)
            sed -n '1,16p' "$0"
            exit 0
            ;;
        *)
            die "unknown argument: $1"
            ;;
    esac
    shift
done

if ! command -v node >/dev/null 2>&1; then
    die 'node is required'
fi

if [ "$CHECK_REGISTRY" = 'true' ] && ! command -v npm >/dev/null 2>&1; then
    die 'npm is required when using --check-registry'
fi

PACKAGE_ROWS_FILE="$(mktemp)"
trap 'rm -f "$PACKAGE_ROWS_FILE"' EXIT

ROOT_DIR="$ROOT_DIR" node <<'EOF' > "$PACKAGE_ROWS_FILE"
const fs = require('node:fs');
const path = require('node:path');

const root = process.env.ROOT_DIR;
const changesetConfig = JSON.parse(
  fs.readFileSync(path.join(root, '.changeset/config.json'), 'utf8')
);
const fixedPackages = new Set((changesetConfig.fixed ?? []).flat());
const packageRoots = fs
  .readdirSync(path.join(root, 'src/packages'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const rows = [];

for (const dirName of packageRoots) {
  const relativePackagePath = path.join('src/packages', dirName, 'package.json');
  const absolutePackagePath = path.join(root, relativePackagePath);
  const packageJson = JSON.parse(fs.readFileSync(absolutePackagePath, 'utf8'));
  if (!fixedPackages.has(packageJson.name)) {
    continue;
  }

  const repositoryUrl =
    typeof packageJson.repository === 'string'
      ? packageJson.repository
      : packageJson.repository?.url ?? '';

  rows.push([
    packageJson.name,
    relativePackagePath,
    packageJson.version,
    repositoryUrl,
  ].join('\t'));
}

rows.sort((left, right) => left.localeCompare(right));

for (const row of rows) {
  console.log(row);
}
EOF

if [ ! -s "$PACKAGE_ROWS_FILE" ]; then
    die 'no published npm packages found from .changeset/config.json'
fi

EXPECTED_REPOSITORY_URL="https://github.com/${OWNER}/${REPO}.git"
WARNING_COUNT=0

log 'templjs npm trusted publishing preflight'
log
log "GitHub repository: ${OWNER}/${REPO}"
log "Workflow filename: ${WORKFLOW}"
log 'Environment name: leave blank'
log
log 'GitHub-side automation already handled in-repo:'
log '- release.yml requests id-token: write for npm publish jobs'
log '- staging prereleases publish to dist-tag next'
log '- stable package releases publish to dist-tag latest'
log '- npm provenance is enabled during publish'
log
log 'Manual npm setup still required:'
log '- npm trusted publishers are configured per package in the npm web UI'
log '- npm currently allows only one trusted publisher per package'
log
log 'Per-package configuration:'
log

while IFS= read -r row; do
    package_name="$(printf '%s\n' "$row" | cut -f1)"
    package_path="$(printf '%s\n' "$row" | cut -f2)"
    package_version="$(printf '%s\n' "$row" | cut -f3)"
    repository_url="$(printf '%s\n' "$row" | cut -f4)"

    log "Package: ${package_name}"
    log "  Manifest: ${package_path}"
    log "  Current version: ${package_version}"
    log "  npm settings URL: https://www.npmjs.com/package/${package_name}/settings/access"

    if [ "$repository_url" = "$EXPECTED_REPOSITORY_URL" ]; then
        log "  Repository metadata: matches ${EXPECTED_REPOSITORY_URL}"
    elif [ -n "$repository_url" ]; then
        log "  Repository metadata warning: manifest points to ${repository_url}"
        log "    Expected for this repo: ${EXPECTED_REPOSITORY_URL}"
        WARNING_COUNT=$((WARNING_COUNT + 1))
    else
        log '  Repository metadata warning: manifest does not declare a repository URL'
        log "    Expected for this repo: ${EXPECTED_REPOSITORY_URL}"
        WARNING_COUNT=$((WARNING_COUNT + 1))
    fi

    log "  Trusted publisher values:"
    log "    Owner: ${OWNER}"
    log "    Repository: ${REPO}"
    log "    Workflow filename: ${WORKFLOW}"
    log '    Environment name: leave blank'

    if [ "$CHECK_REGISTRY" = 'true' ]; then
        if npm view "${package_name}" name >/dev/null 2>&1; then
            log '  Registry status: package exists on npm'
        else
            log '  Registry status: package not found on npm yet'
        fi
    fi

    log
done < "$PACKAGE_ROWS_FILE"

log 'Manual npm UI steps for each package:'
log '1. Open the printed npm settings URL.'
log '2. Under Publishing, add GitHub as a trusted publisher.'
log '3. Enter the printed owner, repository, and workflow filename.'
log '4. Leave the environment field blank.'
log '5. Save the trusted publisher.'

if [ "$WARNING_COUNT" -gt 0 ]; then
    log
    log "Repository metadata warnings found: ${WARNING_COUNT}"
    log 'Trusted publishing can still be configured with the printed values, but the package manifests should be cleaned up separately.'
fi
