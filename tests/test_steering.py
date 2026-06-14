import torch

from llm_steering.steering import SteeringVectorArtifact, load_vector, locate_transformer_layers, save_vector, steering_hook


class _Inner:
    def __init__(self) -> None:
        self.layers = [object(), object(), object()]


class _LanguageModel:
    def __init__(self) -> None:
        self.model = _Inner()


class _FakeModel:
    def __init__(self) -> None:
        self.language_model = _LanguageModel()


class _Gemma4TextModel:
    def __init__(self) -> None:
        self.layers = [object(), object(), object(), object()]


class _Gemma4OuterModel:
    def __init__(self) -> None:
        self.language_model = _Gemma4TextModel()


class _FakeGemma4Wrapper:
    def __init__(self) -> None:
        self.model = _Gemma4OuterModel()


class _IdentityLayer(torch.nn.Module):
    def forward(self, hidden_states: torch.Tensor) -> torch.Tensor:
        return hidden_states


class _KeywordIdentityLayer(torch.nn.Module):
    def forward(self, *, hidden_states: torch.Tensor) -> torch.Tensor:
        return hidden_states


class _HookableModel:
    def __init__(self, layer: torch.nn.Module) -> None:
        self.model = _InnerHookable(layer)


class _InnerHookable:
    def __init__(self, layer: torch.nn.Module) -> None:
        self.layers = [layer]


def test_locate_transformer_layers_uses_nested_candidate_path() -> None:
    fake_model = _FakeModel()
    layers = locate_transformer_layers(fake_model)
    assert len(layers) == 3


def test_locate_transformer_layers_supports_gemma4_wrapper_path() -> None:
    fake_model = _FakeGemma4Wrapper()
    layers = locate_transformer_layers(fake_model)
    assert len(layers) == 4


def test_save_and_load_vector_roundtrip(tmp_path) -> None:
    artifact = SteeringVectorArtifact(vector=torch.tensor([1.0, 2.0]), metadata={"name": "demo"})
    path = tmp_path / "vector.pt"
    save_vector(artifact, path)
    loaded = load_vector(path)
    assert torch.equal(loaded.vector, artifact.vector)
    assert loaded.metadata["name"] == "demo"


def test_steering_hook_post_stage_updates_last_token_only() -> None:
    layer = _IdentityLayer()
    model = _HookableModel(layer)
    hidden = torch.zeros(1, 3, 2)
    direction = torch.tensor([0.5, 1.0])

    with steering_hook(model, layer_index=0, direction=direction, apply_to="last_token", hook_stage="post"):
        updated = layer(hidden)

    assert torch.equal(updated[:, 0, :], torch.zeros(1, 2))
    assert torch.equal(updated[:, -1, :], direction.view(1, 2))


def test_steering_hook_pre_stage_supports_positional_hidden_states() -> None:
    layer = _IdentityLayer()
    model = _HookableModel(layer)
    hidden = torch.zeros(1, 2, 2)
    direction = torch.tensor([1.0, -1.0])

    with steering_hook(model, layer_index=0, direction=direction, apply_to="all_tokens", hook_stage="pre"):
        updated = layer(hidden)

    expected = torch.tensor([[[1.0, -1.0], [1.0, -1.0]]])
    assert torch.equal(updated, expected)


def test_steering_hook_pre_stage_supports_keyword_hidden_states() -> None:
    layer = _KeywordIdentityLayer()
    model = _HookableModel(layer)
    hidden = torch.zeros(1, 1, 2)
    direction = torch.tensor([2.0, 3.0])

    with steering_hook(model, layer_index=0, direction=direction, apply_to="last_token", hook_stage="pre"):
        updated = layer(hidden_states=hidden)

    assert torch.equal(updated[:, -1, :], direction.view(1, 2))
