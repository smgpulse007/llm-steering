from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Sequence

import torch
import torch.nn.functional as F

from .hf_runtime import LoadedHFModel, generate_text, prepare_text_inputs


LAYER_PATH_CANDIDATES = (
    "model.language_model.layers",
    "model.language_model.model.layers",
    "model.layers",
    "language_model.model.layers",
    "language_model.layers",
    "transformer.h",
    "gpt_neox.layers",
    "model.decoder.layers",
)
SUPPORTED_APPLY_TO = ("all_tokens", "last_token")
SUPPORTED_HOOK_STAGES = ("post", "pre")


@dataclass(slots=True)
class SteeringVectorArtifact:
    vector: torch.Tensor
    metadata: dict[str, Any]


def _resolve_attr_path(root: Any, path: str) -> Any | None:
    current = root
    for part in path.split("."):
        if not hasattr(current, part):
            return None
        current = getattr(current, part)
    return current


def locate_transformer_layers(model: Any) -> Sequence[Any]:
    for path in LAYER_PATH_CANDIDATES:
        layers = _resolve_attr_path(model, path)
        if layers is not None:
            return layers
    raise RuntimeError(
        "Could not locate transformer layers on the loaded model. "
        f"Tried: {', '.join(LAYER_PATH_CANDIDATES)}"
    )


def collect_hidden_state(
    loaded: LoadedHFModel,
    *,
    prompt: str,
    system_prompt: str,
    layer_index: int,
    token_position: int = -1,
) -> torch.Tensor:
    inputs = prepare_text_inputs(loaded, system_prompt, prompt)
    with torch.no_grad():
        outputs = loaded.model(**inputs, output_hidden_states=True, return_dict=True, use_cache=False)

    hidden_states = getattr(outputs, "hidden_states", None)
    if hidden_states is None:
        raise RuntimeError("The loaded model did not return hidden states.")

    state_index = layer_index + 1
    if state_index >= len(hidden_states):
        raise IndexError(
            f"Layer index {layer_index} is out of range for returned hidden states of length {len(hidden_states)}."
        )

    selected = hidden_states[state_index][:, token_position, :].detach().squeeze(0).cpu()
    return selected


def compute_steering_vector(
    loaded: LoadedHFModel,
    *,
    positive_prompt: str,
    negative_prompt: str,
    system_prompt: str,
    layer_index: int,
    token_position: int = -1,
    normalize: bool = True,
) -> SteeringVectorArtifact:
    positive_state = collect_hidden_state(
        loaded,
        prompt=positive_prompt,
        system_prompt=system_prompt,
        layer_index=layer_index,
        token_position=token_position,
    )
    negative_state = collect_hidden_state(
        loaded,
        prompt=negative_prompt,
        system_prompt=system_prompt,
        layer_index=layer_index,
        token_position=token_position,
    )
    vector = positive_state - negative_state
    if normalize:
        vector = F.normalize(vector, dim=0)

    metadata = {
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "model_id": loaded.model_id,
        "source": loaded.source,
        "positive_prompt": positive_prompt,
        "negative_prompt": negative_prompt,
        "system_prompt": system_prompt,
        "layer_index": layer_index,
        "token_position": token_position,
        "normalize": normalize,
        "method": "actadd_single_pair",
    }
    return SteeringVectorArtifact(vector=vector, metadata=metadata)


def compute_mean_difference_vector(
    loaded: LoadedHFModel,
    *,
    positives: Iterable[str],
    negatives: Iterable[str],
    system_prompt: str,
    layer_index: int,
    token_position: int = -1,
    normalize: bool = True,
) -> SteeringVectorArtifact:
    positive_list = list(positives)
    negative_list = list(negatives)
    if len(positive_list) != len(negative_list):
        raise ValueError("Positive and negative prompt collections must have the same length.")
    if not positive_list:
        raise ValueError("At least one positive/negative prompt pair is required.")

    diffs = []
    for positive_prompt, negative_prompt in zip(positive_list, negative_list, strict=True):
        diff = compute_steering_vector(
            loaded,
            positive_prompt=positive_prompt,
            negative_prompt=negative_prompt,
            system_prompt=system_prompt,
            layer_index=layer_index,
            token_position=token_position,
            normalize=False,
        ).vector
        diffs.append(diff)

    vector = torch.stack(diffs, dim=0).mean(dim=0)
    if normalize:
        vector = F.normalize(vector, dim=0)

    metadata = {
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "model_id": loaded.model_id,
        "source": loaded.source,
        "system_prompt": system_prompt,
        "layer_index": layer_index,
        "token_position": token_position,
        "normalize": normalize,
        "pair_count": len(positive_list),
        "method": "mean_difference",
    }
    return SteeringVectorArtifact(vector=vector, metadata=metadata)


def save_vector(artifact: SteeringVectorArtifact, path: str | Path) -> Path:
    save_path = Path(path)
    save_path.parent.mkdir(parents=True, exist_ok=True)
    torch.save({"vector": artifact.vector, "metadata": artifact.metadata}, save_path)
    return save_path


def load_vector(path: str | Path) -> SteeringVectorArtifact:
    payload = torch.load(Path(path), map_location="cpu")
    return SteeringVectorArtifact(vector=payload["vector"], metadata=payload["metadata"])


def _unpack_layer_output(output: Any) -> tuple[torch.Tensor, tuple[Any, ...] | None]:
    if isinstance(output, torch.Tensor):
        return output, None
    if isinstance(output, tuple) and output and isinstance(output[0], torch.Tensor):
        return output[0], output[1:]
    raise TypeError(f"Unsupported layer output type for steering hook: {type(output)!r}")


def _apply_direction(hidden: torch.Tensor, direction: torch.Tensor, apply_to: str) -> torch.Tensor:
    local_direction = direction.to(device=hidden.device, dtype=hidden.dtype)
    if apply_to == "all_tokens":
        return hidden + local_direction.view(1, 1, -1)
    if apply_to == "last_token":
        updated = hidden.clone()
        updated[:, -1, :] = updated[:, -1, :] + local_direction
        return updated
    raise ValueError(
        f"Unsupported apply_to value: {apply_to!r}. Expected one of {SUPPORTED_APPLY_TO}."
    )


def _make_post_addition_hook(direction: torch.Tensor, apply_to: str) -> Any:
    def hook(_module: Any, _inputs: Any, output: Any) -> Any:
        hidden, tail = _unpack_layer_output(output)
        updated = _apply_direction(hidden, direction, apply_to)

        if tail is None:
            return updated
        return (updated, *tail)

    return hook


def _make_pre_addition_hook(direction: torch.Tensor, apply_to: str) -> Any:
    def hook(_module: Any, args: tuple[Any, ...], kwargs: dict[str, Any]) -> tuple[tuple[Any, ...], dict[str, Any]]:
        if args and isinstance(args[0], torch.Tensor):
            updated_hidden = _apply_direction(args[0], direction, apply_to)
            return (updated_hidden, *args[1:]), kwargs

        hidden_states = kwargs.get("hidden_states")
        if isinstance(hidden_states, torch.Tensor):
            updated_kwargs = dict(kwargs)
            updated_kwargs["hidden_states"] = _apply_direction(hidden_states, direction, apply_to)
            return args, updated_kwargs

        raise TypeError("Could not locate the hidden-states tensor for the steering pre-hook.")

    return hook


@contextmanager
def steering_hook(
    model: torch.nn.Module,
    *,
    layer_index: int,
    direction: torch.Tensor,
    apply_to: str = "last_token",
    hook_stage: str = "post",
):
    layers = locate_transformer_layers(model)
    if layer_index < 0 or layer_index >= len(layers):
        raise IndexError(f"Layer index {layer_index} is out of bounds for {len(layers)} layers.")

    if hook_stage == "post":
        handle = layers[layer_index].register_forward_hook(_make_post_addition_hook(direction, apply_to))
    elif hook_stage == "pre":
        handle = layers[layer_index].register_forward_pre_hook(
            _make_pre_addition_hook(direction, apply_to),
            with_kwargs=True,
        )
    else:
        raise ValueError(
            f"Unsupported hook_stage value: {hook_stage!r}. Expected one of {SUPPORTED_HOOK_STAGES}."
        )

    try:
        yield
    finally:
        handle.remove()


def generate_with_steering(
    loaded: LoadedHFModel,
    *,
    system_prompt: str,
    user_prompt: str,
    vector: torch.Tensor,
    layer_index: int,
    coefficient: float,
    apply_to: str,
    hook_stage: str = "post",
    max_new_tokens: int,
    do_sample: bool = False,
    temperature: float = 1.0,
    top_p: float = 0.95,
    top_k: int = 64,
) -> str:
    direction = vector * coefficient
    with steering_hook(
        loaded.model,
        layer_index=layer_index,
        direction=direction,
        apply_to=apply_to,
        hook_stage=hook_stage,
    ):
        return generate_text(
            loaded,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            max_new_tokens=max_new_tokens,
            do_sample=do_sample,
            temperature=temperature,
            top_p=top_p,
            top_k=top_k,
        )
