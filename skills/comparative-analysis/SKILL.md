---
name: comparative-analysis
description: Structured, repeatable, objective comparative analysis for choosing between alternatives. Use when selecting skills, tools, architectures, workflows, or build-vs-buy options and when you need explicit criteria definition, metric-based scoring, cross-platform and current-platform success scores, and a deterministic recommendation with a concise decision record.
---

# Comparative Analysis

## Overview

Produce an auditable decision from explicit criteria, evidence, and deterministic scoring. Run this workflow in order and do not skip criteria confirmation.

## Workflow

1. Define the intended use and constraints.
2. Identify and normalize alternatives (`find-skills` + `decision-helper`).
3. Derive criteria and metrics, then request confirmation.
4. Evaluate each alternative against the agreed criteria.
5. Compute deterministic scores and rank options.
6. Issue an opinionated recommendation and capture a decision record.

## Step 1: Define Intended Use

Capture:

- Decision statement (one sentence).
- Primary user and workflow context.
- Hard constraints (must-have requirements, blockers).
- Time horizon (immediate/near-term/long-term).
- Current LLM platform (for platform-specific score).

Reject vague requests by converting them into a specific decision question before continuing.

## Step 2: Identify Alternatives

Identify alternatives with two sources:

1. Use `find-skills` to discover installable or existing options.
2. Use `decision-helper` to normalize each option with pros/cons and risk notes.

Always include at least three alternatives when possible, including baseline options:

- Reuse/select existing option.
- Compose/extend existing options.
- Build new.

## Step 3: Derive Criteria and Confirm

Create 5-9 weighted criteria. For each criterion, define:

- `id` (stable key, kebab-case).
- `name` (human-readable label).
- `weight` (non-negative numeric weight).
- `metric` (how to measure it).
- `data_source` (evidence source).
- `scoring_rule` (0-100 scoring guidance).

Then ask for explicit user confirmation:

- Confirm criteria list.
- Confirm weights.
- Confirm major platform set.

Do not score until criteria are confirmed.

Use `references/input-schema.md` for input structure.

## Step 4: Evaluate Alternatives

For each alternative:

1. Collect evidence per criterion and platform.
2. Assign criterion scores (0-100) per platform.
3. Record missing evidence explicitly.

Use major platforms:

- Default: `chatgpt`, `claude`, `gemini`, `copilot`.
- Override only when user specifies a different set.

## Step 5: Compute Deterministic Scores

Run:

```bash
python3 skills/workflow/comparative-analysis/scripts/score_alternatives.py \
  --input <analysis-input.json> \
  --output <analysis-report.md> \
  --json-output <analysis-result.json>
```

The script computes:

- Per-platform weighted score.
- `major_platform_average`: mean weighted score across major platforms.
- `current_platform_score`: weighted score for current platform.
- `overall_success_score`: `0.6 * major_platform_average + 0.4 * current_platform_score`.

Ranking is deterministic:

1. `overall_success_score` descending
2. `current_platform_score` descending
3. `major_platform_average` descending
4. `name` ascending

## Step 6: Make Opinionated Recommendation

Use deterministic action rules:

- `select`: top score high and clearly ahead.
- `compose`: top two close and both strong.
- `improve`: top option viable but below direct-select threshold.
- `extend`: top option strong overall but weak on current platform.
- `build-new`: no option meets minimum viability.

Always include:

- Ranked list of all options.
- Action and chosen option(s).
- Justification with concrete score deltas.
- Key risks and follow-up actions.

## Decision Record Output

If the user provides a template, populate it exactly.

Otherwise, use `assets/comparative-analysis-record-template.md` and keep it concise. Include:

- Decision statement and context.
- Confirmed criteria and weights.
- Ranked alternatives with two headline scores:
  - major platform average
  - current platform score
- Final recommendation and rationale.
