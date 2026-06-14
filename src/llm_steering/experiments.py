from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any
from uuid import uuid4

import torch

from .config import RuntimeSettings, project_root
from .hf_runtime import LoadedHFModel, generate_text, load_hf_model
from .metrics import output_delta_metrics, vector_diagnostics
from .model_registry import get_model_entry
from .steering import (
    SteeringVectorArtifact,
    compute_mean_difference_vector,
    compute_steering_vector,
    generate_with_steering,
    save_vector,
)


SUPPORTED_APPLY_TO = {"last_token", "all_tokens"}
SUPPORTED_HOOK_STAGES = {"post", "pre"}


class SteeringReadinessError(ValueError):
    pass


def require_steering_ready(model_id: str) -> dict[str, object]:
    entry = get_model_entry(model_id)
    if not entry.steering_ready:
        raise SteeringReadinessError(f"{model_id} is not steering-ready: {entry.steering_notes}")
    return entry.to_dict()


@dataclass(frozen=True, slots=True)
class PromptPairSpec:
    positive: str
    negative: str


@dataclass(frozen=True, slots=True)
class ExperimentRequest:
    model_id: str
    system_prompt: str
    user_prompt: str
    prompt_pairs: tuple[PromptPairSpec, ...]
    layer: int
    coefficient: float
    apply_to: str = "last_token"
    hook_stage: str = "post"
    normalize: bool = True
    max_new_tokens: int = 96
    do_sample: bool = False
    temperature: float = 1.0
    top_p: float = 0.95
    top_k: int = 64


@dataclass(frozen=True, slots=True)
class ExperimentResult:
    experiment_id: str
    created_at_utc: str
    request: dict[str, object]
    model_status: dict[str, object]
    baseline: str
    steered: str
    diagnostics: dict[str, object]
    output_delta: dict[str, object]
    vector_path: str | None
    artifact_path: str | None
    reproduce_command: str

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


def _repo_relative(path: Path | None) -> str | None:
    if path is None:
        return None
    try:
        return str(path.resolve().relative_to(project_root()))
    except ValueError:
        return str(path)


def build_cli_command(request: ExperimentRequest) -> str:
    return (
        "python scripts/run_actadd.py "
        "--config <prompt-pair-config.yaml> "
        f'--hf-model-id "{request.model_id}" '
        f"--layer {request.layer} "
        f"--coefficient {request.coefficient} "
        f"--hook-stage {request.hook_stage} "
        f"--max-new-tokens {request.max_new_tokens}"
    )


def default_vector_path(request: ExperimentRequest, experiment_id: str) -> Path:
    model_stub = request.model_id.replace("/", "_").replace(":", "_")
    return project_root() / "vectors" / f"{experiment_id}_{model_stub}_layer{request.layer}.pt"


def default_result_path(experiment_id: str) -> Path:
    return project_root() / "results" / f"{experiment_id}.json"


def _build_vector(loaded: LoadedHFModel, request: ExperimentRequest) -> SteeringVectorArtifact:
    if not request.prompt_pairs:
        raise ValueError("At least one prompt pair is required.")
    if len(request.prompt_pairs) == 1:
        pair = request.prompt_pairs[0]
        return compute_steering_vector(
            loaded,
            positive_prompt=pair.positive,
            negative_prompt=pair.negative,
            system_prompt=request.system_prompt,
            layer_index=request.layer,
            normalize=request.normalize,
        )
    return compute_mean_difference_vector(
        loaded,
        positives=[pair.positive for pair in request.prompt_pairs],
        negatives=[pair.negative for pair in request.prompt_pairs],
        system_prompt=request.system_prompt,
        layer_index=request.layer,
        normalize=request.normalize,
    )


def build_vector_artifact(
    request: ExperimentRequest,
    *,
    settings: RuntimeSettings | None = None,
    loaded: LoadedHFModel | None = None,
    save_artifact: bool = True,
) -> dict[str, object]:
    require_steering_ready(request.model_id)

    runtime_settings = settings or RuntimeSettings.from_env()
    loaded_model = loaded or load_hf_model(runtime_settings, model_id=request.model_id)
    artifact = _build_vector(loaded_model, request)
    vector_id = f"vec_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{uuid4().hex[:8]}"
    vector_path = default_vector_path(request, vector_id) if save_artifact else None
    if vector_path is not None:
        save_vector(artifact, vector_path)

    return {
        "vector_id": vector_id,
        "model_id": request.model_id,
        "method": artifact.metadata.get("method"),
        "metadata": artifact.metadata,
        "diagnostics": vector_diagnostics(artifact.vector).to_dict(),
        "vector_path": _repo_relative(vector_path),
    }


def run_experiment(
    request: ExperimentRequest,
    *,
    settings: RuntimeSettings | None = None,
    loaded: LoadedHFModel | None = None,
    save_artifacts: bool = True,
) -> ExperimentResult:
    entry = get_model_entry(request.model_id)
    require_steering_ready(request.model_id)

    runtime_settings = settings or RuntimeSettings.from_env()
    loaded_model = loaded or load_hf_model(runtime_settings, model_id=request.model_id)
    artifact = _build_vector(loaded_model, request)

    baseline = generate_text(
        loaded_model,
        system_prompt=request.system_prompt,
        user_prompt=request.user_prompt,
        max_new_tokens=request.max_new_tokens,
        do_sample=request.do_sample,
        temperature=request.temperature,
        top_p=request.top_p,
        top_k=request.top_k,
    )
    steered = generate_with_steering(
        loaded_model,
        system_prompt=request.system_prompt,
        user_prompt=request.user_prompt,
        vector=artifact.vector,
        layer_index=request.layer,
        coefficient=request.coefficient,
        apply_to=request.apply_to,
        hook_stage=request.hook_stage,
        max_new_tokens=request.max_new_tokens,
        do_sample=request.do_sample,
        temperature=request.temperature,
        top_p=request.top_p,
        top_k=request.top_k,
    )

    experiment_id = f"exp_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{uuid4().hex[:8]}"
    vector_path = default_vector_path(request, experiment_id) if save_artifacts else None
    artifact_path = default_result_path(experiment_id) if save_artifacts else None
    if vector_path is not None:
        save_vector(artifact, vector_path)

    result = ExperimentResult(
        experiment_id=experiment_id,
        created_at_utc=datetime.now(timezone.utc).isoformat(),
        request={
            **asdict(request),
            "prompt_pairs": [asdict(pair) for pair in request.prompt_pairs],
        },
        model_status=entry.to_dict(),
        baseline=baseline,
        steered=steered,
        diagnostics=vector_diagnostics(artifact.vector).to_dict(),
        output_delta=output_delta_metrics(baseline, steered),
        vector_path=_repo_relative(vector_path),
        artifact_path=_repo_relative(artifact_path),
        reproduce_command=build_cli_command(request),
    )
    if artifact_path is not None:
        artifact_path.parent.mkdir(parents=True, exist_ok=True)
        artifact_path.write_text(json.dumps(result.to_dict(), indent=2, ensure_ascii=False), encoding="utf-8")
    return result


def request_from_mapping(data: dict[str, Any]) -> ExperimentRequest:
    prompt_pairs = tuple(
        PromptPairSpec(positive=str(pair["positive"]), negative=str(pair["negative"]))
        for pair in data.get("prompt_pairs", [])
    )
    apply_to = str(data.get("apply_to", "last_token"))
    hook_stage = str(data.get("hook_stage", "post"))
    if apply_to not in SUPPORTED_APPLY_TO:
        raise ValueError(f"Unsupported apply_to value: {apply_to!r}. Expected one of {sorted(SUPPORTED_APPLY_TO)}.")
    if hook_stage not in SUPPORTED_HOOK_STAGES:
        raise ValueError(
            f"Unsupported hook_stage value: {hook_stage!r}. Expected one of {sorted(SUPPORTED_HOOK_STAGES)}."
        )

    return ExperimentRequest(
        model_id=str(data["model_id"]),
        system_prompt=str(data.get("system_prompt", "")),
        user_prompt=str(data["user_prompt"]),
        prompt_pairs=prompt_pairs,
        layer=int(data["layer"]),
        coefficient=float(data["coefficient"]),
        apply_to=apply_to,
        hook_stage=hook_stage,
        normalize=bool(data.get("normalize", True)),
        max_new_tokens=int(data.get("max_new_tokens", 96)),
        do_sample=bool(data.get("do_sample", False)),
        temperature=float(data.get("temperature", 1.0)),
        top_p=float(data.get("top_p", 0.95)),
        top_k=int(data.get("top_k", 64)),
    )


def sweep_plan(base_request: ExperimentRequest, *, layers: list[int], coefficients: list[float]) -> list[ExperimentRequest]:
    return [
        ExperimentRequest(
            **{
                **asdict(base_request),
                "prompt_pairs": base_request.prompt_pairs,
                "layer": layer,
                "coefficient": coefficient,
            }
        )
        for layer in layers
        for coefficient in coefficients
    ]
