#!/usr/bin/env bash

set -euo pipefail

base_branch="staging"
apply=false

usage() {
  cat <<'USAGE'
Usage:
  scripts/git/cleanup-stale-local-branches.sh [--apply] [--base <branch>]

Behavior:
  - Dry-run by default (prints branches that are safe cleanup candidates).
  - A branch is a cleanup candidate when either:
    1) it is fully merged into the base branch, or
    2) it is functionally equivalent to the base branch (no '+' entries from git cherry).

Safety:
  - Never targets the current branch, main, or staging.

Examples:
  scripts/git/cleanup-stale-local-branches.sh
  scripts/git/cleanup-stale-local-branches.sh --apply
  scripts/git/cleanup-stale-local-branches.sh --base main --apply
USAGE
}

while (($# > 0)); do
  case "$1" in
    --apply)
      apply=true
      shift
      ;;
    --base)
      if (($# < 2)); then
        echo "error: --base requires a branch name" >&2
        exit 1
      fi
      base_branch="$2"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "error: unknown argument '$1'" >&2
      usage
      exit 1
      ;;
  esac
done

if ! git rev-parse --verify "$base_branch" >/dev/null 2>&1; then
  echo "error: base branch '$base_branch' does not exist locally" >&2
  exit 1
fi

current_branch="$(git symbolic-ref --quiet --short HEAD || true)"
if [[ -z "$current_branch" ]]; then
  echo "error: detached HEAD is not supported" >&2
  exit 1
fi

local_branches=()
while IFS= read -r branch_name; do
  local_branches+=("$branch_name")
done < <(git for-each-ref refs/heads --format='%(refname:short)')

candidates=()
for branch in "${local_branches[@]}"; do
  [[ "$branch" == "$current_branch" ]] && continue
  [[ "$branch" == "main" ]] && continue
  [[ "$branch" == "staging" ]] && continue

  is_merged=false
  if git merge-base --is-ancestor "$branch" "$base_branch"; then
    is_merged=true
  fi

  is_equivalent=false
  if ! git cherry "$base_branch" "$branch" | grep -q '^+'; then
    is_equivalent=true
  fi

  if [[ "$is_merged" == true || "$is_equivalent" == true ]]; then
    candidates+=("$branch")
  fi
done

if ((${#candidates[@]} == 0)); then
  echo "No stale local branches detected relative to '$base_branch'."
  exit 0
fi

echo "Cleanup candidates relative to '$base_branch':"
for branch in "${candidates[@]}"; do
  echo "  - $branch"
done

if [[ "$apply" != true ]]; then
  echo
  echo "Dry-run complete. Re-run with --apply to delete these branches."
  exit 0
fi

echo
echo "Deleting ${#candidates[@]} branches..."
git branch -D "${candidates[@]}"
echo "Done."
