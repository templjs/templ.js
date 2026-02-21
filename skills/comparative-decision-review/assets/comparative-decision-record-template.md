# Comparative Decision Record (CDR)

## Decision

- Statement: `<decision>`
- Date: `<yyyy-mm-dd>`
- Current platform: `<platform>`
- Major platforms: `<comma-separated>`
- Criteria confirmed: `<Yes|No>`

## Intended Use

- Primary user/workflow: `<context>`
- Constraints: `<constraints>`
- Non-goals: `<non-goals>`

## Criteria

| Criterion       |     Weight | Metric     | Data Source | Scoring Rule          |
| --------------- | ---------: | ---------- | ----------- | --------------------- |
| `<criterion-1>` | `<weight>` | `<metric>` | `<source>`  | `<1-5 or 0-100 rule>` |
| `<criterion-2>` | `<weight>` | `<metric>` | `<source>`  | `<rule>`              |

## Alternatives

| Rank | Alternative | Effort | Risk | Major Platform Avg | Current Platform Score | Overall Success | Coverage |
| ---: | ----------- | ------ | ---- | -----------------: | ---------------------: | --------------: | -------: | --------- | --------- | --------- | ------- |
|    1 | `<option>`  | `<S    | M    |                L>` |                  `<Low |             Med |   High>` | `<score>` | `<score>` | `<score>` | `<0-1>` |
|    2 | `<option>`  | `<S    | M    |                L>` |                  `<Low |             Med |   High>` | `<score>` | `<score>` | `<score>` | `<0-1>` |

## Recommendation

- Action: `<select|compose|improve|extend|build-new>`
- Chosen option(s): `<ids>`
- Margin vs second: `<score>`
- Rationale: `<evidence-linked rationale with score deltas>`

## Risks and Follow-up

- Key risks: `<top risks>`
- Evidence gaps: `<missing evidence>`
- Follow-up actions: `<next actions>`
