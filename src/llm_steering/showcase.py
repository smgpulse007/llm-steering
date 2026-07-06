from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .config import project_root


SHOWCASE_JSON_PATHS = (
    "research/verified_sources.json",
    "docs/showcase/pre_post_showcase.json",
    "docs/showcase/use_case_showcase.json",
    "docs/showcase/ollama_vs_hf_baseline.json",
)


def _require_keys(payload: dict[str, Any], keys: set[str], *, path: str) -> list[str]:
    return [f"{path}: missing key {key!r}" for key in sorted(keys.difference(payload))]


def _validate_verified_sources(payload: Any, *, path: str) -> list[str]:
    errors: list[str] = []
    if not isinstance(payload, list):
        return [f"{path}: expected a list of source entries"]
    if not payload:
        return [f"{path}: expected at least one source entry"]
    for index, item in enumerate(payload):
        if not isinstance(item, dict):
            errors.append(f"{path}[{index}]: expected object")
            continue
        errors.extend(_require_keys(item, {"title", "url", "summary"}, path=f"{path}[{index}]"))
    return errors


def _validate_pre_post(payload: Any, *, path: str) -> list[str]:
    errors: list[str] = []
    if not isinstance(payload, dict):
        return [f"{path}: expected object"]
    errors.extend(_require_keys(payload, {"pair", "hf_model_id", "layer", "coefficient", "samples"}, path=path))
    samples = payload.get("samples")
    if not isinstance(samples, list) or not samples:
        errors.append(f"{path}: samples must be a non-empty list")
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


def _validate_use_cases(payload: Any, *, path: str) -> list[str]:
    errors: list[str] = []
    if not isinstance(payload, dict):
        return [f"{path}: expected object"]
    use_cases = payload.get("use_cases")
    if not isinstance(use_cases, list) or not use_cases:
        errors.append(f"{path}: use_cases must be a non-empty list")
        return errors
    for index, use_case in enumerate(use_cases):
        if not isinstance(use_case, dict):
            errors.append(f"{path}.use_cases[{index}]: expected object")
            continue
        errors.extend(
            _require_keys(
                use_case,
                {"slug", "title", "category", "user_prompt", "baseline", "steered", "layer", "coefficient"},
                path=f"{path}.use_cases[{index}]",
            )
        )
    return errors


def _validate_ollama_baseline(payload: Any, *, path: str) -> list[str]:
    if not isinstance(payload, dict):
        return [f"{path}: expected object"]
    return _require_keys(payload, {"prompt", "hf_model_id", "status"}, path=path)


VALIDATORS = {
    "research/verified_sources.json": _validate_verified_sources,
    "docs/showcase/pre_post_showcase.json": _validate_pre_post,
    "docs/showcase/use_case_showcase.json": _validate_use_cases,
    "docs/showcase/ollama_vs_hf_baseline.json": _validate_ollama_baseline,
}


def validate_showcase_file(path: str | Path) -> dict[str, object]:
    root = project_root()
    file_path = Path(path)
    display_path = str(file_path)
    if not file_path.is_absolute():
        file_path = root / file_path
    try:
        display_path = str(file_path.resolve().relative_to(root.resolve())).replace("\\", "/")
    except ValueError:
        display_path = str(file_path)

    try:
        payload = json.loads(file_path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {"path": display_path, "ok": False, "errors": ["file does not exist"]}
    except json.JSONDecodeError as exc:
        return {"path": display_path, "ok": False, "errors": [str(exc)]}

    validator = VALIDATORS.get(display_path)
    if validator is None:
        errors: list[str] = []
    else:
        errors = validator(payload, path=display_path)
    return {"path": display_path, "ok": not errors, "errors": errors}


def validate_showcase_files(paths: tuple[str, ...] = SHOWCASE_JSON_PATHS) -> dict[str, object]:
    files = [validate_showcase_file(path) for path in paths]
    return {
        "status": "ok" if all(file_result["ok"] for file_result in files) else "failed",
        "files": files,
    }
