# Scenario Bakeoff Protocol

Use this when decision confidence depends on real output behavior, not only static analysis.

Starter fixture:

- Scenario and rubric baseline: `../assets/bakeoff-fixture.v1.json`
- Empty score sheet: `../assets/bakeoff-results-template.v1.json`

## When Bakeoff Is Required

- User asks for empirical comparison.
- High-stakes decision (safety, security, compliance, major spend, or incident response).
- Top options are close after static scoring.
- Static evidence has significant gaps.

## Scenario Design

- Create `3-5` scenarios.
- Cover normal path, edge case, and failure or time-critical case.
- Keep the same prompt structure for every option.
- Keep constraints explicit and measurable in each scenario.

## Execution Rules

- Run each option on all scenarios.
- Do not change rubric or prompts between options.
- Capture raw outputs and key metadata:
  - runtime notes
  - failure modes
  - missing evidence

## Judge Rubric (0-100)

| criterion_id               | name                           | weight |
| -------------------------- | ------------------------------ | -----: |
| output-spec-compliance     | Output spec compliance         |     25 |
| constraint-adherence       | Constraint adherence           |     25 |
| internal-consistency-rigor | Internal consistency and rigor |     25 |
| evidence-gap-handling      | Evidence-gap handling          |     15 |
| actionability              | Actionability                  |     10 |

## Aggregation

- Scenario score per option:
  - weighted sum of judge rubric criteria.
- Bakeoff score per option:
  - mean of scenario scores.
- If bakeoff score is used in final decision:
  - map it into `scenario-performance` criterion in the main rubric.

## Reliability Checks

- If top two final scores differ by less than `5` points, run sensitivity check:
  - perturb each criterion weight by plus/minus `10%`, renormalize, recompute.
- Flag unstable outcome if winner changes in more than `30%` of perturbations.
- If unstable, recommend `compose` or request more evidence.
