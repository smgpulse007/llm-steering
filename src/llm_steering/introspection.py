from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

from .model_registry import get_model_entry
from .steering import LAYER_PATH_CANDIDATES


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
