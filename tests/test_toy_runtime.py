import pytest

from llm_steering.toy_runtime import default_toy_run, mean_prompt_pair_vector, run_toy_steering, ToyPromptPair


def test_default_toy_run_is_no_model_and_directional() -> None:
    run = default_toy_run()

    assert run.baseline.startswith("Baseline toy model")
    assert run.steered.startswith("Activation-steered toy model")
    assert run.steering_vector["empathy"] > 0
    assert run.steered_features["empathy"] > run.baseline_features["empathy"]
    assert "deterministic toy simulation" in run.teaching_notes[0]


def test_mean_prompt_pair_vector_requires_pairs() -> None:
    with pytest.raises(ValueError, match="At least one"):
        mean_prompt_pair_vector([])


def test_toy_run_rejects_negative_coefficient() -> None:
    with pytest.raises(ValueError, match="non-negative"):
        run_toy_steering(
            prompt="Explain the change.",
            positive="Be clear and structured.",
            negative="Be vague.",
            coefficient=-1,
        )


def test_mean_prompt_pair_vector_normalizes() -> None:
    vector = mean_prompt_pair_vector(
        [
            ToyPromptPair(
                positive="clear concrete steps with reassurance",
                negative="vague defensive rambling",
            )
        ]
    )

    norm = sum(value * value for value in vector.values()) ** 0.5
    assert norm == pytest.approx(1.0)
