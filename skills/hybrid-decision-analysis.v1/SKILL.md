---
name: hybrid-decision-analysis.v1
description: 'Hybrid decision workflow that combines expert rubric design, explicit evidence capture, hard-constraint gating, scenario bakeoffs, and deterministic scoring. Use when selecting skills, tools, architectures, workflows, or build-vs-buy options and when you need consistent, reliable, and auditable recommendations.'
---

# Hybrid Decision Analysis

Combine expert rubric-based review with deterministic scoring to produce reliable decisions across domains.

## When to Use This Skill

- You must choose between two or more options and need an auditable answer.
- The decision spans skills, tools, architecture, workflow design, or build-vs-buy.
- You need both current-platform fit and cross-platform viability.
- The user asks for objective ranking, repeatable scoring, or empirical bakeoff evidence.

## Inputs

- Decision statement (one sentence).
- Current platform.
- Primary user/workflow context.
- Hard constraints and non-goals.
- Time horizon (immediate, near-term, long-term).
- Initial alternatives (or discovery scope).

## Workflow

1. Define decision and constraints.
2. Build option set with at least three alternatives when possible.
3. Choose evaluation mode:
   - `static`: document and architecture evidence only.
   - `bakeoff`: scenario-based output testing.
   - `hybrid` (default): static + bakeoff evidence.
4. Select a rubric pack from `references/rubric-packs.md`.
5. Confirm criteria, weights, platform set, and mode before scoring.
6. Evaluate each alternative against the same rubric.
7. Apply hard-constraint gate:
   - Mark alternatives as `feasible` or `infeasible`.
   - Do not recommend an `infeasible` option unless all are infeasible.
8. Score deterministically with:

   ```bash
   python3 skills/comparative-analysis/scripts/score_alternatives.py \
     --input <analysis-input.json> \
     --output <analysis-report.md> \
     --json-output <analysis-result.json>
   ```

9. Run reliability checks from `references/scenario-bakeoff-protocol.md`:
   - Coverage and evidence-gap check.
   - Recommendation-consistency check (rank, constraints, action alignment).
   - Optional weight-sensitivity check for close scores.
10. Produce recommendation and decision record using `assets/hybrid-decision-record-template.md`.

## Evidence and Scoring Rules

- Use one rubric for all options in a run.
- Each criterion must include:
  - `id`
  - `name`
  - `weight`
  - `metric`
  - `data_source`
  - `scoring_rule`
- Use 0-100 criterion scoring for deterministic aggregation.
- If raw rubric is 1-5, convert with `score_100 = score_5 * 20`.
- Record missing evidence as gaps, not assumptions.

## Recommendation Actions

- `select`: top option is strong and clearly ahead.
- `compose`: top two are both strong and close.
- `improve`: best option is viable but below direct-select threshold.
- `extend`: best option is strong overall but weak on current platform.
- `build-new`: no viable option meets minimum requirements.

Always justify action with concrete score deltas and feasibility status.

## Output Requirements

- Ranked list of all options.
- Feasibility status (`feasible` or `infeasible`) per option.
- Major-platform average and current-platform score.
- Final action and chosen option(s).
- Key risks, evidence gaps, and follow-up actions.

## Quality Gates

- Do not score before criteria confirmation unless user explicitly asks for one-shot output.
- If one-shot output is required, state assumptions explicitly.
- Do not rank options using different rubrics.
- Do not hide hard-constraint violations inside averaged scores.
- Keep rationale short and evidence-linked.

## References

- Rubric packs: `references/rubric-packs.md`
- Bakeoff protocol: `references/scenario-bakeoff-protocol.md`
- Reusable bakeoff fixture: `assets/bakeoff-fixture.v1.json`
- Reusable bakeoff results template: `assets/bakeoff-results-template.v1.json`
- Deterministic input schema: `../comparative-analysis/references/input-schema.md`
- Decision record template: `assets/hybrid-decision-record-template.md`
