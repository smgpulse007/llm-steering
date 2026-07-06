from llm_steering.artifacts import (
    EXPERIMENT_KIND,
    EXPERIMENT_SCHEMA_VERSION,
    validate_artifact_payload,
    validate_experiment_result,
)


def valid_experiment_artifact() -> dict[str, object]:
    return {
        "schema_version": EXPERIMENT_SCHEMA_VERSION,
        "artifact_kind": EXPERIMENT_KIND,
        "experiment_id": "exp_test",
        "created_at_utc": "2026-07-06T00:00:00+00:00",
        "request": {"model_id": "google/gemma-4-E2B-it"},
        "model_status": {"support_status": "supported"},
        "baseline": "baseline",
        "prompt_only": "prompt-only",
        "steered": "steered",
        "prompt_control": {
            "strategy": "positive_negative_prompt_pair_instructions",
            "system_prompt": "Prompt-only steering control.",
        },
        "diagnostics": {"vector_norm": 1.0},
        "output_delta": {"changed": True},
        "control_delta": {"changed": True},
        "steering_delta": {"changed": True},
        "vector_path": None,
        "artifact_path": "results/exp_test.json",
        "reproduce_command": "python scripts/run_actadd.py --config demo.yaml",
    }


def test_validate_experiment_result_accepts_versioned_artifact() -> None:
    assert validate_experiment_result(valid_experiment_artifact()) == []


def test_validate_experiment_result_rejects_missing_schema_version() -> None:
    payload = valid_experiment_artifact()
    del payload["schema_version"]

    errors = validate_experiment_result(payload)

    assert any("schema_version" in error for error in errors)


def test_validate_artifact_payload_rejects_unknown_kind() -> None:
    payload = valid_experiment_artifact()
    payload["artifact_kind"] = "unknown"

    result = validate_artifact_payload(payload)

    assert result["ok"] is False
    assert result["errors"]
