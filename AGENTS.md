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

## Commands

- Commit: Use `git-commit` skill
