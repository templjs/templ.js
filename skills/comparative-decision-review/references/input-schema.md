# Comparative Decision Review Input Schema

Use this structure with `scripts/score_options.py`.

## Required Fields

| Field                | Type    | Notes                          |
| -------------------- | ------- | ------------------------------ |
| `decision`           | string  | Decision statement.            |
| `criteria_confirmed` | boolean | Must be `true` before scoring. |
| `current_platform`   | string  | Platform to optimize for.      |
| `criteria`           | array   | Weighted criteria list.        |
| `alternatives`       | array   | Candidate options to compare.  |

## Optional Fields

| Field                            | Type     | Default                                 |
| -------------------------------- | -------- | --------------------------------------- |
| `score_scale`                    | string   | `0-100` (`1-5` also supported)          |
| `major_platforms`                | string[] | `["codex","copilot","claude","gemini"]` |
| `weights.major_platform_average` | number   | `0.6`                                   |
| `weights.current_platform`       | number   | `0.4`                                   |
| `recommendation_rules.*`         | number   | Script defaults                         |

## Criteria Format

Each criterion:

- `id`
- `name`
- `weight`

Optional human-review fields:

- `metric`
- `data_source`
- `scoring_rule`

Example:

```json
{
  "id": "use-case-coverage",
  "name": "Use-Case Coverage",
  "weight": 25,
  "metric": "Coverage of required capabilities",
  "data_source": "Design docs + test runs",
  "scoring_rule": "1-5 rubric"
}
```

## Alternative Format

Each alternative:

- `id`
- `name`
- `effort` (`S|M|L`)
- `risk` (`Low|Med|High`)
- `scores`: platform -> criterion -> value

Score value interpretation:

- If `score_scale = "1-5"`: script converts to percent by multiplying by `20`.
- If `score_scale = "0-100"`: values are used directly.

Example:

```json
{
  "id": "buy-vendor-x",
  "name": "Buy Vendor X",
  "effort": "S",
  "risk": "Med",
  "scores": {
    "codex": {
      "use-case-coverage": 4,
      "maintainability": 3
    },
    "copilot": {
      "use-case-coverage": 4,
      "maintainability": 4
    }
  }
}
```

## Full Example

```json
{
  "decision": "Select observability approach for a multi-service platform",
  "criteria_confirmed": true,
  "score_scale": "1-5",
  "current_platform": "codex",
  "major_platforms": ["codex", "copilot", "claude", "gemini"],
  "criteria": [
    { "id": "use-case-coverage", "name": "Use-Case Coverage", "weight": 25 },
    { "id": "workflow-rigor", "name": "Workflow Rigor and Repeatability", "weight": 20 },
    { "id": "objective-measurability", "name": "Objective Measurability", "weight": 15 },
    {
      "id": "precision-discoverability",
      "name": "Trigger Precision and Discoverability",
      "weight": 10
    },
    { "id": "platform-portability", "name": "Platform Portability", "weight": 10 },
    { "id": "maintainability", "name": "Maintainability and Extensibility", "weight": 10 },
    { "id": "adoption-cost", "name": "Adoption Cost and Time-to-Value", "weight": 10 }
  ],
  "alternatives": [
    {
      "id": "reuse-existing",
      "name": "Reuse Existing Stack",
      "effort": "S",
      "risk": "Low",
      "scores": {
        "codex": {
          "use-case-coverage": 4,
          "workflow-rigor": 4,
          "objective-measurability": 3,
          "precision-discoverability": 4,
          "platform-portability": 4,
          "maintainability": 4,
          "adoption-cost": 5
        },
        "copilot": {
          "use-case-coverage": 4,
          "workflow-rigor": 4,
          "objective-measurability": 3,
          "precision-discoverability": 4,
          "platform-portability": 4,
          "maintainability": 4,
          "adoption-cost": 4
        },
        "claude": {
          "use-case-coverage": 4,
          "workflow-rigor": 3,
          "objective-measurability": 3,
          "precision-discoverability": 4,
          "platform-portability": 4,
          "maintainability": 4,
          "adoption-cost": 4
        },
        "gemini": {
          "use-case-coverage": 4,
          "workflow-rigor": 4,
          "objective-measurability": 3,
          "precision-discoverability": 4,
          "platform-portability": 3,
          "maintainability": 4,
          "adoption-cost": 5
        }
      }
    },
    {
      "id": "build-new",
      "name": "Build New Platform",
      "effort": "L",
      "risk": "High",
      "scores": {
        "codex": {
          "use-case-coverage": 5,
          "workflow-rigor": 3,
          "objective-measurability": 4,
          "precision-discoverability": 3,
          "platform-portability": 5,
          "maintainability": 3,
          "adoption-cost": 2
        },
        "copilot": {
          "use-case-coverage": 5,
          "workflow-rigor": 3,
          "objective-measurability": 4,
          "precision-discoverability": 3,
          "platform-portability": 5,
          "maintainability": 3,
          "adoption-cost": 2
        },
        "claude": {
          "use-case-coverage": 5,
          "workflow-rigor": 3,
          "objective-measurability": 4,
          "precision-discoverability": 3,
          "platform-portability": 5,
          "maintainability": 3,
          "adoption-cost": 2
        },
        "gemini": {
          "use-case-coverage": 5,
          "workflow-rigor": 3,
          "objective-measurability": 4,
          "precision-discoverability": 3,
          "platform-portability": 5,
          "maintainability": 3,
          "adoption-cost": 2
        }
      }
    }
  ]
}
```
