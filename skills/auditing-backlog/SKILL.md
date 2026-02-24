---
name: auditing-backlog
description: 'Perform comprehensive dependency analysis and health checks on work item backlog. Use when asked to "audit backlog", "check work item dependencies", "find missing dependencies", "analyze work items", or before major releases to validate backlog integrity. Includes bidirectional dependency analysis, orphan detection, and consistency checks.'
---

# Audit Backlog

Comprehensive backlog health check that performs bidirectional dependency analysis, orphan detection, consistency validation, and work item graph integrity checks. This skill codifies the manual analysis workflow for ensuring work item dependencies are complete and accurate.

## When to Use This Skill

- User asks to "audit the backlog", "check work item dependencies", or "validate work items"
- Before major releases to ensure dependency graph is complete
- After bulk backlog updates to verify consistency
- When investigating why work items might be blocked
- During sprint planning to identify work that's ready to start
- Answering "are there orphaned work items?" or "what's missing dependencies?"

## Prerequisites

- Work items in `backlog/*.md` with YAML frontmatter
- Work item schema at `schemas/frontmatter/by-type/work-item/latest.json`
- Work items have `links.depends_on` arrays with `[[wikilink]]` format
- Validation script via `pnpm run lint:frontmatter`

## Step-by-Step Audit Workflow

### Phase 1: Schema & Scriptable Validation

Run the automated validation script first to catch schema violations:

```bash
cd /path/to/repo
pnpm run lint:frontmatter
```

**What it checks:**

- YAML frontmatter schema compliance
- Required fields present (id, type, status, title)
- Status transition validity
- Dependency references exist
- Dependencies in "closed" status before dependents can progress

**If violations found:** Fix schema issues before proceeding to manual analysis.

### Phase 2: Forward Dependency Analysis (Orphan Detection)

**Goal:** Find work items that are NEVER referenced as dependencies (orphans).

**Method:**

1. List all work item files: `ls -1 backlog/*.md | sed 's/.md$//' | sed 's/backlog\///'`
2. For each work item, search if it appears in ANY `depends_on` array:

   ```bash
   grep -r "\\[\\[$(basename "$file" .md)\\]\\]" backlog/*.md
   ```

3. If zero matches → work item is orphaned

**Heuristics for orphans:**

- **Root nodes** (e.g., `001_github_organization`): Expected to have 0 dependencies, likely not orphaned
- **Infrastructure** (monorepo setup, CI/CD): Should be dependencies of many items
- **Feature implementations**: Should be dependencies of release work items
- **Test work items**: Should be dependencies of release work items
- **Documentation**: Should be dependency of release or examples

**Common fixes:**

- Add to release work item (`022_release_v1.md`) if part of v1.0 scope
- Add to parent epic if it's a sub-task
- Add to dependent features that require it

**Example from recent audit:**

```
WI-022 (Release v1.0) was missing dependencies on:
- All test work items (009, 010, 011, 016)
- IDE features (013, 014, 015)
- CLI features (018, 019)
- Documentation (020)
```

### Phase 3: Reverse Dependency Analysis (Minimal Dependency Detection)

**Goal:** Find work items with suspiciously FEW dependencies that might be missing logical prerequisites.

**Method:**

1. Count dependencies per work item:

   ```bash
   cd backlog
   for file in *.md; do
     deps=$(grep -A 20 "depends_on:" "$file" 2>/dev/null | grep "\[\[" | wc -l)
     echo "$deps $file"
   done | sort -n
   ```

2. Focus on work items with **0-2 dependencies** (excluding root nodes)

3. For each, read the frontmatter and ask:
   - Does it require **infrastructure** (001, 002, 003, 004)?
   - Does it depend on **core implementations** (005 lexer, 006 parser, 007 renderer)?
   - Does it depend on **schemas or validation** (025, 024)?
   - Does it depend on **base features** before extending them?
   - Does the title say "X AND Y" but only depend on X?

**Common patterns to check:**

| Work Item Type    | Likely Dependencies                                    |
| ----------------- | ------------------------------------------------------ |
| TypeScript code   | `[[002_monorepo_setup]]`                               |
| Schema validation | `[[025_schema_validation]]`                            |
| Tests for X       | `[[<X_implementation>]]`                               |
| IDE features      | `[[012_volar_plugin]]`, `[[027_virtual_code_mapping]]` |
| CLI features      | `[[017_cli_commands]]`                                 |
| Release work item | All deliverable features in scope                      |
| Documentation     | Features being documented                              |
| CI/CD artifact    | `[[003_github_actions]]`, `[[004_precommit_hooks]]`    |

**Example fixes from recent audit:**

```
WI-024 (Work Item Guardrails) had 1 dependency [001]:
❌ Missing [[002_monorepo_setup]] - it's a TypeScript validation script
❌ Missing [[025_schema_validation]] - it validates against schemas
→ Added both dependencies

WI-026 (CI/CD Scaffolding) had 1 dependency [003]:
❌ Missing [[004_precommit_hooks]] - doc covers BOTH CI/CD and pre-commit
→ Added dependency

WI-011 (Renderer Tests) had 1 dependency [007]:
❌ Missing [[008_query_engine]] - title says "Renderer AND Query Engine Tests"
→ Added dependency
```

### Phase 4: Dependency Pattern Validation

**Goal:** Verify dependency chains follow logical implementation order.

**Common patterns to verify:**

1. **Core Pipeline:**

   ```
   005 (Lexer) → 006 (Parser) → 007 (Renderer) → 008 (Query Engine)
   ```

2. **Testing follows implementation:**

   ```
   005 (Lexer) → 009 (Lexer Tests)
   006 (Parser) → 010 (Parser Tests)
   007 (Renderer) + 008 (Query) → 011 (Renderer Tests)
   ```

3. **IDE features require base:**

   ```
   012 (Volar Plugin) → 013/014/015 (IDE features)
   027 (Virtual Code Mapping) → 013/014/015
   ```

4. **CLI features require base:**

   ```
   017 (CLI Commands) → 018/019/021/029 (CLI features)
   ```

5. **Infrastructure cascade:**

   ```
   001 (GitHub) → 002 (Monorepo) → {003 (GH Actions), 004 (Pre-commit), ...}
   ```

**Method:**

- For each pattern, verify the chain exists
- Check for logical gaps (e.g., Y depends on Z but not X, when X→Y→Z is required)
- Verify siblings in a group have consistent dependencies

### Phase 5: Consistency Checks

**Non-scriptable heuristics:**

1. **Title vs Dependencies:**
   - If title says "X and Y", check it depends on both X and Y
   - If title says "X Tests", check it depends on X implementation

2. **Status Consistency:**
   - If status is `in-progress`, all `depends_on` items should be `closed` or `completed`
   - If status is `completed`, it should be a dependency of at least one other item (unless it's terminal like Release)

3. **Effort Realism:**
   - Work items with 0 dependencies but high effort are suspicious
   - Work items that depend on 10+ items should have HIGH effort

4. **Type Alignment:**
   - `epic` work items should have other items depending on them
   - `task` work items shouldn't typically be depended on by many items

5. **ID Gaps:**
   - Check for missing numbers in sequence (001, 002, 004 ← 003 missing?)
   - Verify no duplicate IDs

6. **Circular Dependencies:**
   - While rare, check for cycles: A→B→C→A
   - Build adjacency list and run cycle detection if suspected

### Phase 6: Apply Fixes

Once gaps are identified:

1. **Batch updates:** Use `multi_replace_string_in_file` for efficiency on multiple work items
2. **Commit pattern:** `feat(backlog): enhance work item dependencies`
3. **Re-run validation:** `pnpm run lint:frontmatter`

**Example batch update:**

```typescript
multi_replace_string_in_file({
  replacements: [
    {
      filePath: '/path/to/backlog/024_work_item_guardrails.md',
      oldString: "links:\n  depends_on:\n    - '[[001_github_organization]]'",
      newString:
        "links:\n  depends_on:\n    - '[[001_github_organization]]'\n    - '[[002_monorepo_setup]]'\n    - '[[025_schema_validation]]'",
    },
    // ... more replacements
  ],
});
```

## Deliverables

- **Audit Report:** Summary of findings (orphans, minimal-dep items, pattern violations)
- **Updated Work Items:** Files with added dependencies
- **Git Commit:** Conventional commit with audit rationale
- **Validation Confirmation:** Clean run of `lint:frontmatter`

## Common Pitfalls

1. **False positives for root nodes:** 001 (GitHub org) has 0 dependencies by design
2. **Over-correction:** Not every 2-dependency item needs more; evaluate individually
3. **Forgetting both directions:** Check BOTH "who depends on me" AND "who should I depend on"
4. **Ignoring schema first:** Always run scripted validation before manual analysis
5. **Missing commit:** Don't leave changes uncommitted after audit

## Example Output Summary

```
Backlog Audit Results:
======================

Phase 1: Schema Validation
✅ All 29 work items passed schema validation

Phase 2: Forward Analysis (Orphan Detection)
❌ Found 8 work items never referenced as dependencies:
   - WI-009, 010, 011 (test work items) → Should be deps of WI-022 (Release)
   - WI-013, 014, 015 (IDE features) → Should be deps of WI-022
   - WI-018, 019 (CLI features) → Should be deps of WI-022
   → Fixed: Added all to WI-022 depends_on

Phase 3: Reverse Analysis (Minimal Dependencies)
❌ Found 3 work items with <3 deps that need more:
   - WI-024 (Guardrails): 1 dep → Added 002, 025
   - WI-026 (CI/CD): 1 dep → Added 004
   - WI-011 (Tests): 1 dep → Added 008
   → Fixed: Added missing dependencies

Phase 4: Pattern Validation
✅ Core pipeline chain: 005→006→007→008 ✓
✅ Test dependencies: 005→009, 006→010, 007+008→011 ✓
✅ IDE features: 012→013/014/015, 027→013/014/015 ✓
✅ CLI features: 017→018/019/021/029 ✓
✅ Infrastructure: 001→002→003/004/... ✓

Phase 5: Consistency Checks
✅ All titles match dependency scope
✅ No circular dependencies detected
✅ No ID gaps in 001-029 sequence
✅ Epic work items have dependents

Summary: Fixed 11 dependency gaps across 8 work items
Committed: feat(backlog): add comprehensive dependency graph and enhance validation
```

## References

- [Package Scripts](package.json)
- [Backlog Directory](backlog/)

## Troubleshooting

**Q: Script says dependency doesn't exist, but file is there**

- A: Check wikilink format: `[[filename_without_extension]]` not `[[filename.md]]`
- A: Verify filename matches exactly (case-sensitive, underscores vs hyphens)

**Q: Work item has many dependencies but audit says it needs more**

- A: Review if dependencies are DIRECT vs TRANSITIVE. Only include direct prerequisites.

**Q: Circular dependency detected**

- A: Refactor one work item into two: prerequisite and dependent parts
- A: Check if relationship should be reversed

**Q: Release work item has 20+ dependencies**

- A: This is expected for milestone/release work items that gate on all deliverables

## Metadata

- **Frequency:** Run before each major release, after bulk backlog updates
- **Duration:** 15-30 minutes for 30-50 work items
- **Automation:** Phases 1-3 can be scripted; Phases 4-5 require judgment
- **Complementary Skills:** `update-work-item`, `create-work-item`, `finalize-work-item`
