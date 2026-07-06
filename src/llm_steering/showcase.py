from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .artifacts import (
    PRE_POST_SHOWCASE_KIND,
    RUNTIME_BASELINE_KIND,
    USE_CASE_SHOWCASE_KIND,
    validate_pre_post_showcase,
    validate_runtime_baseline,
    validate_use_case_showcase,
)


SHOWCASE_JSON_PATHS = (
    "research/verified_sources.json",
    "docs/showcase/pre_post_showcase.json",
    "docs/showcase/use_case_showcase.json",
    "docs/showcase/ollama_vs_hf_baseline.json",
)


def project_root() -> Path:
    return Path(__file__).resolve().parents[2]


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
    errors = validate_pre_post_showcase(payload, path=path)
    if isinstance(payload, dict) and payload.get("artifact_kind") != PRE_POST_SHOWCASE_KIND:
        errors.append(f"{path}: expected {PRE_POST_SHOWCASE_KIND!r} artifact")
    return errors


def _validate_use_cases(payload: Any, *, path: str) -> list[str]:
    errors = validate_use_case_showcase(payload, path=path)
    if isinstance(payload, dict) and payload.get("artifact_kind") != USE_CASE_SHOWCASE_KIND:
        errors.append(f"{path}: expected {USE_CASE_SHOWCASE_KIND!r} artifact")
    return errors


def _validate_ollama_baseline(payload: Any, *, path: str) -> list[str]:
    errors = validate_runtime_baseline(payload, path=path)
    if isinstance(payload, dict) and payload.get("artifact_kind") != RUNTIME_BASELINE_KIND:
        errors.append(f"{path}: expected {RUNTIME_BASELINE_KIND!r} artifact")
    return errors


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
