---
name: hybrid-decision-analysis
description: 'Hybrid comparative decision workflow with mandatory discovery (including external options), criteria derivation and confirmation, explicit evidence discipline, hard-constraint gating, and deterministic scoring. Use when selecting skills, tools, architectures, workflows, vendors, or build-vs-buy options and when you need reliable, auditable recommendations.'
---

# Hybrid Decision Analysis

Produce a defensible decision by combining:

- `skill-reviewer` strengths: criteria confirmation, evidence notes, quality gates.
- `comparative-analysis` strengths: deterministic scoring and ranking.
- `comparative-decision-review` strengths: explicit score scale, effort and risk tie-breaks, coverage visibility.

## Inputs

- Decision statement.
- Current platform.
- Primary user and workflow context.
- Hard constraints and non-goals.
- Time horizon.
- Initial alternatives or discovery scope.

## Workflow

1. Frame decision and constraints.
2. Run discovery from `references/discovery-protocol.md`.
   - Include internal options, compose/extend variants, and external alternatives.
   - Include at least one external option unless explicitly blocked.
3. Normalize alternatives.
   - Require at least two alternatives before scoring.
   - Mark each alternative `feasible` or `infeasible`.
4. Derive criteria from intended use.
   - Use `references/rubric-packs.md` as a starting point, then adapt.
5. Confirm criteria, weights, scale, and platform set.
6. Prepare input using `references/input-schema.md`.
7. Score with guardrails:

   ```bash
   python3 skills/hybrid-decision-analysis/scripts/score_with_guardrails.py \
     --input <analysis-input.json> \
     --output <analysis-report.md> \
     --json-output <analysis-result.json>
   ```

8. Run reliability checks.
   - Use `references/scenario-bakeoff-protocol.md` for bakeoff evaluation.
   - Run sensitivity checks for close results.
9. Validate contracts:

   ```bash
   node skills/hybrid-decision-analysis/scripts/validate_json_contract.mjs \
     --schema skills/hybrid-decision-analysis/references/input.schema.json \
     --data <analysis-input.json>
   node skills/hybrid-decision-analysis/scripts/validate_json_contract.mjs \
     --schema skills/hybrid-decision-analysis/references/output.schema.json \
     --data <analysis-result.json>
   ```

10. Produce record using `assets/hybrid-decision-record-template.md`.

## Required Guarantees

- Require at least two alternatives for recommendation scoring.
- Require criteria fields: `metric`, `data_source`, `scoring_rule`.
- Treat missing evidence as missing, not zero.
- Exclude missing criterion values from weighted averages.
- Track coverage and gate `select` or `compose` on minimum coverage.
- Never recommend an `infeasible` option unless all options are infeasible.
- Always expose decision status as `proceed`, `defer`, or `no-go`.
- Include explicit per-option justification in final output.
- Include all identified alternatives in the ranked record.

## Testing

Run guardrail tests before relying on a scoring-script change:

```bash
python3 skills/hybrid-decision-analysis/scripts/test_score_with_guardrails.py
node skills/hybrid-decision-analysis/scripts/validate_json_contract.mjs \
  --schema skills/hybrid-decision-analysis/references/input.schema.json \
  --data <analysis-input.json>
node skills/hybrid-decision-analysis/scripts/validate_json_contract.mjs \
  --schema skills/hybrid-decision-analysis/references/output.schema.json \
  --data <analysis-result.json>
```

## References

- Discovery protocol: `references/discovery-protocol.md`
- Input contract: `references/input-schema.md`
- Input JSON Schema: `references/input.schema.json`
- Output contract: `references/output-schema.md`
- Output JSON Schema: `references/output.schema.json`
- Rubric packs: `references/rubric-packs.md`
- Quality gates: `references/quality-gates.md`
- Bakeoff protocol: `references/scenario-bakeoff-protocol.md`
- Reusable bakeoff fixture: `assets/bakeoff-fixture.v1.json`
- Reusable bakeoff results template: `assets/bakeoff-results-template.v1.json`
- Decision record template: `assets/hybrid-decision-record-template.md`
