---
id: root-001
type: document
subtype: prompt
lifecycle: active
status: ready
title: Workspace Manager
description: Agent for managing work items in backlog/
---

## Agent Routing Rules

- **Proximity Principle**: ALWAYS check for AGENTS.md files in the directory closest to your working context
- **Backlog Work**: If editing `backlog/**`, read `backlog/AGENTS.md` first
- **Source Code**: If editing `src/packages/{core,cli,volar}`, read respective package AGENTS.md
- **Documentation**: If editing `docs/**`, read `docs/AGENTS.md`
- **Skills Development**: If editing `skills/**`, read `skills/AGENTS.md`

## Fallback Instructions

If no specific AGENTS.md exists for your working context:

1. Check parent directories for AGENTS.md files
2. Do NOT modify AGENTS.md files without explicit consent
3. Do NOT modify _config_ files (e.g. vitest.config.ts) without explicit consent
4. For skills that delegate work, run in parallel, or split efforts across workspaces, compose `skills/aspects/sandboxing-workspace/SKILL.md`
5. NEVER use --no-verify to bypass local hooks
6. Manage atomic, discrete version control changesets
7. Follow project conventions in MIGRATION_PLAN.md and relevant ADRs
8. Maintain work item frontmatter alignment with schemas in `schemas/frontmatter/`

## Version Management

### Critical Constraint: Fixed Versioning

All 5 workspace packages **must maintain synchronized versions**:

- `@templjs/core`
- `@templjs/cli`
- `@templjs/volar`
- `@templjs/context-graph`
- `vscode-templjs`

Configuration: [`.changeset/config.json`](.changeset/config.json)

### Agents: MUST Use Changesets, NEVER Manual Edits

**✅ CORRECT**: Use `pnpm changeset` to create version entries

```bash
pnpm changeset
# Select all affected packages
# Choose semver bump (patch|minor|major)
# Commit .changeset/*.md
```

**❌ NEVER**: Manually edit `package.json` versions directly

This breaks automation and creates version misalignment. Example anti-patterns:

- `sed -i 's/"version": "1.0.0"/"version": "1.1.0"/g' package.json`
- Manual bumps without changeset entries
- Selective version bumps (some packages at 1.0.0, others at 1.1.0)

### Workflow for Agents Implementing Features

1. **Make code changes** in feature branch
2. **Run tests & linting** before PR
3. **Create changeset**: `pnpm changeset`
   - If multiple unrelated changes: one changeset per logical change
   - Select all affected packages (usually all 5 stay synchronized)
   - Write changelog entry from user perspective
4. **Commit changeset**: `git add .changeset/ && git commit`
5. **Push feature branch** with changeset included
6. **Do NOT merge Version Packages PR** yourself—maintain versions; let maintainers handle release automation

### Verification Before Pushing

```bash
# Verify changeset was created
ls -la .changeset/*.md

# Verify content includes all changed packages
cat .changeset/<name>.md

# Verify no manual package.json edits
git diff package.json  # should show no version changes
```

## Commands

- Commit: Use `git-commit` skill
- **Version management**: Always use `pnpm changeset`, never manual edits
