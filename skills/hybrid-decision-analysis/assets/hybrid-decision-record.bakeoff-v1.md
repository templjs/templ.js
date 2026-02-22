# Hybrid Decision Record

- Date: `2026-02-20`
- Reviewer: `Codex`
- Decision statement: `Select the most reliable decision workflow option from the bakeoff fixture.`
- Current platform: `chatgpt`
- Major platforms: `chatgpt, claude, gemini, copilot`
- Evaluation mode: `hybrid`

## Intended Use

- Primary user/workflow: `Single agent selecting among decision workflows for skills/tools/architectures/workflows/build-vs-buy with deterministic ranking and evidence trace.`
- Hard constraints: `One-shot scenario execution; hard-constraint violations must be penalized; reproducible scoring required.`
- Non-goals: `Optimizing prose style or brevity independent of decision quality.`
- Time horizon: `immediate`

## Confirmed Criteria

| Criterion                       | Weight | Metric                                                   | Data Source                                                                 | Scoring Rule |
| ------------------------------- | -----: | -------------------------------------------------------- | --------------------------------------------------------------------------- | ------------ |
| `hard-constraint-compliance`    | `0.18` | Avoids ranking infeasible choices above feasible ones    | `bakeoff scored outputs`                                                    | `0-100`      |
| `objective-measurability`       | `0.16` | Deterministic scoring support and evidence trace quality | `skill docs + bakeoff outputs`                                              | `0-100`      |
| `workflow-rigor-repeatability`  | `0.14` | Consistency of method and recommendation logic           | `skill docs + bakeoff outputs`                                              | `0-100`      |
| `use-case-coverage`             | `0.14` | Coverage across selection contexts                       | `skill docs`                                                                | `0-100`      |
| `maintainability-extensibility` | `0.10` | Ease of updates without regressions                      | `skill docs`                                                                | `0-100`      |
| `adoption-cost-time-to-value`   | `0.08` | Execution overhead and time-to-value                     | `bakeoff observations`                                                      | `0-100`      |
| `platform-portability`          | `0.07` | Consistency across major platforms                       | `skill docs`                                                                | `0-100`      |
| `risk-safety`                   | `0.05` | Unsafe recommendation likelihood under constraints       | `incident-focused scenario outputs`                                         | `0-100`      |
| `scenario-performance`          | `0.08` | Average fixture performance                              | `skills/hybrid-decision-analysis/assets/bakeoff-aggregate.v1.executed.json` | `0-100`      |

## Alternatives

| Rank | Option                 | Feasible | Major Platform Avg | Current Platform Score | Overall Success | Action Hint |
| ---: | ---------------------- | -------- | -----------------: | ---------------------: | --------------: | ----------- |
|    1 | `compose-both`         | `yes`    |            `91.41` |                `91.41` |         `91.41` | `compose`   |
|    2 | `comparative-analysis` | `yes`    |            `89.61` |                `89.61` |         `89.61` | `compose`   |
|    3 | `skill-reviewer`       | `yes`    |            `84.53` |                `84.53` |         `84.53` | `improve`   |

## Recommendation

- Action: `compose`
- Chosen option(s): `compose-both`, `comparative-analysis`
- Justification: `Top option is strong and close to second (delta 1.80). compose-both is strongest in scenario performance (92.33 avg) and consistency; comparative-analysis contributes lower overhead and strong deterministic measurability.`
- Risks: `compose-both has higher setup overhead; comparative-analysis can still over-rank hard-constraint violators if constraint gating is not explicit.`
- Evidence gaps: `No missing run data. Remaining gap is long-horizon maintainability data under continuous use.`
- Follow-up actions: `1) Keep explicit hard-constraint gate mandatory in all runs. 2) Re-run fixture after major skill updates and compare drift against current aggregate baseline.`

## Reliability Checks

- Criteria confirmed before scoring: `yes (fixture-defined rubric + explicit hybrid criteria)`
- Hard-constraint gate applied: `yes`
- Sensitivity check run: `yes`
- Outcome stability summary: `stable (18 perturbation cases; winner changes: 0; change rate: 0.0%)`
