#!/usr/bin/env python3
"""Deterministic scoring and ranking for comparative-analysis skill."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any


DEFAULT_MAJOR_PLATFORMS = ["chatgpt", "claude", "gemini", "copilot"]
DEFAULT_BLEND = {"major_platform_average": 0.6, "current_platform": 0.4}
DEFAULT_RULES = {
    "select_min": 80.0,
    "select_margin": 7.0,
    "compose_min": 70.0,
    "compose_margin": 7.0,
    "improve_min": 55.0,
    "extend_gap": 10.0,
}


def _to_float(value: Any, field: str) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Expected numeric value for '{field}', got {value!r}") from exc
    if math.isnan(number) or math.isinf(number):
        raise ValueError(f"Invalid numeric value for '{field}': {value!r}")
    return number


def _normalize_weights(criteria: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not criteria:
        raise ValueError("At least one criterion is required")

    normalized: list[dict[str, Any]] = []
    total_weight = 0.0
    seen_ids: set[str] = set()

    for index, criterion in enumerate(criteria):
        if not isinstance(criterion, dict):
            raise ValueError(f"criteria[{index}] must be an object")

        criterion_id = str(criterion.get("id", "")).strip()
        if not criterion_id:
            raise ValueError(f"criteria[{index}].id is required")
        if criterion_id in seen_ids:
            raise ValueError(f"Duplicate criterion id '{criterion_id}'")
        seen_ids.add(criterion_id)

        name = str(criterion.get("name", criterion_id)).strip() or criterion_id
        weight = _to_float(criterion.get("weight", 0.0), f"criteria[{index}].weight")
        if weight < 0:
            raise ValueError(f"criteria[{index}].weight must be non-negative")

        total_weight += weight
        normalized.append({"id": criterion_id, "name": name, "weight": weight})

    if total_weight <= 0:
        raise ValueError("Sum of criterion weights must be greater than zero")

    for criterion in normalized:
        criterion["weight"] = criterion["weight"] / total_weight

    return normalized


def _normalize_blend(weights: dict[str, Any] | None) -> dict[str, float]:
    source = dict(DEFAULT_BLEND)
    if isinstance(weights, dict):
        source.update(weights)

    major = _to_float(source.get("major_platform_average"), "weights.major_platform_average")
    current = _to_float(source.get("current_platform"), "weights.current_platform")
    if major < 0 or current < 0:
        raise ValueError("Blend weights must be non-negative")
    if major + current <= 0:
        raise ValueError("Blend weights must sum to a positive value")

    total = major + current
    return {
        "major_platform_average": major / total,
        "current_platform": current / total,
    }


def _normalize_rules(rules: dict[str, Any] | None) -> dict[str, float]:
    source = dict(DEFAULT_RULES)
    if isinstance(rules, dict):
        source.update(rules)

    normalized: dict[str, float] = {}
    for key, value in source.items():
        normalized[key] = _to_float(value, f"recommendation_rules.{key}")
    return normalized


def _clamp_score(value: Any, field: str) -> float:
    score = _to_float(value, field)
    if score < 0:
        return 0.0
    if score > 100:
        return 100.0
    return score


def _platform_score(
    option: dict[str, Any],
    platform: str,
    criteria: list[dict[str, Any]],
) -> tuple[float, int]:
    scores_by_platform = option.get("scores", {})
    platform_scores = scores_by_platform.get(platform, {})
    if platform_scores is None:
        platform_scores = {}
    if not isinstance(platform_scores, dict):
        raise ValueError(
            f"Alternative '{option.get('id', '<unknown>')}' has non-object score map for platform '{platform}'"
        )

    weighted_score = 0.0
    missing = 0
    for criterion in criteria:
        criterion_id = criterion["id"]
        raw = platform_scores.get(criterion_id)
        if raw is None:
            missing += 1
            value = 0.0
        else:
            value = _clamp_score(
                raw,
                f"alternatives[{option.get('id', '<unknown>')}].scores.{platform}.{criterion_id}",
            )
        weighted_score += criterion["weight"] * value

    return weighted_score, missing


def _evaluate(data: dict[str, Any]) -> dict[str, Any]:
    decision = str(data.get("decision", "Comparative analysis")).strip() or "Comparative analysis"

    current_platform = str(data.get("current_platform", "")).strip()
    if not current_platform:
        raise ValueError("current_platform is required")

    major_platforms = data.get("major_platforms") or list(DEFAULT_MAJOR_PLATFORMS)
    if not isinstance(major_platforms, list) or not major_platforms:
        raise ValueError("major_platforms must be a non-empty array")
    major_platforms = [str(platform).strip() for platform in major_platforms if str(platform).strip()]
    if not major_platforms:
        raise ValueError("major_platforms must include at least one non-empty platform name")

    criteria = _normalize_weights(data.get("criteria") or [])
    blend = _normalize_blend(data.get("weights"))
    rules = _normalize_rules(data.get("recommendation_rules"))

    alternatives = data.get("alternatives")
    if not isinstance(alternatives, list) or not alternatives:
        raise ValueError("alternatives must be a non-empty array")

    results = []
    required_platforms = sorted(set(major_platforms + [current_platform]))
    expected_values = len(criteria) * len(required_platforms)

    seen_ids: set[str] = set()
    for index, alternative in enumerate(alternatives):
        if not isinstance(alternative, dict):
            raise ValueError(f"alternatives[{index}] must be an object")

        alternative_id = str(alternative.get("id", "")).strip()
        if not alternative_id:
            raise ValueError(f"alternatives[{index}].id is required")
        if alternative_id in seen_ids:
            raise ValueError(f"Duplicate alternative id '{alternative_id}'")
        seen_ids.add(alternative_id)

        name = str(alternative.get("name", alternative_id)).strip() or alternative_id

        platform_results: dict[str, tuple[float, int]] = {}
        for platform in required_platforms:
            platform_results[platform] = _platform_score(alternative, platform, criteria)

        major_scores = [platform_results[platform][0] for platform in major_platforms]
        current_score = platform_results[current_platform][0]
        missing_values = sum(missing for _, missing in platform_results.values())
        major_average = sum(major_scores) / len(major_scores)
        overall = (
            blend["major_platform_average"] * major_average
            + blend["current_platform"] * current_score
        )
        coverage = 1.0 - (missing_values / expected_values if expected_values else 0.0)
        coverage = max(0.0, min(1.0, coverage))

        results.append(
            {
                "id": alternative_id,
                "name": name,
                "major_platform_average": round(major_average, 2),
                "current_platform_score": round(current_score, 2),
                "overall_success_score": round(overall, 2),
                "coverage": round(coverage, 3),
                "missing_values": missing_values,
                "notes": alternative.get("notes", ""),
            }
        )

    ranked = sorted(
        results,
        key=lambda item: (
            -item["overall_success_score"],
            -item["current_platform_score"],
            -item["major_platform_average"],
            item["name"].lower(),
        ),
    )

    for rank, item in enumerate(ranked, start=1):
        item["rank"] = rank

    recommendation = _recommend(ranked, rules)

    return {
        "decision": decision,
        "current_platform": current_platform,
        "major_platforms": major_platforms,
        "criteria": criteria,
        "weights": blend,
        "ranked_alternatives": ranked,
        "recommendation": recommendation,
    }


def _recommend(ranked: list[dict[str, Any]], rules: dict[str, float]) -> dict[str, Any]:
    best = ranked[0]
    second = ranked[1] if len(ranked) > 1 else None
    margin = (
        best["overall_success_score"] - second["overall_success_score"]
        if second
        else best["overall_success_score"]
    )

    if best["overall_success_score"] >= rules["select_min"] and margin >= rules["select_margin"]:
        action = "select"
        chosen = [best["id"]]
        reason = (
            f"Top option exceeds select threshold ({rules['select_min']}) "
            f"with margin {margin:.2f}."
        )
    elif (
        second
        and best["overall_success_score"] >= rules["compose_min"]
        and margin < rules["compose_margin"]
    ):
        action = "compose"
        chosen = [best["id"], second["id"]]
        reason = (
            f"Top two options are strong and close (margin {margin:.2f} < "
            f"{rules['compose_margin']})."
        )
    elif best["overall_success_score"] >= rules["improve_min"]:
        if (best["major_platform_average"] - best["current_platform_score"]) >= rules["extend_gap"]:
            action = "extend"
            reason = (
                "Top option performs better across major platforms than on current platform; "
                "adaptation is the fastest path."
            )
        else:
            action = "improve"
            reason = "Top option is viable but below direct-select threshold; improve focused gaps."
        chosen = [best["id"]]
    else:
        action = "build-new"
        chosen = []
        reason = "No option meets minimum viability threshold."

    return {
        "action": action,
        "chosen_option_ids": chosen,
        "top_option_id": best["id"],
        "score_margin_vs_second": round(margin, 2),
        "reason": reason,
        "rules": rules,
    }


def _markdown_report(result: dict[str, Any]) -> str:
    lines = []
    lines.append(f"# Comparative Analysis: {result['decision']}")
    lines.append("")
    lines.append("## Criteria")
    lines.append("")
    lines.append("| Criterion | Normalized Weight |")
    lines.append("|---|---:|")
    for criterion in result["criteria"]:
        lines.append(f"| {criterion['name']} (`{criterion['id']}`) | {criterion['weight']:.3f} |")
    lines.append("")
    lines.append("## Ranked Alternatives")
    lines.append("")
    lines.append(
        "| Rank | Option | Major Platform Avg | "
        f"Current Platform ({result['current_platform']}) | Overall Success | Coverage |"
    )
    lines.append("|---:|---|---:|---:|---:|---:|")
    for item in result["ranked_alternatives"]:
        lines.append(
            f"| {item['rank']} | {item['name']} (`{item['id']}`) | "
            f"{item['major_platform_average']:.2f} | {item['current_platform_score']:.2f} | "
            f"{item['overall_success_score']:.2f} | {item['coverage']:.3f} |"
        )
    lines.append("")
    lines.append("## Recommendation")
    lines.append("")
    recommendation = result["recommendation"]
    chosen = recommendation["chosen_option_ids"]
    chosen_text = ", ".join(chosen) if chosen else "none (build new)"
    lines.append(f"- Action: **{recommendation['action']}**")
    lines.append(f"- Chosen option(s): `{chosen_text}`")
    lines.append(f"- Top option: `{recommendation['top_option_id']}`")
    lines.append(
        f"- Margin vs second: {recommendation['score_margin_vs_second']:.2f}"
    )
    lines.append(f"- Reason: {recommendation['reason']}")
    lines.append("")
    lines.append("## Notes")
    lines.append("")
    lines.append("- Major platforms considered: " + ", ".join(result["major_platforms"]))
    lines.append(
        "- Blend weights: major_platform_average="
        f"{result['weights']['major_platform_average']:.3f}, "
        f"current_platform={result['weights']['current_platform']:.3f}"
    )
    return "\n".join(lines) + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Score alternatives deterministically.")
    parser.add_argument("--input", required=True, help="Path to analysis input JSON file")
    parser.add_argument("--output", help="Path to write markdown report")
    parser.add_argument("--json-output", help="Path to write machine-readable result JSON")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        raise SystemExit(f"Input file not found: {input_path}")

    with input_path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)

    result = _evaluate(data)
    report = _markdown_report(result)

    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(report, encoding="utf-8")
    else:
        print(report)

    if args.json_output:
        json_path = Path(args.json_output)
        json_path.parent.mkdir(parents=True, exist_ok=True)
        json_path.write_text(json.dumps(result, indent=2), encoding="utf-8")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
