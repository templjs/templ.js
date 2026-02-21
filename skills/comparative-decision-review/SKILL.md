---
name: comparative-decision-review
description: Structured and deterministic comparative decision workflow that combines mandatory rubric confirmation and evidence discipline with deterministic multi-platform scoring, ranking, and action rules. Use when selecting skills, tools, architectures, workflows, vendors, or build-vs-buy options and when you need explicit criteria, consistent scoring, tie-break logic, and an auditable decision record.
---

# Comparative Decision Review

## Overview

Produce a defensible decision from explicit criteria, confirmed weights, evidence-backed scores, and deterministic ranking.

This skill combines:

- `skill-reviewer` strengths: confirmation gate, consistent rubric use, explicit evidence notes, quality gates.
- `comparative-analysis` strengths: deterministic score computation, ranking, action thresholds, and concise decision records.

## Workflow

### Phase 1: Frame the Decision and Option Set

#### 1. Clarify intended use

Capture:

- Decision statement (one sentence).
- Primary users and operating context.
- Hard constraints and non-goals.
- Time horizon (immediate, near-term, long-term).
- Current platform (if platform-specific fit matters).

Convert vague requests into a specific decision question before continuing.

#### 2. Build normalized alternatives

Include at least three alternatives when possible:

- Select/reuse existing option.
- Improve or extend existing option.
- Compose multiple options.
- Build new (or buy, for build-vs-buy decisions).

For each alternative, capture:

- `effort`: `S`, `M`, or `L`
- `risk`: `Low`, `Med`, or `High`
- Key dependencies
- Major unknowns

### Phase 2: Criteria Design and Confirmation Gate (Required)

#### 3. Choose and tailor criteria

Start from `references/rubric-packs.md`.

Use 5-9 criteria and ensure weights total `100`.

For each criterion define:

- `id` (stable key, kebab-case)
- `name`
- `weight`
- `metric`
- `data_source`
- `scoring_rule` (for `1-5` or `0-100`)

#### 4. Confirmation checkpoint

Before scoring, request explicit confirmation of:

- Criteria list
- Weights
- Score scale (`1-5` or `0-100`)
- Major platform set
- Current platform

Do not score if confirmation is missing.

### Phase 3: Evidence and Deterministic Scoring

#### 5. Collect evidence per criterion

For each alternative and platform:

1. Record evidence notes per criterion.
2. Mark missing evidence as a gap (do not invent data).
3. Assign criterion scores using confirmed scale.

#### 6. Compute scores with script

Run:

```bash
python3 skills/workflow/comparative-decision-review/scripts/score_options.py \
  --input <analysis-input.json> \
  --output <analysis-report.md> \
  --json-output <analysis-result.json>
```

Script behavior:

- Supports score scale `1-5` or `0-100`.
- Computes weighted per-platform scores (`0-100`).
- Computes:
  - `major_platform_average`
  - `current_platform_score`
  - `overall_success_score = 0.6 * major_platform_average + 0.4 * current_platform_score`
- Computes `coverage` from missing criterion values.

### Phase 4: Rank, Recommend, and Record

#### 7. Rank deterministically

Ranking order:

1. `overall_success_score` (desc)
2. `current_platform_score` (desc)
3. `major_platform_average` (desc)
4. `effort` (`S` before `M` before `L`)
5. `risk` (`Low` before `Med` before `High`)
6. `name` (asc)

#### 8. Apply deterministic action rules

Default actions:

- `select`: top score high and clearly ahead
- `compose`: top two are strong and close
- `improve`: top is viable but below direct-select threshold
- `extend`: top is strong overall but weak on current platform
- `build-new`: no option meets minimum viability

#### 9. Create comparative decision record

If user provides a template, populate it exactly.

Otherwise use `assets/comparative-decision-record-template.md`.

Always include:

- Ranked options with scores
- Selected action and chosen option(s)
- Score delta vs second option
- Key risks
- Evidence gaps and follow-up actions

## Required Inputs

Use `references/input-schema.md` for JSON format.

Minimum required fields:

- `decision`
- `criteria_confirmed` (must be `true`)
- `current_platform`
- `criteria`
- `alternatives`

## Quality Gates

- Do not score before criteria confirmation.
- Use one rubric for all options in the same run.
- Mark missing evidence explicitly as gaps.
- Keep recommendation rationale tied to score deltas.
- Preserve deterministic ranking and tie-break rules.
