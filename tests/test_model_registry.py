import pytest

from llm_steering.model_registry import get_model_entry, is_steering_ready, list_models


def test_registry_contains_required_handoff_models() -> None:
    model_ids = {entry.model_id for entry in list_models()}
    assert "google/gemma-4-E2B-it" in model_ids
    assert "google/diffusiongemma-26B-A4B-it" in model_ids
    assert "Qwen/Qwen3.6-27B" in model_ids
    assert "Qwen/Qwen3-Coder-Next" in model_ids


def test_registry_gates_unvalidated_models() -> None:
    assert is_steering_ready("google/gemma-4-E2B-it")
    assert not is_steering_ready("google/diffusiongemma-26B-A4B-it")
    assert get_model_entry("google/diffusiongemma-26B-A4B-it").support_status == "generation_only"
    assert get_model_entry("Qwen/Qwen3-Coder-Next").support_status == "experimental"


def test_registry_rejects_unknown_model() -> None:
    with pytest.raises(KeyError):
        get_model_entry("not-a-real/model")
