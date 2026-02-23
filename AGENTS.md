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
2. Manage atomic, discrete changesets
3. Follow project conventions in MIGRATION_PLAN.md and relevant ADRs
4. Maintain work item frontmatter alignment with schemas in `schemas/frontmatter/`

## Commands

- Commit: Use `git-commit` skill
