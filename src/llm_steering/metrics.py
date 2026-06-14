from __future__ import annotations

from dataclasses import dataclass, asdict
from itertools import combinations
from typing import Iterable

import torch
import torch.nn.functional as F


@dataclass(frozen=True, slots=True)
class VectorDiagnostics:
    vector_norm: float
    pair_count: int
    pairwise_cosine_mean: float | None
    pairwise_cosine_min: float | None
    separability_score: float | None
    reliability_label: str

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


def _as_2d_tensor(vectors: Iterable[torch.Tensor]) -> torch.Tensor:
    vector_list = [vector.detach().float().cpu().flatten() for vector in vectors]
    if not vector_list:
        raise ValueError("At least one vector is required.")
    return torch.stack(vector_list, dim=0)


def pairwise_cosine_stats(vectors: Iterable[torch.Tensor]) -> tuple[float | None, float | None]:
    stacked = _as_2d_tensor(vectors)
    if stacked.shape[0] < 2:
        return None, None

    normalized = F.normalize(stacked, dim=1)
    values = [
        float(torch.dot(normalized[left], normalized[right]).item())
        for left, right in combinations(range(normalized.shape[0]), 2)
    ]
    return sum(values) / len(values), min(values)


def projection_separability(
    positive_states: Iterable[torch.Tensor],
    negative_states: Iterable[torch.Tensor],
    direction: torch.Tensor,
) -> float:
    positives = _as_2d_tensor(positive_states)
    negatives = _as_2d_tensor(negative_states)
    if positives.shape != negatives.shape:
        raise ValueError("Positive and negative state collections must have matching shapes.")

    unit = F.normalize(direction.detach().float().cpu().flatten(), dim=0)
    positive_scores = positives @ unit
    negative_scores = negatives @ unit
    pooled_std = torch.cat([positive_scores, negative_scores]).std(unbiased=False).clamp_min(1e-8)
    return float(((positive_scores.mean() - negative_scores.mean()) / pooled_std).item())


def reliability_label(pair_count: int, cosine_mean: float | None, separability_score: float | None) -> str:
    if pair_count < 2:
        return "single-pair baseline"
    if cosine_mean is not None and cosine_mean >= 0.35 and (separability_score is None or separability_score >= 0.8):
        return "directionally coherent"
    if cosine_mean is not None and cosine_mean >= 0.0:
        return "mixed evidence"
    return "low agreement"


def vector_diagnostics(
    vector: torch.Tensor,
    *,
    pair_diffs: Iterable[torch.Tensor] | None = None,
    positive_states: Iterable[torch.Tensor] | None = None,
    negative_states: Iterable[torch.Tensor] | None = None,
) -> VectorDiagnostics:
    diffs = list(pair_diffs or [vector])
    cosine_mean, cosine_min = pairwise_cosine_stats(diffs)
    separability = None
    if positive_states is not None and negative_states is not None:
        separability = projection_separability(positive_states, negative_states, vector)

    return VectorDiagnostics(
        vector_norm=float(vector.detach().float().norm().item()),
        pair_count=len(diffs),
        pairwise_cosine_mean=cosine_mean,
        pairwise_cosine_min=cosine_min,
        separability_score=separability,
        reliability_label=reliability_label(len(diffs), cosine_mean, separability),
    )


def output_delta_metrics(baseline: str, steered: str) -> dict[str, object]:
    baseline_words = baseline.split()
    steered_words = steered.split()
    shared = len(set(baseline_words).intersection(steered_words))
    total = max(len(set(baseline_words).union(steered_words)), 1)
    return {
        "changed": baseline != steered,
        "baseline_chars": len(baseline),
        "steered_chars": len(steered),
        "char_delta": len(steered) - len(baseline),
        "word_jaccard": shared / total,
    }
