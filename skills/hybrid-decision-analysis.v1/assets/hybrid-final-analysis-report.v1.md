# Comparative Analysis: Select the most reliable decision workflow option from the bakeoff fixture

## Criteria

| Criterion                                                                | Normalized Weight |
| ------------------------------------------------------------------------ | ----------------: |
| Hard-constraint compliance (`hard-constraint-compliance`)                |             0.180 |
| Objective measurability and evidence quality (`objective-measurability`) |             0.160 |
| Workflow rigor and repeatability (`workflow-rigor-repeatability`)        |             0.140 |
| Use-case coverage (`use-case-coverage`)                                  |             0.140 |
| Maintainability and extensibility (`maintainability-extensibility`)      |             0.100 |
| Adoption cost and time-to-value (`adoption-cost-time-to-value`)          |             0.080 |
| Platform portability (`platform-portability`)                            |             0.070 |
| Risk and safety (`risk-safety`)                                          |             0.050 |
| Scenario bakeoff performance (`scenario-performance`)                    |             0.080 |

## Ranked Alternatives

| Rank | Option                                        | Major Platform Avg | Current Platform (chatgpt) | Overall Success | Coverage |
| ---: | --------------------------------------------- | -----------------: | -------------------------: | --------------: | -------: |
|    1 | compose-both (`compose-both`)                 |              91.41 |                      91.41 |           91.41 |    1.000 |
|    2 | comparative-analysis (`comparative-analysis`) |              89.61 |                      89.61 |           89.61 |    1.000 |
|    3 | skill-reviewer (`skill-reviewer`)             |              84.53 |                      84.53 |           84.53 |    1.000 |

## Recommendation

- Action: **compose**
- Chosen option(s): `compose-both, comparative-analysis`
- Top option: `compose-both`
- Margin vs second: 1.80
- Reason: Top two options are strong and close (margin 1.80 < 7.0).

## Notes

- Major platforms considered: chatgpt, claude, gemini, copilot
- Blend weights: major_platform_average=0.600, current_platform=0.400
