from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Callable


EXPERIMENT_SCHEMA_VERSION = "llm-steering.experiment.v1"
VECTOR_SCHEMA_VERSION = "llm-steering.vector.v1"
SHOWCASE_SCHEMA_VERSION = "llm-steering.showcase.v1"

EXPERIMENT_KIND = "experiment_result"
VECTOR_KIND = "vector_artifact"
PRE_POST_SHOWCASE_KIND = "pre_post_showcase"
USE_CASE_SHOWCASE_KIND = "use_case_showcase"
RUNTIME_BASELINE_KIND = "runtime_baseline"


def _require_mapping(payload: Any, *, path: str) -> list[str]:
    return [] if isinstance(payload, dict) else [f"{path}: expected object"]


def _require_keys(payload: dict[str, Any], keys: set[str], *, path: str) -> list[str]:
    return [f"{path}: missing key {key!r}" for key in sorted(keys.difference(payload))]


def _require_schema(payload: dict[str, Any], *, kind: str, path: str) -> list[str]:
    errors: list[str] = []
    if payload.get("schema_version") != SHOWCASE_SCHEMA_VERSION and kind in {
        PRE_POST_SHOWCASE_KIND,
        USE_CASE_SHOWCASE_KIND,
        RUNTIME_BASELINE_KIND,
    }:
        errors.append(f"{path}: schema_version must be {SHOWCASE_SCHEMA_VERSION!r}")
    if payload.get("schema_version") != EXPERIMENT_SCHEMA_VERSION and kind == EXPERIMENT_KIND:
        errors.append(f"{path}: schema_version must be {EXPERIMENT_SCHEMA_VERSION!r}")
    if payload.get("schema_version") != VECTOR_SCHEMA_VERSION and kind == VECTOR_KIND:
        errors.append(f"{path}: schema_version must be {VECTOR_SCHEMA_VERSION!r}")
    if payload.get("artifact_kind") != kind:
        errors.append(f"{path}: artifact_kind must be {kind!r}")
    return errors


def validate_experiment_result(payload: Any, *, path: str = "artifact") -> list[str]:
    errors = _require_mapping(payload, path=path)
    if errors:
        return errors
    assert isinstance(payload, dict)
    errors.extend(_require_schema(payload, kind=EXPERIMENT_KIND, path=path))
    errors.extend(
        _require_keys(
            payload,
            {
                "experiment_id",
                "created_at_utc",
                "request",
                "model_status",
                "baseline",
                "prompt_only",
                "steered",
                "prompt_control",
                "diagnostics",
                "output_delta",
                "control_delta",
                "steering_delta",
                "reproduce_command",
            },
            path=path,
        )
    )
    if not isinstance(payload.get("request"), dict):
        errors.append(f"{path}.request: expected object")
    if not isinstance(payload.get("model_status"), dict):
        errors.append(f"{path}.model_status: expected object")
    if not isinstance(payload.get("diagnostics"), dict):
        errors.append(f"{path}.diagnostics: expected object")
    if not isinstance(payload.get("output_delta"), dict):
        errors.append(f"{path}.output_delta: expected object")
    if not isinstance(payload.get("prompt_control"), dict):
        errors.append(f"{path}.prompt_control: expected object")
    if not isinstance(payload.get("control_delta"), dict):
        errors.append(f"{path}.control_delta: expected object")
    if not isinstance(payload.get("steering_delta"), dict):
        errors.append(f"{path}.steering_delta: expected object")
    return errors


def validate_vector_artifact(payload: Any, *, path: str = "artifact") -> list[str]:
    errors = _require_mapping(payload, path=path)
    if errors:
        return errors
    assert isinstance(payload, dict)
    errors.extend(_require_schema(payload, kind=VECTOR_KIND, path=path))
    errors.extend(_require_keys(payload, {"vector_id", "model_id", "method", "metadata", "diagnostics"}, path=path))
    if not isinstance(payload.get("metadata"), dict):
        errors.append(f"{path}.metadata: expected object")
    if not isinstance(payload.get("diagnostics"), dict):
        errors.append(f"{path}.diagnostics: expected object")
    return errors


def validate_pre_post_showcase(payload: Any, *, path: str = "artifact") -> list[str]:
    errors = _require_mapping(payload, path=path)
    if errors:
        return errors
    assert isinstance(payload, dict)
    errors.extend(_require_schema(payload, kind=PRE_POST_SHOWCASE_KIND, path=path))
    errors.extend(
        _require_keys(
            payload,
            {"pair", "hf_model_id", "layer", "coefficient", "samples", "vector_norm"},
            path=path,
        )
    )
    samples = payload.get("samples")
    if not isinstance(samples, list) or not samples:
        errors.append(f"{path}.samples: expected non-empty list")
        return errors
    for index, sample in enumerate(samples):
        if not isinstance(sample, dict):
            errors.append(f"{path}.samples[{index}]: expected object")
            continue
        errors.extend(
            _require_keys(
                sample,
                {"user_prompt", "baseline", "post_activation", "pre_activation"},
                path=f"{path}.samples[{index}]",
            )
        )
    return errors


def validate_use_case_showcase(payload: Any, *, path: str = "artifact") -> list[str]:
    errors = _require_mapping(payload, path=path)
    if errors:
        return errors
    assert isinstance(payload, dict)
    errors.extend(_require_schema(payload, kind=USE_CASE_SHOWCASE_KIND, path=path))
    use_cases = payload.get("use_cases")
    if not isinstance(use_cases, list) or not use_cases:
        errors.append(f"{path}.use_cases: expected non-empty list")
        return errors
    for index, use_case in enumerate(use_cases):
        if not isinstance(use_case, dict):
            errors.append(f"{path}.use_cases[{index}]: expected object")
            continue
        errors.extend(
            _require_keys(
                use_case,
                {
                    "slug",
                    "title",
                    "category",
                    "user_prompt",
                    "baseline",
                    "steered",
                    "layer",
                    "coefficient",
                    "hook_stage",
                },
                path=f"{path}.use_cases[{index}]",
            )
        )
    return errors


def validate_runtime_baseline(payload: Any, *, path: str = "artifact") -> list[str]:
    errors = _require_mapping(payload, path=path)
    if errors:
        return errors
    assert isinstance(payload, dict)
    errors.extend(_require_schema(payload, kind=RUNTIME_BASELINE_KIND, path=path))
    errors.extend(_require_keys(payload, {"prompt", "hf_model_id", "status"}, path=path))
    return errors


ARTIFACT_VALIDATORS: dict[str, Callable[[Any], list[str]]] = {
    EXPERIMENT_KIND: lambda payload: validate_experiment_result(payload),
    VECTOR_KIND: lambda payload: validate_vector_artifact(payload),
    PRE_POST_SHOWCASE_KIND: lambda payload: validate_pre_post_showcase(payload),
    USE_CASE_SHOWCASE_KIND: lambda payload: validate_use_case_showcase(payload),
    RUNTIME_BASELINE_KIND: lambda payload: validate_runtime_baseline(payload),
}


def validate_artifact_payload(payload: Any, *, path: str = "artifact") -> dict[str, object]:
    if not isinstance(payload, dict):
        return {"path": path, "kind": None, "ok": False, "errors": [f"{path}: expected object"]}
    kind = payload.get("artifact_kind")
    validator = ARTIFACT_VALIDATORS.get(str(kind))
    if validator is None:
        return {"path": path, "kind": kind, "ok": False, "errors": [f"{path}: unknown artifact_kind {kind!r}"]}

    if kind == EXPERIMENT_KIND:
        errors = validate_experiment_result(payload, path=path)
    elif kind == VECTOR_KIND:
        errors = validate_vector_artifact(payload, path=path)
    elif kind == PRE_POST_SHOWCASE_KIND:
        errors = validate_pre_post_showcase(payload, path=path)
    elif kind == USE_CASE_SHOWCASE_KIND:
        errors = validate_use_case_showcase(payload, path=path)
    else:
        errors = validate_runtime_baseline(payload, path=path)

    return {"path": path, "kind": kind, "ok": not errors, "errors": errors}


def validate_artifact_file(path: str | Path) -> dict[str, object]:
    file_path = Path(path)
    try:
        payload = json.loads(file_path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {"path": str(file_path), "kind": None, "ok": False, "errors": ["file does not exist"]}
    except json.JSONDecodeError as exc:
        return {"path": str(file_path), "kind": None, "ok": False, "errors": [str(exc)]}
    return validate_artifact_payload(payload, path=str(file_path))


def validate_artifact_files(paths: list[str | Path]) -> dict[str, object]:
    files = [validate_artifact_file(path) for path in paths]
    return {"status": "ok" if all(file_result["ok"] for file_result in files) else "failed", "files": files}
