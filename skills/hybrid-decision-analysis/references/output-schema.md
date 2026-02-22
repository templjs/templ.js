# Hybrid Output Schema

Canonical machine schema:

- `references/output.schema.json` (JSON Schema 2020-12)

Use `scripts/validate_json_contract.mjs` to validate result payloads.

## Required Audit Fields

- `run_id`
- `scorer_version`
- `rules_version`
- `evaluated_at`
- `decision_status` (`proceed|defer|no-go`)

## Recommendation Action Set

- `select`
- `compose`
- `improve`
- `extend`
- `build-new`
- `no-go`

`no-go` is valid when discovered options are infeasible or below minimum viability.
