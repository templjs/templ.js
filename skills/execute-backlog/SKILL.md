---
name: execute-backlog
description: 'Orchestrate the full lifecycle of implementing backlog work items from planning through delivery. Use when asked to "execute backlog", "implement work items", "work on backlog", "deliver features", or "close out a work item". Integrates all stages: creation, branch management, implementation, testing, PR review, feedback handling, and finalization.'
---

# Execute Backlog

Complete orchestration skill for implementing work items from creation through delivery. Coordinates multiple specialized skills to manage the entire lifecycle: planning, branching, coding, testing, review, refinement, and closure.

## When to Use This Skill

- User asks to "execute the backlog" or "implement work items"
- Starting work on a new feature, fix, or task
- Need to manage implementation from start to finish
- Coordinating parallel work across multiple work items
- Delivering completed work items through review and merge
- Need structured guidance on work item progression

## Prerequisites

- Work items created in `backlog/*.md` with YAML frontmatter
- Local git repository with feature branch support
- GitHub repository with PR/issue infrastructure
- NPM/pnpm package manager for dependency management
- GitHub CLI (`gh`) installed and authenticated
- Integration with complementary skills:
  - `create-work-item`: Create new backlog items
  - `update-work-item`: Progress work item status
  - `finalize-work-item`: Close completed work items
  - `audit-backlog`: Validate dependency graph before starting
  - `feature-branch-management`: Create/sync/delete feature branches
  - `git-commit`: Conventional commit message generation
  - `create-pr`: Create pull requests with work item metadata
  - `copilot-pull-request`: GitHub PR API operations
  - `pull-request-tool`: Unified PR/issue management
  - `process-pr`: End-to-end PR workflow
  - `handle-pr-feedback`: Address review comments
  - `code-review-excellence`: Provide quality feedback
  - `gh-pr-review`: GitHub CLI PR review operations
  - `sequential-execution`: Order dependent tasks
  - `parallel-execution`: Run independent tasks concurrently
  - `task-coordination-strategies`: Decompose and manage dependencies
  - `debugging-strategies`: Troubleshoot failures
  - `parallel-debugging`: Investigate multiple hypotheses
  - `javascript-testing-patterns`: Unit, integration, E2E testing
  - `modern-javascript-patterns`: ES6+ idioms
  - `typescript-advanced-types`: Type safety strategies
  - `nodejs-backend-patterns`: Server-side architectures
  - `vscode-ext-commands`: VS Code extension commands
  - `vscode-ext-localization`: i18n/l10n implementation

## Execution Phases

### Phase 1: Planning & Validation

**Goal:** Ensure backlog is healthy and work item is ready to start.

**Workflow:**

1. **Run backlog audit** (`audit-backlog` skill):
   - Validate schema compliance
   - Check dependency graph integrity
   - Fix any orphaned or under-specified items
   - Confirm release gates (test coverage, docs)

2. **Select work item:**
   - Choose work item with status `proposed` or `ready`
   - Verify all `depends_on` items are `closed`
   - Review acceptance criteria
   - Check estimated effort is realistic

3. **Validate constraints:**
   - No conflicting work in flight (same files/area)
   - Dependencies don't require waiting
   - Prerequisites installed (SDKs, tools, libraries)
   - Related documentation accessible

**Triggers:**

- `"audit the backlog before we start"`
- `"let's work on WI-005"`
- `"is WI-012 ready to implement?"`

### Phase 2: Creation or Transition

**Goal:** Create new work items or advance existing ones to in-progress.

**Option A: Create New Work Item** (`create-work-item` skill):

```bash
# User provides task description, effort, dependencies
# Skill generates:
- Numbered work item file (001-029 + ...)
- YAML frontmatter with schema-compliant metadata
- Goal/Background/Tasks/Deliverables structure
- Dependency links with [[wikilink]] format
- Acceptance criteria checklist
```

**Option B: Transition Existing Item** (`update-work-item` skill):

```bash
# Transition status: proposed → in-progress
# Update frontmatter:
- status: in-progress
- assignee: your-username
- actual: 0 (reset tracking)
```

**Validation:**

- `pnpm run lint:frontmatter` confirms schema
- All dependencies have `status: closed`
- Feature branch created with naming: `feature/wi-NNN-slug`, `bugfix/wi-NNN-slug`, etc.

**Triggers:**

- `"create a work item for X feature"`
- `"start working on WI-015"`
- `"transition WI-008 to in-progress"`

### Phase 3: Branch & Implementation

**Goal:** Implement work item with clean git history and passing tests.

**Branch Management** (`feature-branch-management` skill):

```bash
1. Create or sync feature branch:
   git checkout -b feature/wi-NNN-description
   # or sync if branch exists:
   git rebase origin/main

2. Pull latest main periodically (daily for long-running tasks)
3. Resolve conflicts using interactive rebase if needed
```

**Implementation Steps:**

1. **Code changes** - Write production code:
   - Follow code style (TypeScript, ESLint, Prettier)
   - Use patterns from:
     - `modern-javascript-patterns`: ES6+, async/await, destructuring
     - `typescript-advanced-types`: Strict typing, generics, conditional types
     - `nodejs-backend-patterns`: Server architecture, middleware
     - `vscode-ext-commands`: Extension command structure
     - `vscode-ext-localization`: i18n/l10n patterns

2. **Test coverage** (`javascript-testing-patterns` skill):
   - Unit tests: `src/**/*.test.ts` (Jest, Vitest)
   - Integration tests: API contracts, data layer
   - E2E tests: User workflows, UI automation
   - Aim for >80% line coverage on new code
   - Run tests locally: `pnpm test`

3. **Commit changes** (`git-commit` skill):
   - Auto-detect conventional commit type (feat, fix, docs, etc.)
   - Group related changes logically
   - Each commit should be self-contained
   - Message format: `type(scope): description`
   - Examples:

     ```
     feat(core): add template parsing with configurable delimiters
     fix(cli): handle stdin EOF without hanging
     docs(volar): explain virtual code mapping architecture
     test(lexer): add coverage for edge cases
     ```

4. **Debugging** (if needed - `debugging-strategies`, `parallel-debugging` skills):
   - Use breakpoints, logs, inspector tools
   - Trace through code systematically
   - Test hypotheses in isolation
   - Document findings in work item notes

**Triggers:**

- `"implement WI-015"`
- `"add tests for the lexer"`
- `"fix the parser edge case in WI-008"`

### Phase 4: Pull Request & Review

**Goal:** Get code merged with thorough review and feedback addressed.

**PR Creation** (`create-pr` skill):

```bash
1. Ensure all tests pass locally
2. Push feature branch: git push origin feature/wi-NNN-description
3. Create PR from GitHub UI or CLI:
   gh pr create \
     --title "feat: describe the feature (WI-015)" \
     --body "Implements WI-015\n\nChanges:\n- ..." \
     --draft=false
```

**PR Template** (auto-populated by `create-pr`):

```markdown
# Description

Implements WI-015: [Feature name]

## Changes

- Change 1
- Change 2

## Testing

- [x] Unit tests added
- [x] Integration tests pass
- [x] No regressions in e2e tests

## Checklist

- [x] Satisfies acceptance criteria
- [x] All dependent work items closed
- [x] Tests >80% coverage
- [x] Documentation updated
- [x] No breaking changes (or marked as such)
```

**Review Process** (`copilot-pull-request`, `pull-request-tool`, `code-review-excellence` skills):

1. **Assign reviewers** (minimum 1-2 domain experts)
2. **Await feedback** (typically 24h)
3. **Review quality dimensions:**
   - Correctness: Does it work as intended?
   - Testing: Adequate coverage, edge cases?
   - Performance: No regressions?
   - Maintainability: Clear code, good patterns?
   - Security: No vulnerabilities introduced?
   - Documentation: Updated, accurate?

**Triggers:**

- `"create a PR for WI-015"`
- `"review this PR carefully"`
- `"check for regressions"`

### Phase 5: Feedback & Refinement

**Goal:** Address review comments and achieve approval.

**Handle Feedback** (`handle-pr-feedback`, `resolve-pr-comments` skills):

1. **Categorize comments:**
   - **Blockers**: Must fix before merge (logic errors, security, tests)
   - **Majors**: Should fix (architecture, readability, performance)
   - **Minors**: Nice to have (typos, style, suggestions)

2. **Address blockers immediately:**
   - Commit fixes to feature branch
   - Push to same PR (auto-updates)
   - Re-request review

3. **Discuss majors:**
   - Ask for clarification if unclear
   - Propose alternative implementations
   - Accept reviewer's guidance on project standards

4. **Batch minor fixes:**
   - Fix during next commit if related
   - Acknowledge but defer non-critical items

5. **Iterate until approval:**
   - Typically 1-3 rounds for quality PRs
   - Use `gh pr status` to track state

**Debugging Failed Tests** (`debugging-strategies`, `parallel-debugging` skills):

- If PR checks fail, investigate:
  - Run failed tests locally: `pnpm test -- --testNamePattern="..."`
  - Check CI logs for error details
  - Reproduce failure in isolation
  - Fix root cause, not symptom

**Triggers:**

- `"the review found issues, help me fix them"`
- `"why is this test failing?"`
- `"I need to address feedback on the PR"`

### Phase 6: Merge & Deploy

**Goal:** Merge PR to main and verify in production.

**Process PR** (`process-pr` skill):

```bash
1. Confirm all reviews approved
2. Confirm all status checks pass (CI, tests, linters)
3. Confirm branch is up-to-date with main
4. Merge with squash or conventional merge:
   gh pr merge --squash  # Keeps single commit
   # or
   gh pr merge --rebase  # Preserves commit history
```

**Merge Strategy Guidance:**

- **Squash merge**: Use for feature PRs to keep main clean
- **Rebase merge**: Use for infrastructure/refactor to preserve history
- **Create merge**: Use only for coordination PRs (rare)

**Post-Merge Validation:**

```bash
1. Main branch builds successfully
2. Deployment triggers (if auto-deploy)
3. Smoke tests pass in staging
4. Monitor logs for errors (5-10 min)
```

**Triggers:**

- `"merge the PR"`
- `"we're ready to deploy"`

### Phase 7: Finalization

**Goal:** Close work item, record metrics, clean up.

**Finalize Work Item** (`finalize-work-item` skill):

1. **Verify completion:**
   - All acceptance criteria met ✓
   - All tests passing ✓
   - No open feedback ✓
   - Merged to main ✓
   - Deployed/available ✓

2. **Update work item:**

   ```yaml
   status: closed
   completed_date: 2024-02-19
   actual_hours: 16 # Total hours spent
   test_results:
     coverage: 85%
     unit_tests: 45 passed
     integration_tests: 12 passed
   ```

3. **Clean up:**
   - Delete feature branch locally: `git branch -d feature/wi-NNN-...`
   - Delete feature branch remotely: `git push origin --delete feature/wi-NNN-...`
   - Archive work item (move to completed if using folders)

4. **Link successor work items:**
   - If new dependencies discovered during implementation
   - If follow-up work identified
   - Update `links.depends_on` in successor items

**Triggers:**

- `"this work is done, close the work item"`
- `"finalize WI-015"`

## Integrated Workflows

### Scenario 1: Single Developer, Single Work Item

```
User: "Let's work on WI-015"

1. audit-backlog (validate WI-015 is ready)
2. update-work-item (status → in-progress, create branch)
3. [Coding & testing]
4. git-commit (conventional commits)
5. create-pr (push branch, create PR)
6. [Code review cycle]
7. handle-pr-feedback (fix issues)
8. process-pr (merge to main)
9. finalize-work-item (close, record metrics)
```

### Scenario 2: Parallel Work, Multiple Items

```
User: "Execute WI-005, WI-008, and WI-012 in parallel"

1. audit-backlog (ensure all 3 are ready, no conflicts)
2. parallel-execution (spawn agents for all 3):
   - Agent 1: update-work-item(WI-005), feature-branch-management, [code WI-005]
   - Agent 2: update-work-item(WI-008), feature-branch-management, [code WI-008]
   - Agent 3: update-work-item(WI-012), feature-branch-management, [code WI-012]
3. [Wait for all to reach PR stage]
4. sequential-execution (merge in dependency order):
   - WI-005 (no deps) → merge first
   - WI-008 (depends on 005) → merge second
   - WI-012 (depends on 008) → merge third
5. [All finalize in order]
```

### Scenario 3: Blocked Work, Dependencies Not Ready

```
User: "I want to work on WI-015 but WI-012 is still in-progress"

1. audit-backlog (identifies WI-015 → WI-012 dependency)
2. Skill suggests: "WI-012 must be closed first"
3. Options:
   a. "Work on WI-012 instead" → shift focus
   b. "Start WI-015 in draft branch, rebase when 012 lands"
   c. "Check progress on WI-012" → gh issues view WI-012
```

### Scenario 4: Major PR Feedback Requires Refactoring

```
User: "The review suggests a major architecture change"

1. handle-pr-feedback (categorize as blocker)
2. Understand the feedback:
   - Is it valid? (Request clarification if unclear)
   - Is it feasible? (Estimate effort impact)
   - Is there alternative? (Propose options)
3. Decide:
   a. Accept feedback → refactor feature branch
   b. Negotiate → discuss in PR thread
   c. Escalate → involve tech lead/architect
4. If major refactor:
   - update-work-item (adjust estimated hours)
   - Feature branch continues, rebuild locally
   - Push updates, re-request review
```

### Scenario 5: Test Failures in CI

```
User: "The PR checks are failing, help me debug"

1. get-pr-status (review which checks failed)
2. debugging-strategies (reproduce locally):
   - Clone repo, checkout feature branch
   - Run failing test locally: `pnpm test -- --testNamePattern="..."`
   - Inspect error message, stack trace
3. parallel-debugging (if multiple failures):
   - Investigate 2-3 hypotheses in parallel
   - Compare results, identify root cause
4. Fix code, run locally until passing
5. Push fix, confirm CI passes
6. Return to review process
```

## Configuration & Customization

### Work Item Metadata

Each work item has these key fields for lifecycle tracking:

```yaml
id: wi-015
type: work-item
subtype: feature
status: proposed|ready|in-progress|testing|closed
priority: critical|high|medium|low
estimated: 12 # hours
actual: 0 # hours (update as you work)
assignee: username

links:
  depends_on:
    - '[[004_feature_a]]'
    - '[[003_feature_b]]'

test_results:
  coverage: 0
  unit_tests: 0
  integration_tests: 0
```

### Skill Composition Pattern

When delegating to sub-skills, pass context:

```
Context for sub-skill:
- Current work item ID and metadata
- Feature branch name
- PR number (if exists)
- Related work items
- Testing requirements
- Timeline expectations
```

### Success Criteria

Work item is **successfully executed** when:

✅ Status is `closed`
✅ PR is merged to `main`
✅ Test coverage >80%
✅ All acceptance criteria met
✅ Metrics recorded (actual hours, tests, dates)
✅ Feature branch cleaned up
✅ No blocker feedback unresolved
✅ Documentation updated (if applicable)

## Common Pitfalls

1. **Starting work on blocked items**
   - Always verify `depends_on` items are `closed` first
   - Use `audit-backlog` to check before beginning

2. **Skipping tests**
   - Tests catch bugs before review
   - Low coverage makes reviews slower
   - Aim for >80% on new code

3. **Poor commit hygiene**
   - Don't commit `console.log()` or debug code
   - Squash WIP commits before PR
   - Write clear, descriptive messages

4. **Ignoring PR feedback**
   - Address all blockers
   - Don't dismiss comments without discussion
   - Assume reviewers have good intent

5. **Forgetting to finalize**
   - Work item metrics (actual hours, tests, dates)
   - Feature branch cleanup
   - Moving item to archive if using versioning

6. **Merging with unresolved dependencies**
   - Verify all `depends_on` items closed first
   - Don't merge features that block other WI

7. **Not updating documentation**
   - If feature changes user-facing behavior, update docs
   - Add ADRs for architectural decisions
   - Update API references if applicable

## Monitoring & Metrics

Track execution health:

- **Cycle time**: Time from `in-progress` to `closed`
- **Review rounds**: Number of feedback iterations
- **Test coverage**: Line coverage on completed work
- **Deployment frequency**: How often code hits production
- **Blocker rate**: % of work items blocked by dependencies
- **Rework rate**: % of closed work with subsequent fixes

**Monthly review:**

```bash
# Analyze recent work items
aggregate=$(for item in backlog/*.md; do
  status=$(grep "^status:" "$item" | cut -d' ' -f2)
  actual=$(grep "^actual:" "$item" | cut -d' ' -f2)
  completed=$(grep "^completed_date:" "$item" | cut -d' ' -f2)
  echo "$status; actual=$actual; completed=$completed"
done)
```

## References

- [Audit Backlog](../audit-backlog/SKILL.md) - Validate work item dependencies
- [Create Work Item](../create-work-item/SKILL.md) - Author new backlog items
- [Update Work Item](../update-work-item/SKILL.md) - Progress status and tracking
- [Finalize Work Item](../finalize-work-item/SKILL.md) - Close completed work
- [Feature Branch Management](../feature-branch-management/SKILL.md) - Git branch ops
- [Git Commit](../git-commit/SKILL.md) - Conventional commit messages
- [Create PR](../create-pr/SKILL.md) - Push code and create pull request
- [Process PR](../process-pr/SKILL.md) - Review and merge workflow
- [Handle PR Feedback](../handle-pr-feedback/SKILL.md) - Address review comments
- [JavaScript Testing Patterns](../javascript-testing-patterns/SKILL.md)
- [TypeScript Advanced Types](../typescript-advanced-types/SKILL.md)
- [Debugging Strategies](../debugging-strategies/SKILL.md)
- [Task Coordination Strategies](../task-coordination-strategies/SKILL.md)

## Metadata

- **Complexity**: High - orchestrates 25+ sub-skills
- **Frequency**: Daily during active development
- **Duration**: Varies (minutes for small fixes, days for large features)
- **Lifecycle**: Repeating for each work item in backlog
- **Triggers**: "execute backlog", "implement work item", "work on WI-NNN"
