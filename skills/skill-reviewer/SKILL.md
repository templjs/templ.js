---
name: skill-reviewer
description: 'Evaluate and compare AI agent skills with a structured, repeatable, objective, and data-driven process. Use when asked to review one or more skills, define scoring criteria, compare alternatives, compute platform-specific success scores, or recommend whether to select, improve, extend, compose, or build a new skill.'
---

# Skill Reviewer

Evaluate candidate skills using a confirmed rubric, consistent scoring, and explicit evidence. Produce a ranked recommendation plus a lightweight comparative analysis record.

## When to Use This Skill

- User asks to review, compare, or choose between skills
- User asks for objective, rubric-based skill assessment
- User needs a recommendation: select, improve, extend, compose, or build new
- User needs current-platform fit and cross-platform viability

## Principles

- Define criteria before scoring
- Use the same rubric for all options
- Tie every score to concrete evidence
- Show uncertainty and evidence gaps explicitly

## Inputs

- Intended use and expected outcomes
- Current LLM platform (for example: Codex, Copilot, Claude Code, Gemini)
- Candidate skill list (or discovery scope)
- Constraints (time, risk, dependencies, maintenance budget)

## Workflow

### Phase 1: Derive Evaluation Criteria and Metrics

#### 1. Clarify intended use

Capture:

- Primary job to be done
- In-scope users and environments
- Success conditions and failure modes
- Hard constraints and non-goals

#### 2. Identify and analyze alternatives

Build the option set:

- Select existing skill as-is
- Improve existing skill
- Extend existing skill for missing capabilities
- Compose multiple existing skills
- Build a new skill

For each option, capture:

- Coverage of intended use
- Estimated effort (`S`, `M`, `L`)
- Dependencies and integration complexity
- Key risks and unknowns

#### 3. Define criteria and metric scale

Use a weighted rubric totaling `100`.

| Criterion                             | Weight | Measurement Guidance                                 |
| ------------------------------------- | -----: | ---------------------------------------------------- |
| Use-case coverage                     |     25 | How fully the skill solves intended use              |
| Workflow rigor and repeatability      |     20 | Deterministic steps, clear gates, low ambiguity      |
| Objective measurability               |     15 | Metrics, scoring rules, and evidence capture quality |
| Trigger precision and discoverability |     10 | Clear activation language and user intent match      |
| Platform portability                  |     10 | Behavior consistency across major LLM platforms      |
| Maintainability and extensibility     |     10 | Ease of updates without regressions                  |
| Adoption cost / time-to-value         |     10 | Setup effort, complexity, and onboarding burden      |

Score each criterion on `1-5`:

- `1`: Poor / mostly missing
- `2`: Weak / major gaps
- `3`: Adequate / acceptable with gaps
- `4`: Strong / minor gaps
- `5`: Excellent / production-ready

#### 4. Confirmation checkpoint (required)

Before any scoring, present criteria, weights, and scoring scale and ask for explicit confirmation. If not confirmed, revise and repeat this checkpoint.

### Phase 2: Evaluate Each Identified Skill

For each candidate skill:

1. Read `SKILL.md` and only the supporting files needed for evidence.
2. Score each criterion using the confirmed rubric.
3. Record a short evidence note per criterion.
4. Compute platform scores and required aggregates.

#### Platform scoring model

For a given skill and platform:

`platform_score = sum(weight_i * (score_i / 5))`

`platform_score` range is `0-100`.

Major platforms set:

- Codex
- GitHub Copilot
- Claude Code
- Gemini

Required outputs per skill:

- `major_platform_average`: mean of available major platform scores (`N/A` values excluded)
- `current_platform_success_score`: score for the current LLM platform

Optional confidence metric:

- `confidence = evidence_backed_criteria / total_criteria`

Use this per-skill worksheet:

```markdown
### Skill: <name>

| Criterion                             | Weight | Score (1-5) | Weighted Points | Evidence |
| ------------------------------------- | -----: | ----------: | --------------: | -------- |
| Use-case coverage                     |     25 |             |                 |          |
| Workflow rigor and repeatability      |     20 |             |                 |          |
| Objective measurability               |     15 |             |                 |          |
| Trigger precision and discoverability |     10 |             |                 |          |
| Platform portability                  |     10 |             |                 |          |
| Maintainability and extensibility     |     10 |             |                 |          |
| Adoption cost / time-to-value         |     10 |             |                 |          |

- Codex score:
- GitHub Copilot score:
- Claude Code score:
- Gemini score:
- Major platform average:
- Current platform success score:
- Confidence:
```

### Phase 3: Recommendation and Comparative Analysis Record

#### 1. Rank options

Rank by:

- Highest `current_platform_success_score`
- Then highest `major_platform_average`
- Then lowest effort/risk

#### 2. Recommend action

Recommend one primary action per top option:

- `select`
- `improve`
- `extend`
- `compose`
- `build_new`

Provide concise justification tied to the rubric and evidence.

#### 3. Capture decision in a lightweight comparative analysis record

Use this format:

```markdown
## Skill Comparative Analysis Record (SCAR)

- Date:
- Reviewer:
- Current platform:
- Intended use:
- Confirmed criteria: Yes/No (must be Yes before scoring)

### Criteria and Weights

| Criterion                             | Weight |
| ------------------------------------- | -----: |
| Use-case coverage                     |     25 |
| Workflow rigor and repeatability      |     20 |
| Objective measurability               |     15 |
| Trigger precision and discoverability |     10 |
| Platform portability                  |     10 |
| Maintainability and extensibility     |     10 |
| Adoption cost / time-to-value         |     10 |

### Options Evaluated

| Rank | Option | Action                                  | Major Platform Average | Current Platform Score | Effort | Risk         | Key Evidence |
| ---: | ------ | --------------------------------------- | ---------------------: | ---------------------: | ------ | ------------ | ------------ |
|    1 | ...    | select/improve/extend/compose/build_new |                    ... |                    ... | S/M/L  | Low/Med/High | ...          |

### Decision

- Selected option:
- Rationale:
- Rejected options and why:
- Evidence gaps and follow-up:
```

## Quality Gates

- Do not score before criteria confirmation
- Do not compare options with different rubrics
- Mark missing evidence as gaps, not assumptions
- Keep rationale evidence-linked and concise
