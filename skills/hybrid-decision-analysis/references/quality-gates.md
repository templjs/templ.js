# Quality Gates

Apply these gates on every run.

## Pre-Scoring Gates

- Criteria are confirmed.
- Criteria include `metric`, `data_source`, and `scoring_rule`.
- One rubric only per run.
- At least 2 alternatives for scoring.
- Discovery includes at least 1 external option, or a documented blocker.
- Input validates against `references/input.schema.json`.

## Scoring Gates

- Missing scores are `null`, never silently coerced to zero.
- Coverage is computed per option.
- `select` and `compose` require `coverage >= min_coverage`.
- Infeasible options cannot be recommended unless all options are infeasible.

## Output Gates

- Rank all alternatives that were identified.
- Include explicit per-option justification.
- Include feasibility status for each option.
- Include decision status (`proceed|defer|no-go`).
- Include risks, evidence gaps, and follow-up actions.
- Output validates against `references/output.schema.json`.

## Regression Gates

Run:

```bash
python3 skills/hybrid-decision-analysis/scripts/test_score_with_guardrails.py
node skills/hybrid-decision-analysis/scripts/validate_json_contract.mjs \
  --schema skills/hybrid-decision-analysis/references/input.schema.json \
  --data <analysis-input.json>
node skills/hybrid-decision-analysis/scripts/validate_json_contract.mjs \
  --schema skills/hybrid-decision-analysis/references/output.schema.json \
  --data <analysis-result.json>
```

Required test coverage in this suite:

- tie-break ordering
- missing-evidence handling
- single-option behavior
- coverage-gated recommendation behavior
