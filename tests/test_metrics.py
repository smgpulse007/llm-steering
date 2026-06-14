import torch

from llm_steering.metrics import output_delta_metrics, pairwise_cosine_stats, vector_diagnostics


def test_pairwise_cosine_stats_reports_agreement() -> None:
    mean, minimum = pairwise_cosine_stats(
        [
            torch.tensor([1.0, 0.0]),
            torch.tensor([0.5, 0.0]),
            torch.tensor([0.25, 0.0]),
        ]
    )
    assert mean == 1.0
    assert minimum == 1.0


def test_vector_diagnostics_labels_single_pair_baseline() -> None:
    diagnostics = vector_diagnostics(torch.tensor([3.0, 4.0]))
    assert diagnostics.vector_norm == 5.0
    assert diagnostics.pair_count == 1
    assert diagnostics.reliability_label == "single-pair baseline"


def test_output_delta_metrics_compares_text() -> None:
    metrics = output_delta_metrics("calm concise reply", "calm detailed reply")
    assert metrics["changed"] is True
    assert metrics["char_delta"] == len("calm detailed reply") - len("calm concise reply")
    assert 0.0 <= metrics["word_jaccard"] <= 1.0
