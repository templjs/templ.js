#!/usr/bin/env bash

#
# setup-branch-protection.sh
#
# Automates GitHub branch protection setup using GitHub CLI (gh).
# Requires: gh CLI authenticated with appropriate permissions.
#
# Usage:
#   ./setup-branch-protection.sh <org> <repo> [branch]
#
# Example:
#   ./setup-branch-protection.sh templjs templ.js main
#

set -euo pipefail

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
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

# Check if gh CLI is installed
check_gh_cli() {
    if ! command -v gh &> /dev/null; then
        log_error "GitHub CLI (gh) is not installed"
        log_info "Install from: https://cli.github.com/"
        exit 1
    fi
    
    log_success "GitHub CLI found: $(gh --version | head -n1)"
}

# Check if authenticated
check_auth() {
    if ! gh auth status &> /dev/null; then
        log_error "Not authenticated with GitHub CLI"
        log_info "Run: gh auth login"
        exit 1
    fi
    
    log_success "Authenticated with GitHub CLI"
}

# Validate arguments
validate_args() {
    if [ $# -lt 2 ]; then
        log_error "Usage: $0 <org> <repo> [branch]"
        log_info "Example: $0 templjs templ.js main"
        exit 1
    fi
    
    ORG="$1"
    REPO="$2"
    BRANCH="${3:-main}"
    
    log_info "Organization: $ORG"
    log_info "Repository: $REPO"
    log_info "Branch: $BRANCH"
}

# Check if repository exists
check_repo() {
    log_info "Checking if repository exists..."
    
    if ! gh repo view "$ORG/$REPO" &> /dev/null; then
        log_error "Repository $ORG/$REPO not found"
        log_info "Create it first: gh repo create $ORG/$REPO --public"
        exit 1
    fi
    
    log_success "Repository $ORG/$REPO found"
}

# Setup branch protection
setup_protection() {
    log_info "Setting up branch protection for $BRANCH..."
    
    # Build protection rules JSON
    local protection_rules
    protection_rules=$(cat <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": []
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1,
    "require_last_push_approval": true
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": true
}
EOF
)
    
    # Apply protection using GitHub API via gh
    if gh api \
        --method PUT \
        -H "Accept: application/vnd.github+json" \
        "/repos/$ORG/$REPO/branches/$BRANCH/protection" \
        --input - <<< "$protection_rules" &> /dev/null; then
        log_success "Branch protection enabled for $BRANCH"
    else
        log_error "Failed to enable branch protection"
        log_warning "You may need admin permissions on $ORG/$REPO"
        return 1
    fi
}

# Add status checks (to be added after CI/CD workflows are set up)
add_status_checks() {
    log_info "Configuring required status checks..."
    
    # Note: Status checks are added when they first run
    # This updates the existing protection rule to require them
    # CodeQL is enforced via codeql.yml workflow, not native enforcement
    local status_checks='["Install Dependencies", "Lint", "Type Check", "Lint Work Item Frontmatter", "Test (Node 18)", "Test (Node 20)", "Build", "Analyze (javascript-typescript)"]'
    
    local update_rules
    update_rules=$(cat <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": $(echo "$status_checks")
  }
}
EOF
)
    
    if gh api \
        --method PATCH \
        -H "Accept: application/vnd.github+json" \
        "/repos/$ORG/$REPO/branches/$BRANCH/protection/required_status_checks" \
        --input - <<< "$update_rules" &> /dev/null; then
        log_success "Status checks configured (will apply when CI/CD workflows exist)"
    else
        log_warning "Could not configure status checks (they may not exist yet)"
        log_info "Status checks will be enforced once CI/CD workflows run"
    fi
}

# Require signed commits
require_signed_commits() {
    log_info "Requiring signed commits..."
    
    if gh api \
        --method POST \
        -H "Accept: application/vnd.github+json" \
        "/repos/$ORG/$REPO/branches/$BRANCH/protection/required_signatures" &> /dev/null; then
        log_success "Signed commits required"
    else
        log_warning "Could not require signed commits (may already be enabled)"
    fi
}

# Display protection summary
show_summary() {
    log_info "Fetching current protection rules..."
    
    if protection_info=$(gh api \
        -H "Accept: application/vnd.github+json" \
        "/repos/$ORG/$REPO/branches/$BRANCH/protection" 2>/dev/null); then
        
        echo ""
        log_success "Branch Protection Summary for $ORG/$REPO:$BRANCH"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        
        # Extract and display key settings
        echo "$protection_info" | gh api graphql -f query='
          query {
            repository(owner: "'"$ORG"'", name: "'"$REPO"'") {
              branchProtectionRules(first: 10) {
                nodes {
                  pattern
                  requiresApprovingReviews
                  requiredApprovingReviewCount
                  requiresStatusChecks
                  requiresStrictStatusChecks
                  requiresLinearHistory
                  requiresConversationResolution
                  allowsForcePushes
                  allowsDeletions
                }
              }
            }
          }
        ' --jq '.data.repository.branchProtectionRules.nodes[] | select(.pattern == "'"$BRANCH"'")' \
        | jq -r '
          "  Pull Request Reviews: \(.requiresApprovingReviews)",
          "  Required Approvals: \(.requiredApprovingReviewCount)",
          "  Status Checks Required: \(.requiresStatusChecks)",
          "  Up-to-date Required: \(.requiresStrictStatusChecks)",
          "  Linear History: \(.requiresLinearHistory)",
          "  Conversation Resolution: \(.requiresConversationResolution)",
          "  Force Pushes: \(if .allowsForcePushes then "Allowed" else "Blocked" end)",
          "  Branch Deletion: \(if .allowsDeletions then "Allowed" else "Blocked" end)"
        ' 2>/dev/null || echo "  (Details unavailable via API)"
        
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
    else
        log_warning "Could not fetch protection summary"
    fi
}

# Main execution
main() {
    echo ""
    log_info "GitHub Branch Protection Setup"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # Pre-flight checks
    check_gh_cli
    check_auth
    validate_args "$@"
    check_repo
    
    echo ""
    log_info "Applying branch protection rules..."
    echo ""
    
    # Apply protection
    setup_protection
    add_status_checks
    require_signed_commits
    
    echo ""
    show_summary
    
    log_success "Branch protection setup complete!"
    log_info "View settings: https://github.com/$ORG/$REPO/settings/branches"
    echo ""
}

# Run main function
main "$@"
