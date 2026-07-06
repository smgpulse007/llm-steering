from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

from .layer_paths import LAYER_PATH_CANDIDATES
from .model_registry import get_model_entry

if TYPE_CHECKING:
    import torch

    from .config import RuntimeSettings
    from .hf_runtime import LoadedHFModel


@dataclass(frozen=True, slots=True)
class LayerPathReport:
    path: str
    found: bool
    layer_count: int | None
    hookable: bool

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


@dataclass(frozen=True, slots=True)
class ModelIntrospectionReport:
    model_id: str
    model_class: str | None
    architecture: str
    registry_status: str
    steering_ready_by_registry: bool
    has_generate: bool
    has_config: bool
    layer_paths: tuple[LayerPathReport, ...]
    hook_compatible: bool
    status: str
    warnings: tuple[str, ...]

    def to_dict(self) -> dict[str, object]:
        payload = asdict(self)
        payload["layer_paths"] = [path.to_dict() for path in self.layer_paths]
        return payload


@dataclass(frozen=True, slots=True)
class HookSmokeCheck:
    hook_stage: str
    apply_to: str
    passed: bool
    hook_fired: bool
    error: str | None

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


@dataclass(frozen=True, slots=True)
class HookSmokeReport:
    model_id: str
    created_at_utc: str
    mode: str
    status: str
    registry_status: str
    steering_ready_by_registry: bool
    model_class: str | None
    architecture: str
    layer_index: int | None
    layer_count: int | None
    checks: tuple[HookSmokeCheck, ...]
    warnings: tuple[str, ...]
    reproduce_command: str

    def to_dict(self) -> dict[str, object]:
        payload = asdict(self)
        payload["checks"] = [check.to_dict() for check in self.checks]
        return payload


def _resolve_attr_path(root: Any, path: str) -> Any | None:
    current = root
    for part in path.split("."):
        if not hasattr(current, part):
            return None
        current = getattr(current, part)
    return current


def inspect_model_object(model: Any, model_id: str) -> ModelIntrospectionReport:
    entry = get_model_entry(model_id)
    layer_reports: list[LayerPathReport] = []
    hook_compatible = False

    for path in LAYER_PATH_CANDIDATES:
        layers = _resolve_attr_path(model, path)
        if layers is None:
            layer_reports.append(LayerPathReport(path=path, found=False, layer_count=None, hookable=False))
            continue

        try:
            layer_count = len(layers)
        except TypeError:
            layer_count = None
        first_layer = layers[0] if layer_count else None
        hookable = bool(hasattr(first_layer, "register_forward_hook") and hasattr(first_layer, "register_forward_pre_hook"))
        hook_compatible = hook_compatible or hookable
        layer_reports.append(LayerPathReport(path=path, found=True, layer_count=layer_count, hookable=hookable))

    config = getattr(model, "config", None)
    architecture = getattr(config, "model_type", entry.architecture) if config is not None else entry.architecture
    warnings = []
    if not hook_compatible:
        warnings.append("No hook-compatible transformer layer path was found.")
    if entry.support_status in {"generation_only", "experimental"}:
        warnings.append(entry.steering_notes)

    if entry.steering_ready and hook_compatible:
        status = "steering_validated_by_registry_and_object"
    elif hook_compatible:
        status = "hook_candidate_needs_smoke_test"
    else:
        status = entry.support_status

    return ModelIntrospectionReport(
        model_id=model_id,
        model_class=type(model).__name__,
        architecture=str(architecture),
        registry_status=entry.support_status,
        steering_ready_by_registry=entry.steering_ready,
        has_generate=hasattr(model, "generate"),
        has_config=config is not None,
        layer_paths=tuple(layer_reports),
        hook_compatible=hook_compatible,
        status=status,
        warnings=tuple(warnings),
    )


def registry_only_report(model_id: str) -> ModelIntrospectionReport:
    entry = get_model_entry(model_id)
    warnings = (entry.steering_notes,) if not entry.steering_ready else ()
    return ModelIntrospectionReport(
        model_id=entry.model_id,
        model_class=None,
        architecture=entry.architecture,
        registry_status=entry.support_status,
        steering_ready_by_registry=entry.steering_ready,
        has_generate=False,
        has_config=False,
        layer_paths=tuple(
            LayerPathReport(path=path, found=False, layer_count=None, hookable=False)
            for path in LAYER_PATH_CANDIDATES
        ),
        hook_compatible=False,
        status="registry_only",
        warnings=warnings,
    )


def registry_only_hook_smoke_report(model_id: str) -> HookSmokeReport:
    entry = get_model_entry(model_id)
    warnings = [
        "Hook smoke test was not run because no model was loaded. Use --load-model for a live adapter check.",
    ]
    if not entry.steering_ready:
        warnings.append(entry.steering_notes)
    return HookSmokeReport(
        model_id=entry.model_id,
        created_at_utc=datetime.now(timezone.utc).isoformat(),
        mode="registry_only",
        status="not_run",
        registry_status=entry.support_status,
        steering_ready_by_registry=entry.steering_ready,
        model_class=None,
        architecture=entry.architecture,
        layer_index=None,
        layer_count=None,
        checks=(),
        warnings=tuple(warnings),
        reproduce_command=f'llm-steering hook-smoke "{entry.model_id}" --load-model',
    )


def _failed_hook_smoke_report(
    model_id: str,
    *,
    error: Exception,
    layer_index: int | None,
    mode: str = "loaded_model",
) -> HookSmokeReport:
    entry = get_model_entry(model_id)
    layer_arg = f" --layer {layer_index}" if layer_index is not None else ""
    return HookSmokeReport(
        model_id=entry.model_id,
        created_at_utc=datetime.now(timezone.utc).isoformat(),
        mode=mode,
        status="failed",
        registry_status=entry.support_status,
        steering_ready_by_registry=entry.steering_ready,
        model_class=None,
        architecture=entry.architecture,
        layer_index=layer_index,
        layer_count=None,
        checks=(),
        warnings=(f"Hook smoke failed before probes: {error}",),
        reproduce_command=f'llm-steering hook-smoke "{entry.model_id}" --load-model{layer_arg}',
    )


def _selected_layer_index(default_layer: int | None, requested_layer: int | None, layer_count: int) -> int:
    if requested_layer is not None:
        if requested_layer < 0 or requested_layer >= layer_count:
            raise IndexError(f"Layer index {requested_layer} is out of bounds for {layer_count} layers.")
        return requested_layer
    if default_layer is not None and 0 <= default_layer < layer_count:
        return default_layer
    return max(0, layer_count // 2)


def _run_forward_for_smoke(loaded: LoadedHFModel, *, system_prompt: str, user_prompt: str) -> bool:
    import torch

    from .hf_runtime import prepare_text_inputs

    inputs = prepare_text_inputs(loaded, system_prompt, user_prompt)
    with torch.no_grad():
        outputs = loaded.model(**inputs, output_hidden_states=True, return_dict=True, use_cache=False)
    return getattr(outputs, "hidden_states", None) is not None


def _smoke_one_hook(
    loaded: LoadedHFModel,
    *,
    layer_index: int,
    direction: torch.Tensor,
    hook_stage: str,
    apply_to: str,
    system_prompt: str,
    user_prompt: str,
) -> HookSmokeCheck:
    from .steering import steering_hook

    fired = False

    def mark_fired() -> None:
        nonlocal fired
        fired = True

    try:
        with steering_hook(
            loaded.model,
            layer_index=layer_index,
            direction=direction,
            apply_to=apply_to,
            hook_stage=hook_stage,
            on_apply=mark_fired,
        ):
            returned_hidden_states = _run_forward_for_smoke(
                loaded,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
            )
        return HookSmokeCheck(
            hook_stage=hook_stage,
            apply_to=apply_to,
            passed=fired and returned_hidden_states,
            hook_fired=fired,
            error=None if fired and returned_hidden_states else "Hook did not fire or hidden states were not returned.",
        )
    except Exception as exc:
        return HookSmokeCheck(
            hook_stage=hook_stage,
            apply_to=apply_to,
            passed=False,
            hook_fired=fired,
            error=str(exc),
        )


def run_hook_smoke_test(
    model_id: str,
    *,
    settings: RuntimeSettings | None = None,
    loaded: LoadedHFModel | None = None,
    load_model: bool = False,
    layer_index: int | None = None,
    system_prompt: str = "",
    user_prompt: str = "Reply with one short sentence.",
) -> HookSmokeReport:
    entry = get_model_entry(model_id)
    if loaded is None and not load_model:
        return registry_only_hook_smoke_report(model_id)

    import torch

    from .config import RuntimeSettings
    from .hf_runtime import load_hf_model
    from .steering import (
        SUPPORTED_APPLY_TO,
        SUPPORTED_HOOK_STAGES,
        collect_hidden_state,
        locate_transformer_layers,
    )

    try:
        runtime_settings = settings or RuntimeSettings.from_env()
        loaded_model = loaded or load_hf_model(runtime_settings, model_id=model_id)
        introspection = inspect_model_object(loaded_model.model, model_id)
        layers = locate_transformer_layers(loaded_model.model)
        layer_count = len(layers)
        selected_layer = _selected_layer_index(entry.default_layer, layer_index, layer_count)
        vector = collect_hidden_state(
            loaded_model,
            prompt=user_prompt,
            system_prompt=system_prompt,
            layer_index=selected_layer,
        )
    except Exception as exc:
        return _failed_hook_smoke_report(model_id, error=exc, layer_index=layer_index)
    direction = torch.zeros_like(vector)

    checks = tuple(
        _smoke_one_hook(
            loaded_model,
            layer_index=selected_layer,
            direction=direction,
            hook_stage=hook_stage,
            apply_to=apply_to,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
        )
        for hook_stage in SUPPORTED_HOOK_STAGES
        for apply_to in SUPPORTED_APPLY_TO
    )
    all_passed = all(check.passed for check in checks)
    warnings = list(introspection.warnings)
    if all_passed and not entry.steering_ready:
        warnings.append("Hook smoke passed, but the registry still gates steering for this model.")
    elif not all_passed:
        warnings.append("At least one hook smoke check failed; do not enable steering controls for this model.")

    status = "passed" if all_passed and entry.steering_ready else "passed_needs_registry_update" if all_passed else "failed"
    layer_arg = f" --layer {selected_layer}" if layer_index is not None else ""
    return HookSmokeReport(
        model_id=entry.model_id,
        created_at_utc=datetime.now(timezone.utc).isoformat(),
        mode="loaded_model",
        status=status,
        registry_status=entry.support_status,
        steering_ready_by_registry=entry.steering_ready,
        model_class=introspection.model_class,
        architecture=introspection.architecture,
        layer_index=selected_layer,
        layer_count=layer_count,
        checks=checks,
        warnings=tuple(warnings),
        reproduce_command=f'llm-steering hook-smoke "{entry.model_id}" --load-model{layer_arg}',
    )
