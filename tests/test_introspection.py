import torch

from llm_steering.introspection import inspect_model_object, registry_only_report


class _Layer(torch.nn.Module):
    def forward(self, hidden_states: torch.Tensor) -> torch.Tensor:
        return hidden_states


class _Inner:
    def __init__(self) -> None:
        self.layers = [_Layer(), _Layer()]


class _Model:
    def __init__(self) -> None:
        self.model = _Inner()

    def generate(self) -> None:
        return None


def test_inspect_model_object_finds_hookable_layers() -> None:
    report = inspect_model_object(_Model(), "google/gemma-4-E2B-it")
    assert report.hook_compatible
    assert report.has_generate
    assert report.status == "steering_validated_by_registry_and_object"
    assert any(path.found and path.layer_count == 2 for path in report.layer_paths)


def test_registry_only_report_preserves_generation_only_warning() -> None:
    report = registry_only_report("google/diffusiongemma-26B-A4B-it")
    assert report.status == "registry_only"
    assert report.registry_status == "generation_only"
    assert not report.hook_compatible
    assert report.warnings
