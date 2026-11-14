from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any
from uuid import uuid4

import torch

from .artifacts import (
    EXPERIMENT_KIND,
    EXPERIMENT_SCHEMA_VERSION,
    SWEEP_KIND,
    SWEEP_SCHEMA_VERSION,
    VECTOR_KIND,
    VECTOR_SCHEMA_VERSION,
)
from .config import RuntimeSettings, project_root
from .hf_runtime import LoadedHFModel, generate_text, load_hf_model
from .metrics import output_delta_metrics, vector_diagnostics
from .model_registry import get_model_entry
from .sampling import paired_torch_seed, validate_seed
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
    seed: int = 0

    def __post_init__(self) -> None:
        validate_seed(self.seed)


@dataclass(frozen=True, slots=True)
class ExperimentResult:
    schema_version: str
    artifact_kind: str
    experiment_id: str
    created_at_utc: str
    request: dict[str, object]
    model_status: dict[str, object]
    baseline: str
    prompt_only: str
    steered: str
    prompt_control: dict[str, object]
    diagnostics: dict[str, object]
    output_delta: dict[str, object]
    control_delta: dict[str, object]
    steering_delta: dict[str, object]
    vector_path: str | None
    artifact_path: str | None
    reproduce_command: str
    sampling_control: dict[str, object] | None = None

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


@dataclass(frozen=True, slots=True)
class SweepResult:
    schema_version: str
    artifact_kind: str
    sweep_id: str
    created_at_utc: str
    base_request: dict[str, object]
    model_status: dict[str, object]
    axes: dict[str, object]
    run_count: int
    status: str
    runs: list[dict[str, object]]
    aggregate_diagnostics: dict[str, object]
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


def build_cli_command(request: ExperimentRequest, *, artifact_path: Path | None = None) -> str:
    # The result embeds the complete request, including prompts and decoding
    # settings. A command reconstructed from a subset silently loses controls.
    path = _repo_relative(artifact_path) or "<experiment-request.json>"
    return f'llm-steering run --request "{path}"'


def build_sweep_cli_command(
    base_request: ExperimentRequest, *, layers: list[int], coefficients: list[float],
    artifact_path: Path | None = None,
) -> str:
    layer_args = " ".join(str(layer) for layer in layers)
    coefficient_args = " ".join(str(coefficient) for coefficient in coefficients)
    request_path = _repo_relative(artifact_path) or "<experiment-request.json>"
    return (
        "llm-steering sweep "
        f'--request "{request_path}" '
        f"--layers {layer_args} "
        f"--coefficients {coefficient_args}"
    )


def default_vector_path(request: ExperimentRequest, experiment_id: str) -> Path:
    model_stub = request.model_id.replace("/", "_").replace(":", "_")
    return project_root() / "vectors" / f"{experiment_id}_{model_stub}_layer{request.layer}.pt"


def default_result_path(experiment_id: str) -> Path:
    return project_root() / "results" / f"{experiment_id}.json"


def default_sweep_path(sweep_id: str) -> Path:
    return project_root() / "results" / f"{sweep_id}.json"


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


def build_prompt_only_system_prompt(system_prompt: str, prompt_pairs: tuple[PromptPairSpec, ...]) -> str:
    positive_lines = [pair.positive.strip() for pair in prompt_pairs if pair.positive.strip()]
    negative_lines = [pair.negative.strip() for pair in prompt_pairs if pair.negative.strip()]
    parts = []
    if system_prompt.strip():
        parts.append(system_prompt.strip())
    parts.append(
        "Prompt-only steering control: follow the behavioral directions below using ordinary "
        "instructions only. Do not assume any hidden-state or activation intervention."
    )
    if positive_lines:
        parts.append("Move the answer toward:\n" + "\n".join(f"- {line}" for line in positive_lines))
    if negative_lines:
        parts.append("Avoid moving the answer toward:\n" + "\n".join(f"- {line}" for line in negative_lines))
    return "\n\n".join(parts)


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
        "schema_version": VECTOR_SCHEMA_VERSION,
        "artifact_kind": VECTOR_KIND,
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
    # Include loading/vector extraction in the same preservation/serialization
    # scope, since custom runtimes can consume RNG even before generation.
    with paired_torch_seed(request.seed, enabled=request.do_sample):
        return _run_experiment(request, settings=settings, loaded=loaded, save_artifacts=save_artifacts)


def _run_experiment(
    request: ExperimentRequest,
    *,
    settings: RuntimeSettings | None,
    loaded: LoadedHFModel | None,
    save_artifacts: bool,
) -> ExperimentResult:
    entry = get_model_entry(request.model_id)
    require_steering_ready(request.model_id)

    runtime_settings = settings or RuntimeSettings.from_env()
    loaded_model = loaded or load_hf_model(runtime_settings, model_id=request.model_id)
    artifact = _build_vector(loaded_model, request)

    with paired_torch_seed(request.seed, enabled=request.do_sample):
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
    prompt_only_system_prompt = build_prompt_only_system_prompt(request.system_prompt, request.prompt_pairs)
    with paired_torch_seed(request.seed, enabled=request.do_sample):
        prompt_only = generate_text(
            loaded_model,
            system_prompt=prompt_only_system_prompt,
            user_prompt=request.user_prompt,
            max_new_tokens=request.max_new_tokens,
            do_sample=request.do_sample,
            temperature=request.temperature,
            top_p=request.top_p,
            top_k=request.top_k,
        )
    with paired_torch_seed(request.seed, enabled=request.do_sample):
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
        schema_version=EXPERIMENT_SCHEMA_VERSION,
        artifact_kind=EXPERIMENT_KIND,
        experiment_id=experiment_id,
        created_at_utc=datetime.now(timezone.utc).isoformat(),
        request={
            **asdict(request),
            "prompt_pairs": [asdict(pair) for pair in request.prompt_pairs],
        },
        model_status=entry.to_dict(),
        baseline=baseline,
        prompt_only=prompt_only,
        steered=steered,
        prompt_control={
            "strategy": "positive_negative_prompt_pair_instructions",
            "system_prompt": prompt_only_system_prompt,
        },
        diagnostics=vector_diagnostics(artifact.vector).to_dict(),
        output_delta=output_delta_metrics(baseline, steered),
        control_delta=output_delta_metrics(baseline, prompt_only),
        steering_delta=output_delta_metrics(prompt_only, steered),
        vector_path=_repo_relative(vector_path),
        artifact_path=_repo_relative(artifact_path),
        reproduce_command=build_cli_command(request, artifact_path=artifact_path),
        sampling_control={
            "seed": request.seed,
            "paired": request.do_sample,
            "rng_backends": ["torch_cpu"] + (["torch_cuda"] if torch.cuda.is_available() else []),
            "deterministic_algorithms": torch.are_deterministic_algorithms_enabled(),
            "scope": "preserve entire experiment; reset each generation only when sampling",
            "request_artifact_saved": artifact_path is not None,
        },
    )
    if artifact_path is not None:
        artifact_path.parent.mkdir(parents=True, exist_ok=True)
        artifact_path.write_text(json.dumps(result.to_dict(), indent=2, ensure_ascii=False), encoding="utf-8")
    return result


def _serialize_request(request: ExperimentRequest) -> dict[str, object]:
    return {
        **asdict(request),
        "prompt_pairs": [asdict(pair) for pair in request.prompt_pairs],
    }


def _sweep_run_summary(index: int, request: ExperimentRequest, result: ExperimentResult) -> dict[str, object]:
    return {
        "index": index,
        "experiment_id": result.experiment_id,
        "layer": request.layer,
        "coefficient": request.coefficient,
        "hook_stage": request.hook_stage,
        "apply_to": request.apply_to,
        "seed": request.seed,
        "sampling_control": result.sampling_control,
        "artifact_path": result.artifact_path,
        "vector_path": result.vector_path,
        "diagnostics": result.diagnostics,
        "output_delta": result.output_delta,
        "control_delta": result.control_delta,
        "steering_delta": result.steering_delta,
        "reproduce_command": result.reproduce_command,
    }


def _aggregate_sweep_runs(runs: list[dict[str, object]]) -> dict[str, object]:
    return {
        "changed_runs": sum(1 for run in runs if dict(run.get("output_delta") or {}).get("changed")),
        "prompt_control_changed_runs": sum(1 for run in runs if dict(run.get("control_delta") or {}).get("changed")),
        "activation_changed_runs": sum(1 for run in runs if dict(run.get("steering_delta") or {}).get("changed")),
        "completed_runs": len(runs),
    }


def run_sweep(
    base_request: ExperimentRequest,
    *,
    layers: list[int],
    coefficients: list[float],
    settings: RuntimeSettings | None = None,
    loaded: LoadedHFModel | None = None,
    save_artifacts: bool = True,
) -> SweepResult:
    with paired_torch_seed(base_request.seed, enabled=base_request.do_sample):
        return _run_sweep(base_request, layers=layers, coefficients=coefficients,
                          settings=settings, loaded=loaded, save_artifacts=save_artifacts)


def _run_sweep(
    base_request: ExperimentRequest,
    *,
    layers: list[int],
    coefficients: list[float],
    settings: RuntimeSettings | None,
    loaded: LoadedHFModel | None,
    save_artifacts: bool,
) -> SweepResult:
    if not layers:
        raise ValueError("At least one sweep layer is required.")
    if not coefficients:
        raise ValueError("At least one sweep coefficient is required.")

    entry = get_model_entry(base_request.model_id)
    require_steering_ready(base_request.model_id)
    planned = sweep_plan(base_request, layers=layers, coefficients=coefficients)
    runtime_settings = settings or RuntimeSettings.from_env()
    loaded_model = loaded or load_hf_model(runtime_settings, model_id=base_request.model_id)
    sweep_id = f"sweep_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{uuid4().hex[:8]}"

    runs = [
        _sweep_run_summary(
            index,
            request,
            run_experiment(request, settings=runtime_settings, loaded=loaded_model, save_artifacts=save_artifacts),
        )
        for index, request in enumerate(planned)
    ]
    artifact_path = default_sweep_path(sweep_id) if save_artifacts else None
    result = SweepResult(
        schema_version=SWEEP_SCHEMA_VERSION,
        artifact_kind=SWEEP_KIND,
        sweep_id=sweep_id,
        created_at_utc=datetime.now(timezone.utc).isoformat(),
        base_request=_serialize_request(base_request),
        model_status=entry.to_dict(),
        axes={"layers": layers, "coefficients": coefficients},
        run_count=len(runs),
        status="completed",
        runs=runs,
        aggregate_diagnostics=_aggregate_sweep_runs(runs),
        artifact_path=_repo_relative(artifact_path),
        reproduce_command=build_sweep_cli_command(
            base_request, layers=layers, coefficients=coefficients, artifact_path=artifact_path,
        ),
    )
    if artifact_path is not None:
        artifact_path.parent.mkdir(parents=True, exist_ok=True)
        artifact_path.write_text(json.dumps(result.to_dict(), indent=2, ensure_ascii=False), encoding="utf-8")
    return result


def request_from_mapping(data: dict[str, Any]) -> ExperimentRequest:
    for name in ("normalize", "do_sample"):
        if name in data and not isinstance(data[name], bool):
            raise ValueError(f"{name} must be a JSON boolean (true or false).")
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
        normalize=data.get("normalize", True),
        max_new_tokens=int(data.get("max_new_tokens", 96)),
        do_sample=data.get("do_sample", False),
        temperature=float(data.get("temperature", 1.0)),
        top_p=float(data.get("top_p", 0.95)),
        top_k=int(data.get("top_k", 64)),
        seed=data.get("seed", 0),
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
