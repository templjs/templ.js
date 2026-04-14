#!/usr/bin/env bash

#
# setup-branch-protection.sh
#
# Automates GitHub repository ruleset setup using GitHub CLI (gh).
# Requires: gh CLI authenticated with appropriate permissions.
#
# Usage:
#   ./setup-branch-protection.sh <org> <repo> [branch_pattern] [shared_ruleset_name]
#
# Example:
#   ./setup-branch-protection.sh templjs templ.js
#   ./setup-branch-protection.sh templjs templ.js 'refs/heads/*[!/]*' 'protect-long-lived-branches'
#

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

DEFAULT_BRANCH_PATTERN='refs/heads/*[!/]*'
DEFAULT_RULESET_NAME='protect-long-lived-branches'
STAGING_RULESET_NAME='protect-staging-merge-method'
MAIN_RULESET_NAME='protect-main-merge-method'

log_info() {
    echo -e "${BLUE}ℹ${NC} $*"
}

log_success() {
    echo -e "${GREEN}✓${NC} $*"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $*"
}

log_error() {
    echo -e "${RED}✗${NC} $*" >&2
}

check_gh_cli() {
    if ! command -v gh >/dev/null 2>&1; then
        log_error "GitHub CLI (gh) is not installed"
        log_info "Install from: https://cli.github.com/"
        exit 1
    fi

    log_success "GitHub CLI found: $(gh --version | head -n1)"
}

check_auth() {
    if ! gh auth status >/dev/null 2>&1; then
        log_error "Not authenticated with GitHub CLI"
        log_info "Run: gh auth login"
        exit 1
    fi

    log_success "Authenticated with GitHub CLI"
}

validate_args() {
    if [ $# -lt 2 ]; then
        log_error "Usage: $0 <org> <repo> [branch_pattern] [shared_ruleset_name]"
        log_info "Example: $0 templjs templ.js '$DEFAULT_BRANCH_PATTERN' '$DEFAULT_RULESET_NAME'"
        exit 1
    fi

    ORG="$1"
    REPO="$2"
    BRANCH_PATTERN="${3:-$DEFAULT_BRANCH_PATTERN}"
    RULESET_NAME="${4:-$DEFAULT_RULESET_NAME}"

    log_info "Organization: $ORG"
    log_info "Repository: $REPO"
    log_info "Branch pattern: $BRANCH_PATTERN"
    log_info "Shared ruleset name: $RULESET_NAME"
    log_info "Staging ruleset name: $STAGING_RULESET_NAME"
    log_info "Main ruleset name: $MAIN_RULESET_NAME"
}

check_repo() {
    log_info "Checking if repository exists..."

    if ! gh repo view "$ORG/$REPO" >/dev/null 2>&1; then
        log_error "Repository $ORG/$REPO not found"
        log_info "Create it first: gh repo create $ORG/$REPO --public"
        exit 1
    fi

    log_success "Repository $ORG/$REPO found"
}

build_shared_ruleset_payload() {
    cat <<EOF
{
  "name": "$RULESET_NAME",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "include": ["$BRANCH_PATTERN"],
      "exclude": []
    }
  },
  "rules": [
    {
      "type": "deletion"
    },
    {
      "type": "non_fast_forward"
    },
    {
      "type": "required_linear_history"
    },
    {
      "type": "creation"
    },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 1,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": true,
        "required_review_thread_resolution": true,
        "allowed_merge_methods": ["squash", "rebase"]
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "do_not_enforce_on_create": false,
        "required_status_checks": [
          { "context": "Install Dependencies" },
          { "context": "Lint" },
          { "context": "Type Check" },
          { "context": "Lint Work Item Frontmatter" },
          { "context": "Require Changeset" },
          { "context": "Docs API Guard" },
          { "context": "Test (Node 22, ubuntu-latest)" },
          { "context": "Test (Node 22, macos-latest)" },
          { "context": "Test (Node 22, windows-latest)" },
          { "context": "Test (Node 24, ubuntu-latest)" },
          { "context": "Test (Node 24, macos-latest)" },
          { "context": "Test (Node 24, windows-latest)" },
          { "context": "Build" }
        ]
      }
    },
    {
      "type": "copilot_code_review",
      "parameters": {
        "review_on_push": true,
        "review_draft_pull_requests": false
      }
    }
  ],
  "bypass_actors": []
}
EOF
}

build_branch_merge_ruleset_payload() {
    local ruleset_name="$1"
    local branch_ref="$2"
    local merge_method="$3"

    cat <<EOF
{
  "name": "$ruleset_name",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "include": ["$branch_ref"],
      "exclude": []
    }
  },
  "rules": [
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 1,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": true,
        "required_review_thread_resolution": true,
        "allowed_merge_methods": ["$merge_method"]
      }
    }
  ],
  "bypass_actors": []
}
EOF
}

get_existing_ruleset_id() {
    local ruleset_name="$1"
    gh api \
        -H "Accept: application/vnd.github+json" \
        "/repos/$ORG/$REPO/rulesets" \
        --jq ".[] | select(.name == \"$ruleset_name\" and .target == \"branch\") | .id" \
        | head -n1
}

apply_ruleset_payload() {
    local ruleset_name="$1"
    local payload="$2"
    local existing_id
    existing_id="$(get_existing_ruleset_id "$ruleset_name" || true)"

    if [ -n "$existing_id" ]; then
        if gh api \
            --method PUT \
            -H "Accept: application/vnd.github+json" \
            "/repos/$ORG/$REPO/rulesets/$existing_id" \
            --input - <<< "$payload" >/dev/null; then
            log_success "Updated ruleset '$ruleset_name' (id: $existing_id)"
        else
            log_error "Failed to update ruleset '$ruleset_name'"
            return 1
        fi
    else
        if gh api \
            --method POST \
            -H "Accept: application/vnd.github+json" \
            "/repos/$ORG/$REPO/rulesets" \
            --input - <<< "$payload" >/dev/null; then
            log_success "Created ruleset '$ruleset_name'"
        else
            log_error "Failed to create ruleset '$ruleset_name'"
            return 1
        fi
    fi
}

apply_rulesets() {
    log_info "Applying shared long-lived branch ruleset..."
    apply_ruleset_payload "$RULESET_NAME" "$(build_shared_ruleset_payload)"

    log_info "Applying staging-specific merge-method ruleset..."
    apply_ruleset_payload "$STAGING_RULESET_NAME" "$(build_branch_merge_ruleset_payload "$STAGING_RULESET_NAME" "refs/heads/staging" "squash")"

    log_info "Applying main-specific merge-method ruleset..."
    apply_ruleset_payload "$MAIN_RULESET_NAME" "$(build_branch_merge_ruleset_payload "$MAIN_RULESET_NAME" "refs/heads/main" "rebase")"
}

show_summary_for_ruleset() {
    local ruleset_name="$1"
    log_info "Fetching summary for ruleset '$ruleset_name'..."

    if gh api \
        -H "Accept: application/vnd.github+json" \
        "/repos/$ORG/$REPO/rulesets" \
        --jq ".[] | select(.name == \"$ruleset_name\" and .target == \"branch\") | {name: .name, enforcement: .enforcement, pattern: .conditions.ref_name.include}" \
        >/tmp/templjs-ruleset-summary.json 2>/dev/null; then
        echo ""
        log_success "Ruleset Summary for $ORG/$REPO"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        jq -r '
          "  Name: \(.name)",
          "  Enforcement: \(.enforcement)",
          "  Include pattern(s): \(.pattern | join(", "))"
        ' /tmp/templjs-ruleset-summary.json 2>/dev/null || echo "  (Details unavailable via API)"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        rm -f /tmp/templjs-ruleset-summary.json
    else
        log_warning "Could not fetch ruleset summary"
    fi
}

show_summary() {
    show_summary_for_ruleset "$RULESET_NAME"
    show_summary_for_ruleset "$STAGING_RULESET_NAME"
    show_summary_for_ruleset "$MAIN_RULESET_NAME"
}

main() {
    echo ""
    log_info "GitHub Shared Branch Ruleset Setup"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    check_gh_cli
    check_auth
    validate_args "$@"
    check_repo

    echo ""
    log_info "Applying repository ruleset..."
    echo ""

    apply_rulesets

    echo ""
    show_summary

    log_success "Shared branch ruleset setup complete!"
    log_info "View settings: https://github.com/$ORG/$REPO/settings/rules"
}

main "$@"
