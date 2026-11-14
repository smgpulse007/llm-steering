from dataclasses import asdict, replace
from concurrent.futures import ThreadPoolExecutor
import json
from threading import Event
from types import SimpleNamespace

import pytest
import torch

from llm_steering import experiments
from llm_steering.cli import main
from llm_steering.experiments import ExperimentRequest, PromptPairSpec, request_from_mapping
from llm_steering.sampling import paired_torch_seed
from llm_steering.steering import SteeringVectorArtifact


@pytest.fixture
def sample_request():
    return ExperimentRequest(
        model_id="google/gemma-4-E2B-it",
        system_prompt="Use only this synthetic example.",
        user_prompt="Explain a toy workflow.",
        prompt_pairs=(PromptPairSpec(positive="Be precise.", negative="Be vague."),),
        layer=18,
        coefficient=0.0,
        apply_to="all_tokens",
        hook_stage="pre",
        normalize=False,
        max_new_tokens=23,
        do_sample=True,
        temperature=0.7,
        top_p=0.8,
        top_k=12,
        seed=41,
    )


@pytest.fixture
def fake_runtime(monkeypatch, sample_request):
    loaded = SimpleNamespace(model_id=sample_request.model_id, source="synthetic-test")
    monkeypatch.setattr(
        experiments, "_build_vector",
        lambda *_: SteeringVectorArtifact(vector=torch.tensor([1.0, 0.0]), metadata={}),
    )
    # A generator that samples makes uncontrolled RNG advancement observable.
    def draw(*_args, **_kwargs):
        return str(torch.randint(0, 2**30, (8,)).tolist())
    monkeypatch.setattr(experiments, "generate_text", draw)
    monkeypatch.setattr(experiments, "generate_with_steering", draw)
    return loaded


def test_sampled_controls_share_seed_and_restore_rng(sample_request, fake_runtime):
    before = torch.random.get_rng_state().clone()
    result = experiments.run_experiment(sample_request, loaded=fake_runtime, settings=object(), save_artifacts=False)
    assert result.baseline == result.prompt_only == result.steered
    assert torch.equal(before, torch.random.get_rng_state())
    assert result.request["seed"] == 41
    assert result.sampling_control["paired"] is True
    assert result.output_delta["changed"] is False


def test_sampled_results_ignore_intervening_draws_and_change_with_seed(sample_request, fake_runtime):
    first = experiments.run_experiment(sample_request, loaded=fake_runtime, settings=object(), save_artifacts=False)
    torch.rand(200)
    second = experiments.run_experiment(sample_request, loaded=fake_runtime, settings=object(), save_artifacts=False)
    different = experiments.run_experiment(replace(sample_request, seed=42), loaded=fake_runtime, settings=object(), save_artifacts=False)
    assert first.baseline == second.baseline
    assert first.baseline != different.baseline


def test_sampling_exception_restores_caller_state():
    before = torch.random.get_rng_state().clone()
    with pytest.raises(RuntimeError, match="synthetic failure"):
        with paired_torch_seed(7):
            torch.rand(20)
            raise RuntimeError("synthetic failure")
    assert torch.equal(before, torch.random.get_rng_state())


def test_disabled_sampling_control_does_not_reset_rng():
    before = torch.random.get_rng_state().clone()
    expected = torch.rand(20, generator=torch.Generator().set_state(before))
    with paired_torch_seed(7, enabled=False):
        actual = torch.rand(20)
    assert torch.equal(actual, expected)
    assert torch.equal(before, torch.random.get_rng_state())


def test_loading_and_vector_extraction_preserve_rng(sample_request, fake_runtime, monkeypatch):
    before = torch.random.get_rng_state().clone()
    def load(*_args, **_kwargs):
        torch.rand(10)
        return fake_runtime
    def build(*_args):
        return SteeringVectorArtifact(vector=torch.rand(2), metadata={})
    monkeypatch.setattr(experiments, "load_hf_model", load)
    monkeypatch.setattr(experiments, "_build_vector", build)
    experiments.run_experiment(sample_request, settings=object(), save_artifacts=False)
    assert torch.equal(before, torch.random.get_rng_state())
    def fail(*_args):
        torch.rand(10)
        raise RuntimeError("vector failed")
    monkeypatch.setattr(experiments, "_build_vector", fail)
    with pytest.raises(RuntimeError, match="vector failed"):
        experiments.run_experiment(sample_request, settings=object(), save_artifacts=False)
    assert torch.equal(before, torch.random.get_rng_state())


def test_greedy_and_sampled_contexts_cannot_overlap():
    entered, release, second_started, second_entered = (Event() for _ in range(4))
    before = torch.random.get_rng_state().clone()
    def sampled():
        with paired_torch_seed(17):
            first = torch.rand(4)
            entered.set()
            assert release.wait(5)
            return torch.cat([first, torch.rand(4)])
    def greedy():
        assert entered.wait(5)
        second_started.set()
        with paired_torch_seed(17, enabled=False):
            second_entered.set()
            torch.rand(20)
    with ThreadPoolExecutor(max_workers=2) as pool:
        one, two = pool.submit(sampled), pool.submit(greedy)
        try:
            assert second_started.wait(5)
            assert not second_entered.wait(0.1)
        finally:
            release.set()
        actual = one.result(timeout=5)
        two.result(timeout=5)
    assert torch.equal(actual, torch.rand(8, generator=torch.Generator().manual_seed(17)))
    assert torch.equal(before, torch.random.get_rng_state())


@pytest.mark.skipif(not torch.cuda.is_available(), reason="CUDA is not available in the CPU test environment")
def test_cuda_rng_states_are_paired_and_restored():
    before = [state.clone() for state in torch.cuda.get_rng_state_all()]
    with paired_torch_seed(7):
        first = [torch.rand(8, device=f"cuda:{i}") for i in range(torch.cuda.device_count())]
    with paired_torch_seed(7):
        second = [torch.rand(8, device=f"cuda:{i}") for i in range(torch.cuda.device_count())]
    assert all(torch.equal(left, right) for left, right in zip(first, second))
    assert all(torch.equal(left, right) for left, right in zip(before, torch.cuda.get_rng_state_all()))
    with pytest.raises(RuntimeError):
        with paired_torch_seed(9):
            torch.rand(8, device="cuda:0")
            raise RuntimeError("synthetic CUDA failure")
    assert all(torch.equal(left, right) for left, right in zip(before, torch.cuda.get_rng_state_all()))


@pytest.mark.parametrize("seed", [True, False, None, "41", 1.5, -1, 2**32])
def test_invalid_seeds_are_rejected_before_model_loading(sample_request, seed):
    payload = asdict(sample_request)
    payload["seed"] = seed
    with pytest.raises(ValueError, match="seed must be an integer"):
        request_from_mapping(payload)


def test_legacy_request_has_explicit_default_seed(sample_request):
    payload = asdict(sample_request)
    del payload["seed"]
    assert request_from_mapping(payload).seed == 0


@pytest.mark.parametrize("name", ["do_sample", "normalize"])
@pytest.mark.parametrize("value", ["false", 0, None])
def test_boolean_fields_reject_silent_coercion(sample_request, name, value):
    payload = asdict(sample_request)
    payload[name] = value
    with pytest.raises(ValueError, match="JSON boolean"):
        request_from_mapping(payload)


@pytest.mark.parametrize("name", ["do_sample", "normalize"])
@pytest.mark.parametrize("value", ["false", 0, None])
def test_direct_requests_reject_invalid_booleans(sample_request, name, value):
    with pytest.raises(ValueError, match="JSON boolean"):
        replace(sample_request, **{name: value})


@pytest.mark.parametrize("fail", [False, True])
def test_standalone_vector_build_preserves_rng(sample_request, fake_runtime, monkeypatch, fail):
    before = torch.random.get_rng_state().clone()
    def load(*_args, **_kwargs):
        torch.rand(12)
        return fake_runtime
    def build(*_args):
        vector = torch.rand(4)
        if fail:
            raise RuntimeError("synthetic vector failure")
        return SteeringVectorArtifact(vector=vector, metadata={})
    monkeypatch.setattr(experiments, "load_hf_model", load)
    monkeypatch.setattr(experiments, "_build_vector", build)
    if fail:
        with pytest.raises(RuntimeError, match="synthetic vector failure"):
            experiments.build_vector_artifact(sample_request, settings=object(), save_artifact=False)
    else:
        result = experiments.build_vector_artifact(sample_request, settings=object(), save_artifact=False)
        assert result["vector_path"] is None
    assert torch.equal(before, torch.random.get_rng_state())


def test_saved_artifact_replays_complete_request(tmp_path, monkeypatch, sample_request, fake_runtime, capsys):
    path = tmp_path / "experiment.json"
    monkeypatch.setattr(experiments, "default_result_path", lambda _: path)
    monkeypatch.setattr(experiments, "default_vector_path", lambda *_: tmp_path / "vector.pt")
    monkeypatch.setattr(experiments, "save_vector", lambda *_: None)
    original = experiments.run_experiment(sample_request, loaded=fake_runtime, settings=object())
    assert f'--request "{path}"' in original.reproduce_command
    captured = []

    def replay(next_request, *, save_artifacts):
        captured.append((next_request, save_artifacts))
        return original

    monkeypatch.setattr(experiments, "run_experiment", replay)
    assert main(["run", "--request", str(path), "--no-save"]) == 0
    assert captured == [(sample_request, False)]
    assert json.loads(capsys.readouterr().out)["request"]["seed"] == 41


def test_run_plan_never_loads_a_model(tmp_path, monkeypatch, sample_request, capsys):
    path = tmp_path / "request.json"
    path.write_text(json.dumps(asdict(sample_request)), encoding="utf-8")
    monkeypatch.setattr(experiments, "load_hf_model", lambda *_args, **_kwargs: pytest.fail("loaded model during plan"))
    assert main(["run", "--request", str(path), "--plan-only"]) == 0
    payload = json.loads(capsys.readouterr().out)
    assert payload["status"] == "planned"
    assert payload["request"]["seed"] == 41


@pytest.mark.parametrize("payload", [[], {"artifact_kind": "experiment_result", "request": None}])
def test_run_rejects_invalid_request_shape(tmp_path, payload, capsys):
    path = tmp_path / "invalid.json"
    path.write_text(json.dumps(payload), encoding="utf-8")
    assert main(["run", "--request", str(path), "--plan-only"]) == 2
    assert "Invalid experiment request" in capsys.readouterr().err


def test_sweep_plan_retains_seed(sample_request):
    plan = experiments.sweep_plan(sample_request, layers=[12, 18], coefficients=[0.0, 1.0])
    assert [item.seed for item in plan] == [41] * 4


@pytest.mark.parametrize("contents", [None, "{invalid json"])
def test_sweep_invalid_request_has_actionable_error(tmp_path, contents, capsys):
    path = tmp_path / "request.json"
    if contents is not None:
        path.write_text(contents, encoding="utf-8")
    assert main(["sweep", "--request", str(path), "--layers", "12",
                 "--coefficients", "0.0", "--plan-only"]) == 2
    assert "Invalid experiment request" in capsys.readouterr().err


def test_saved_sweep_replays_all_request_fields(tmp_path, monkeypatch, sample_request, fake_runtime, capsys):
    path = tmp_path / "sweep.json"
    monkeypatch.setattr(experiments, "default_sweep_path", lambda _: path)
    monkeypatch.setattr(experiments, "default_result_path", lambda name: tmp_path / (name + ".json"))
    monkeypatch.setattr(experiments, "default_vector_path", lambda *_: tmp_path / "vector.pt")
    monkeypatch.setattr(experiments, "save_vector", lambda *_: None)
    original = experiments.run_sweep(sample_request, layers=[12], coefficients=[0.0, 1.0],
                                     settings=object(), loaded=fake_runtime)
    assert f'--request "{path}"' in original.reproduce_command
    captured = []
    def replay(next_request, **kwargs):
        captured.append((next_request, kwargs))
        return original
    monkeypatch.setattr(experiments, "run_sweep", replay)
    assert main(["sweep", "--request", str(path), "--layers", "12", "--coefficients", "0.0", "1.0", "--no-save"]) == 0
    assert captured == [(sample_request, {"layers": [12], "coefficients": [0.0, 1.0], "save_artifacts": False})]
    assert json.loads(capsys.readouterr().out)["base_request"]["seed"] == 41
