# Rubric Packs

Use one pack per decision run. Weights must sum to `100`.

For each criterion, define `metric`, `data_source`, and `scoring_rule` in your run input.

## Skill Selection Pack

Aligned to templjs standards from `backlog/024_work_item_guardrails.md` and `docs/CI_CD.md`:
hard constraints and evidence gates are weighted above convenience.

| id                            | name                                         | weight |
| ----------------------------- | -------------------------------------------- | -----: |
| hard-constraint-compliance    | Hard-constraint compliance                   |     18 |
| objective-measurability       | Objective measurability and evidence quality |     17 |
| workflow-rigor-repeatability  | Workflow rigor and repeatability             |     15 |
| use-case-coverage             | Use-case coverage                            |     15 |
| maintainability-extensibility | Maintainability and extensibility            |     10 |
| adoption-cost-time-to-value   | Adoption cost and time-to-value              |      8 |
| platform-portability          | Platform portability                         |      7 |
| trigger-precision             | Trigger precision and discoverability        |      4 |
| risk-safety                   | Risk and safety                              |      6 |

## Tool Selection Pack

| id                     | name                         | weight |
| ---------------------- | ---------------------------- | -----: |
| functional-fit         | Functional fit               |     20 |
| determinism-accuracy   | Determinism and accuracy     |     15 |
| integration-complexity | Integration complexity       |     15 |
| operational-cost       | Operational cost             |     15 |
| security-compliance    | Security and compliance      |     15 |
| maintainability        | Maintainability              |     10 |
| portability-lock-in    | Portability and lock-in risk |     10 |

## Architecture Selection Pack

| id                        | name                          | weight |
| ------------------------- | ----------------------------- | -----: |
| requirements-fit          | Requirements fit              |     20 |
| scalability-performance   | Scalability and performance   |     15 |
| reliability-resilience    | Reliability and resilience    |     15 |
| delivery-complexity-risk  | Delivery complexity and risk  |     15 |
| security-compliance       | Security and compliance       |     15 |
| operability-observability | Operability and observability |     10 |
| evolvability              | Evolvability                  |     10 |

## Workflow Selection Pack

| id                    | name                    | weight |
| --------------------- | ----------------------- | -----: |
| task-fit              | Task fit                |     20 |
| repeatability         | Repeatability           |     20 |
| speed-time-to-value   | Speed and time-to-value |     15 |
| error-risk            | Error rate and risk     |     15 |
| collaboration-clarity | Collaboration clarity   |     10 |
| tooling-overhead      | Tooling overhead        |     10 |
| change-resilience     | Change resilience       |     10 |

## Build-vs-Buy Pack

| id                      | name                      | weight |
| ----------------------- | ------------------------- | -----: |
| capability-fit          | Capability fit            |     20 |
| time-to-market          | Time-to-market            |     15 |
| total-cost-of-ownership | Total cost of ownership   |     20 |
| control-customization   | Control and customization |     15 |
| vendor-dependency-risk  | Vendor dependency risk    |     10 |
| security-compliance     | Security and compliance   |     10 |
| operational-burden      | Operational burden        |     10 |

## Optional Scenario Performance Criterion

Add this only when running a bakeoff:

| id                   | name                         | recommended weight |
| -------------------- | ---------------------------- | -----------------: |
| scenario-performance | Scenario bakeoff performance |              10-20 |

If you add it, rebalance remaining weights back to `100`.
