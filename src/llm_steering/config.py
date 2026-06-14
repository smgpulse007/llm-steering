from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import os
from typing import Any

from huggingface_hub import get_token
import yaml
from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_ENV_PATH = PROJECT_ROOT / ".env"
SUPPORTED_APPLY_TO = {"last_token", "all_tokens"}
SUPPORTED_HOOK_STAGES = {"post", "pre"}


def project_root() -> Path:
    return PROJECT_ROOT


def load_environment(env_path: Path | None = None, *, override: bool = False) -> None:
    load_dotenv(env_path or DEFAULT_ENV_PATH, override=override)


def _read_env(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name)
    if value is None or value == "":
        return default
    return value


def _read_int(name: str, default: int) -> int:
    raw = _read_env(name)
    return int(raw) if raw is not None else default


def _read_float(name: str, default: float) -> float:
    raw = _read_env(name)
    return float(raw) if raw is not None else default


def _resolve_hf_token() -> str | None:
    env_token = _read_env("HF_TOKEN")
    if env_token is not None:
        return env_token
    return get_token()


@dataclass(slots=True)
class RuntimeSettings:
    hf_token: str | None
    hf_model_id: str
    hf_model_local_dir: Path
    ollama_model: str
    ollama_base_url: str
    default_layer: int
    default_coefficient: float
    max_new_tokens: int

    @classmethod
    def from_env(cls, env_path: Path | None = None) -> "RuntimeSettings":
        load_environment(env_path)
        return cls(
            hf_token=_resolve_hf_token(),
            hf_model_id=_read_env("HF_MODEL_ID", "google/gemma-4-E2B-it") or "google/gemma-4-E2B-it",
            hf_model_local_dir=Path(
                _read_env("HF_MODEL_LOCAL_DIR", "models/hf/google_gemma-4-E2B-it")
                or "models/hf/google_gemma-4-E2B-it"
            ),
            ollama_model=_read_env("OLLAMA_MODEL", "gemma4") or "gemma4",
            ollama_base_url=_read_env("OLLAMA_BASE_URL", "http://localhost:11434") or "http://localhost:11434",
            default_layer=_read_int("DEFAULT_STEERING_LAYER", 18),
            default_coefficient=_read_float("DEFAULT_STEERING_COEFFICIENT", 1.5),
            max_new_tokens=_read_int("MAX_NEW_TOKENS", 96),
        )


@dataclass(slots=True)
class PromptPair:
    name: str
    description: str
    positive: str
    negative: str
    system_prompt: str
    default_user_prompt: str
    layer: int
    coefficient: float
    apply_to: str = "last_token"
    hook_stage: str = "post"
    normalize: bool = True


REQUIRED_PROMPT_KEYS = {
    "name",
    "description",
    "positive",
    "negative",
    "system_prompt",
    "default_user_prompt",
    "layer",
    "coefficient",
}


def load_prompt_pair(path: str | Path) -> PromptPair:
    config_path = Path(path)
    with config_path.open("r", encoding="utf-8") as handle:
        data: dict[str, Any] = yaml.safe_load(handle)

    missing = REQUIRED_PROMPT_KEYS.difference(data)
    if missing:
        raise ValueError(f"Missing keys in prompt pair config {config_path}: {sorted(missing)}")

    apply_to = str(data.get("apply_to", "last_token"))
    if apply_to not in SUPPORTED_APPLY_TO:
        raise ValueError(
            f"Unsupported apply_to value {apply_to!r} in prompt pair config {config_path}. "
            f"Expected one of {sorted(SUPPORTED_APPLY_TO)}."
        )

    hook_stage = str(data.get("hook_stage", "post")).lower()
    if hook_stage not in SUPPORTED_HOOK_STAGES:
        raise ValueError(
            f"Unsupported hook_stage value {hook_stage!r} in prompt pair config {config_path}. "
            f"Expected one of {sorted(SUPPORTED_HOOK_STAGES)}."
        )

    return PromptPair(
        name=str(data["name"]),
        description=str(data["description"]),
        positive=str(data["positive"]),
        negative=str(data["negative"]),
        system_prompt=str(data["system_prompt"]),
        default_user_prompt=str(data["default_user_prompt"]),
        layer=int(data["layer"]),
        coefficient=float(data["coefficient"]),
        apply_to=apply_to,
        hook_stage=hook_stage,
        normalize=bool(data.get("normalize", True)),
    )
