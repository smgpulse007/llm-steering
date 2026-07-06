import torch
from types import SimpleNamespace

from llm_steering.hf_runtime import LoadedHFModel
from llm_steering.introspection import inspect_model_object, registry_only_hook_smoke_report, registry_only_report, run_hook_smoke_test


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


class _TinyTokenizer:
    pad_token_id = 0
    eos_token_id = 1

    def __call__(self, _prompt: str, return_tensors: str) -> dict[str, torch.Tensor]:
        assert return_tensors == "pt"
        return {"input_ids": torch.ones(1, 3, dtype=torch.long)}


class _TinyLayer(torch.nn.Module):
    def forward(self, hidden_states: torch.Tensor) -> torch.Tensor:
        return hidden_states


class _TinyInner(torch.nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.layers = torch.nn.ModuleList([_TinyLayer(), _TinyLayer()])


class _TinyHookModel(torch.nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.model = _TinyInner()
        self.config = SimpleNamespace(model_type="tiny-hook")

    def forward(self, input_ids: torch.Tensor, **_kwargs: object) -> SimpleNamespace:
        hidden = torch.zeros(input_ids.shape[0], input_ids.shape[1], 4)
        hidden_states = [hidden]
        for layer in self.model.layers:
            hidden = layer(hidden)
            hidden_states.append(hidden)
        return SimpleNamespace(hidden_states=tuple(hidden_states))

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


def test_registry_only_hook_smoke_report_does_not_claim_validation() -> None:
    report = registry_only_hook_smoke_report("google/gemma-4-E2B-it")
    payload = report.to_dict()

    assert payload["status"] == "not_run"
    assert payload["mode"] == "registry_only"
    assert payload["checks"] == []
    assert "--load-model" in payload["reproduce_command"]


def test_run_hook_smoke_test_probes_pre_and_post_hooks() -> None:
    loaded = LoadedHFModel(
        model_id="google/gemma-4-E2B-it",
        source="tiny",
        model=_TinyHookModel(),
        tokenizer=_TinyTokenizer(),
        processor=None,
        device=torch.device("cpu"),
    )

    report = run_hook_smoke_test("google/gemma-4-E2B-it", loaded=loaded, layer_index=1)
    payload = report.to_dict()

    assert payload["status"] == "passed"
    assert payload["layer_index"] == 1
    assert payload["layer_count"] == 2
    assert len(payload["checks"]) == 4
    assert {(check["hook_stage"], check["apply_to"]) for check in payload["checks"]} == {
        ("pre", "last_token"),
        ("pre", "all_tokens"),
        ("post", "last_token"),
        ("post", "all_tokens"),
    }
    assert all(check["passed"] and check["hook_fired"] for check in payload["checks"])
