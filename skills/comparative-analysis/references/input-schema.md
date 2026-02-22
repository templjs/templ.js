# Comparative Analysis Input Schema

Use this JSON structure with `scripts/score_alternatives.py`.

## Required fields

| Field              | Type   | Notes                                               |
| ------------------ | ------ | --------------------------------------------------- |
| `decision`         | string | Short decision statement.                           |
| `current_platform` | string | Current LLM platform (for platform-specific score). |
| `criteria`         | array  | List of weighted criteria.                          |
| `alternatives`     | array  | Candidate options to evaluate.                      |

## Optional fields

| Field                            | Type             | Default                                   |
| -------------------------------- | ---------------- | ----------------------------------------- |
| `major_platforms`                | array of strings | `["chatgpt","claude","gemini","copilot"]` |
| `weights.major_platform_average` | number           | `0.6`                                     |
| `weights.current_platform`       | number           | `0.4`                                     |
| `recommendation_rules.*`         | numbers          | Script defaults                           |

## Criteria format

Each criterion must include:

- `id`: stable key (kebab-case recommended)
- `name`: label
- `weight`: non-negative number (weights are normalized automatically)

Example:

```json
{
  "id": "maintainability",
  "name": "Maintainability",
  "weight": 3
}
```

## Alternative format

Each alternative must include:

- `id`
- `name`
- `scores`: platform-to-criterion score map (0-100)

Example:

```json
{
  "id": "extend-existing",
  "name": "Extend existing skills",
  "scores": {
    "chatgpt": {
      "maintainability": 78,
      "execution-speed": 81
    },
    "claude": {
      "maintainability": 82,
      "execution-speed": 80
    },
    "codex": {
      "maintainability": 75,
      "execution-speed": 84
    }
  }
}
```

## Full example

```json
{
  "decision": "Choose comparative analysis approach",
  "current_platform": "codex",
  "major_platforms": ["chatgpt", "claude", "gemini", "copilot"],
  "criteria": [
    { "id": "fit", "name": "Problem Fit", "weight": 4 },
    { "id": "maintainability", "name": "Maintainability", "weight": 3 },
    { "id": "delivery-speed", "name": "Delivery Speed", "weight": 3 }
  ],
  "alternatives": [
    {
      "id": "select-existing",
      "name": "Select an existing skill",
      "scores": {
        "chatgpt": { "fit": 80, "maintainability": 84, "delivery-speed": 88 },
        "claude": { "fit": 82, "maintainability": 86, "delivery-speed": 85 },
        "gemini": { "fit": 74, "maintainability": 77, "delivery-speed": 80 },
        "copilot": { "fit": 76, "maintainability": 79, "delivery-speed": 82 },
        "codex": { "fit": 83, "maintainability": 85, "delivery-speed": 87 }
      }
    },
    {
      "id": "build-new",
      "name": "Build a new skill from scratch",
      "scores": {
        "chatgpt": { "fit": 89, "maintainability": 65, "delivery-speed": 45 },
        "claude": { "fit": 90, "maintainability": 66, "delivery-speed": 44 },
        "gemini": { "fit": 88, "maintainability": 63, "delivery-speed": 43 },
        "copilot": { "fit": 87, "maintainability": 64, "delivery-speed": 46 },
        "codex": { "fit": 92, "maintainability": 68, "delivery-speed": 50 }
      }
    }
  ]
}
```
