from types import SimpleNamespace

import torch

from llm_steering import experiments
from llm_steering.experiments import ExperimentRequest, ExperimentResult, PromptPairSpec, build_prompt_only_system_prompt
from llm_steering.steering import SteeringVectorArtifact


def test_prompt_only_system_prompt_records_direction_and_contrast() -> None:
    prompt = build_prompt_only_system_prompt(
        "You are concise.",
        (
            PromptPairSpec(positive="Be empathetic and concrete.", negative="Be curt and vague."),
            PromptPairSpec(positive="Offer next steps.", negative="Avoid responsibility."),
        ),
    )

    assert "You are concise." in prompt
    assert "Prompt-only steering control" in prompt
    assert "Be empathetic and concrete." in prompt
    assert "Offer next steps." in prompt
    assert "Be curt and vague." in prompt
    assert "hidden-state" in prompt


def test_run_experiment_includes_prompt_only_control(monkeypatch) -> None:
    request = ExperimentRequest(
        model_id="google/gemma-4-E2B-it",
        system_prompt="You are helpful.",
        user_prompt="Draft a support reply.",
        prompt_pairs=(PromptPairSpec(positive="Be warm.", negative="Be dismissive."),),
        layer=18,
        coefficient=1.5,
    )
    loaded = SimpleNamespace(model_id=request.model_id, source="test-model")

    monkeypatch.setattr(
        experiments,
        "_build_vector",
        lambda _loaded, _request: SteeringVectorArtifact(
            vector=torch.tensor([1.0, 0.0]),
            metadata={"method": "actadd_single_pair"},
        ),
    )

    def fake_generate_text(_loaded, *, system_prompt: str, **_kwargs) -> str:
        if "Prompt-only steering control" in system_prompt:
            return "prompt-only answer"
        return "baseline answer"

    monkeypatch.setattr(experiments, "generate_text", fake_generate_text)
    monkeypatch.setattr(experiments, "generate_with_steering", lambda *_args, **_kwargs: "steered answer")

    result = experiments.run_experiment(request, loaded=loaded, save_artifacts=False)
    payload = result.to_dict()

    assert payload["baseline"] == "baseline answer"
    assert payload["prompt_only"] == "prompt-only answer"
    assert payload["steered"] == "steered answer"
    assert payload["prompt_control"]["strategy"] == "positive_negative_prompt_pair_instructions"
    assert "Prompt-only steering control" in payload["prompt_control"]["system_prompt"]
    assert payload["control_delta"]["changed"] is True
    assert payload["steering_delta"]["changed"] is True
    assert payload["artifact_path"] is None


def test_run_sweep_executes_layer_coefficient_grid(monkeypatch) -> None:
    request = ExperimentRequest(
        model_id="google/gemma-4-E2B-it",
        system_prompt="You are helpful.",
        user_prompt="Draft a support reply.",
        prompt_pairs=(PromptPairSpec(positive="Be warm.", negative="Be dismissive."),),
        layer=18,
        coefficient=1.5,
    )
    loaded = SimpleNamespace(model_id=request.model_id, source="test-model")
    seen: list[tuple[int, float]] = []

    def fake_run_experiment(next_request: ExperimentRequest, **_kwargs) -> ExperimentResult:
        seen.append((next_request.layer, next_request.coefficient))
        experiment_id = f"exp_{next_request.layer}_{str(next_request.coefficient).replace('.', '_')}"
        return ExperimentResult(
            schema_version="llm-steering.experiment.v1",
            artifact_kind="experiment_result",
            experiment_id=experiment_id,
            created_at_utc="2026-07-06T00:00:00+00:00",
            request={"model_id": next_request.model_id},
            model_status={"support_status": "supported"},
            baseline="baseline",
            prompt_only="prompt-only",
            steered=f"steered {next_request.layer} {next_request.coefficient}",
            prompt_control={"strategy": "positive_negative_prompt_pair_instructions"},
            diagnostics={"vector_norm": 1.0, "separability_score": 0.5},
            output_delta={"changed": True},
            control_delta={"changed": True},
            steering_delta={"changed": True},
            vector_path=f"vectors/{experiment_id}.pt",
            artifact_path=f"results/{experiment_id}.json",
            reproduce_command="python scripts/run_actadd.py --config demo.yaml",
        )

    monkeypatch.setattr(experiments, "run_experiment", fake_run_experiment)

    result = experiments.run_sweep(
        request,
        layers=[12, 18],
        coefficients=[0.5, 1.0],
        loaded=loaded,
        save_artifacts=False,
    )
    payload = result.to_dict()

    assert seen == [(12, 0.5), (12, 1.0), (18, 0.5), (18, 1.0)]
    assert payload["artifact_kind"] == "sweep_result"
    assert payload["status"] == "completed"
    assert payload["run_count"] == 4
    assert payload["axes"] == {"layers": [12, 18], "coefficients": [0.5, 1.0]}
    assert payload["artifact_path"] is None
    assert payload["aggregate_diagnostics"]["completed_runs"] == 4
    assert payload["runs"][0]["experiment_id"] == "exp_12_0_5"
    assert "--model-id" not in payload["reproduce_command"]
