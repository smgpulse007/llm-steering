from __future__ import annotations

from dataclasses import asdict, dataclass
import math
import re
from typing import Iterable


FEATURES = ("empathy", "caution", "structure", "clarity")

KEYWORD_WEIGHTS: dict[str, dict[str, float]] = {
    "empathy": {
        "sorry": 1.4,
        "calm": 1.1,
        "support": 0.9,
        "reassure": 1.2,
        "learner": 0.8,
        "encourage": 1.2,
        "accountable": 1.1,
    },
    "caution": {
        "risk": 1.2,
        "cautious": 1.2,
        "rollback": 1.1,
        "monitor": 1.0,
        "staged": 1.0,
        "validate": 1.0,
        "uncertain": 0.8,
    },
    "structure": {
        "steps": 1.1,
        "plan": 1.0,
        "outline": 0.9,
        "checklist": 1.2,
        "criteria": 1.0,
        "owner": 0.8,
        "next": 0.7,
    },
    "clarity": {
        "clear": 1.1,
        "concise": 0.8,
        "specific": 1.0,
        "explain": 0.8,
        "concrete": 1.1,
        "precise": 1.0,
        "simple": 0.7,
    },
}

ANTI_KEYWORD_WEIGHTS: dict[str, dict[str, float]] = {
    "empathy": {
        "curt": 1.3,
        "defensive": 1.2,
        "irritated": 1.1,
        "cold": 0.9,
    },
    "caution": {
        "overconfident": 1.2,
        "immediate": 0.8,
        "ignore": 0.9,
        "reckless": 1.3,
    },
    "structure": {
        "vague": 1.1,
        "rambling": 0.8,
        "unstructured": 1.2,
    },
    "clarity": {
        "abstract": 0.9,
        "confusing": 1.1,
        "unclear": 1.2,
    },
}


@dataclass(frozen=True, slots=True)
class ToyPromptPair:
    positive: str
    negative: str


@dataclass(frozen=True, slots=True)
class ToyRun:
    mode: str
    prompt: str
    positive: str
    negative: str
    coefficient: float
    layer: int
    baseline_features: dict[str, float]
    steering_vector: dict[str, float]
    steered_features: dict[str, float]
    baseline: str
    prompt_only: str
    steered: str
    teaching_notes: list[str]

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


def tokenize(text: str) -> list[str]:
    return re.findall(r"[a-zA-Z][a-zA-Z_-]*", text.lower())


def _score_text(text: str) -> dict[str, float]:
    tokens = tokenize(text)
    scores = {feature: 0.0 for feature in FEATURES}
    for feature, weights in KEYWORD_WEIGHTS.items():
        scores[feature] += sum(weights.get(token, 0.0) for token in tokens)
    for feature, weights in ANTI_KEYWORD_WEIGHTS.items():
        scores[feature] -= sum(weights.get(token, 0.0) for token in tokens)
    return scores


def _subtract(left: dict[str, float], right: dict[str, float]) -> dict[str, float]:
    return {feature: left[feature] - right[feature] for feature in FEATURES}


def _add_scaled(base: dict[str, float], vector: dict[str, float], coefficient: float) -> dict[str, float]:
    return {feature: base[feature] + vector[feature] * coefficient for feature in FEATURES}


def _normalize(vector: dict[str, float]) -> dict[str, float]:
    norm = math.sqrt(sum(value * value for value in vector.values()))
    if norm == 0:
        return {feature: 0.0 for feature in FEATURES}
    return {feature: value / norm for feature, value in vector.items()}


def _dominant_features(scores: dict[str, float], *, minimum: float = 0.3) -> list[str]:
    ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    return [feature for feature, value in ranked if value >= minimum][:3]


def _render_response(prompt: str, scores: dict[str, float], *, prefix: str) -> str:
    dominant = _dominant_features(scores)
    if not dominant:
        dominant = ["clarity"]

    fragments = {
        "empathy": "acknowledge the user's situation before giving the answer",
        "caution": "name the main risk and add a validation step",
        "structure": "organize the reply into concrete next steps",
        "clarity": "use direct language and avoid vague claims",
    }
    advice = "; ".join(fragments[feature] for feature in dominant)
    return f"{prefix}: For '{prompt}', {advice}."


def mean_prompt_pair_vector(pairs: Iterable[ToyPromptPair]) -> dict[str, float]:
    pair_list = list(pairs)
    if not pair_list:
        raise ValueError("At least one toy prompt pair is required.")

    total = {feature: 0.0 for feature in FEATURES}
    for pair in pair_list:
        positive_scores = _score_text(pair.positive)
        negative_scores = _score_text(pair.negative)
        diff = _subtract(positive_scores, negative_scores)
        for feature in FEATURES:
            total[feature] += diff[feature]

    averaged = {feature: total[feature] / len(pair_list) for feature in FEATURES}
    return _normalize(averaged)


def run_toy_steering(
    *,
    prompt: str,
    positive: str,
    negative: str,
    coefficient: float = 1.4,
    layer: int = 3,
) -> ToyRun:
    if coefficient < 0:
        raise ValueError("Toy coefficient must be non-negative.")
    if layer < 0:
        raise ValueError("Toy layer must be non-negative.")

    baseline_features = _score_text(prompt)
    steering_vector = mean_prompt_pair_vector([ToyPromptPair(positive=positive, negative=negative)])
    steered_features = _add_scaled(baseline_features, steering_vector, coefficient)
    prompt_only_features = _add_scaled(baseline_features, steering_vector, coefficient * 0.35)

    return ToyRun(
        mode="synthetic_no_model",
        prompt=prompt,
        positive=positive,
        negative=negative,
        coefficient=coefficient,
        layer=layer,
        baseline_features={key: round(value, 4) for key, value in baseline_features.items()},
        steering_vector={key: round(value, 4) for key, value in steering_vector.items()},
        steered_features={key: round(value, 4) for key, value in steered_features.items()},
        baseline=_render_response(prompt, baseline_features, prefix="Baseline toy model"),
        prompt_only=_render_response(prompt, prompt_only_features, prefix="Prompt-only nudge"),
        steered=_render_response(prompt, steered_features, prefix="Activation-steered toy model"),
        teaching_notes=[
            "This is a deterministic toy simulation, not a claim about a real model's internals.",
            "The positive and negative prompts define a direction across named behavior features.",
            "The coefficient scales that direction before it is added to the baseline feature state.",
            "Real activation steering uses hidden-state tensors at a transformer layer instead of named toy features.",
        ],
    )


def default_toy_run() -> ToyRun:
    return run_toy_steering(
        prompt="Draft a response to a customer whose replacement part arrived late.",
        positive="Write a calm, accountable reply with clear next steps and reassurance.",
        negative="Write a curt, defensive reply with vague language and no next step.",
        coefficient=1.4,
        layer=3,
    )
