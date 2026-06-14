from fastapi.testclient import TestClient

from llm_steering.api import create_app
from llm_steering.docs_index import LOCAL_DOCS
from llm_steering.experiments import default_result_path


def test_api_models_lists_registry_entries() -> None:
    client = TestClient(create_app())
    response = client.get("/api/models")
    assert response.status_code == 200
    model_ids = {entry["model_id"] for entry in response.json()["models"]}
    assert "google/gemma-4-E2B-it" in model_ids
    assert "google/diffusiongemma-26B-A4B-it" in model_ids


def test_api_introspection_returns_generation_only_gate() -> None:
    client = TestClient(create_app())
    response = client.post(
        "/api/models/introspect",
        json={"model_id": "google/diffusiongemma-26B-A4B-it"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["registry_status"] == "generation_only"
    assert payload["hook_compatible"] is False
    assert payload["warnings"]


def test_api_sweep_returns_layer_coefficient_plan() -> None:
    client = TestClient(create_app())
    response = client.post(
        "/api/experiments/sweep",
        json={
            "model_id": "google/gemma-4-E2B-it",
            "system_prompt": "",
            "user_prompt": "Explain steering.",
            "prompt_pairs": [{"positive": "Helpful", "negative": "Unhelpful"}],
            "layer": 18,
            "coefficient": 1.0,
            "layers": [12, 18],
            "coefficients": [0.5, 1.0],
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "planned"
    assert payload["count"] == 4


def test_api_vector_build_gates_diffusiongemma() -> None:
    client = TestClient(create_app())
    response = client.post(
        "/api/vectors/build",
        json={
            "model_id": "google/diffusiongemma-26B-A4B-it",
            "system_prompt": "",
            "user_prompt": "Explain steering.",
            "prompt_pairs": [{"positive": "Helpful", "negative": "Unhelpful"}],
            "layer": 18,
            "coefficient": 1.0,
        },
    )
    assert response.status_code == 409


def test_api_experiment_run_gates_needs_validation_models() -> None:
    client = TestClient(create_app())
    for model_id in [
        "google/gemma-4-E4B-it",
        "Qwen/Qwen3.6-27B",
        "microsoft/Phi-4-mini-instruct",
        "mistralai/Ministral-3-3B-Instruct-2512",
    ]:
        response = client.post(
            "/api/experiments/run",
            json={
                "model_id": model_id,
                "system_prompt": "",
                "user_prompt": "Explain steering.",
                "prompt_pairs": [{"positive": "Helpful", "negative": "Unhelpful"}],
                "layer": 18,
                "coefficient": 1.0,
            },
        )
        assert response.status_code == 409


def test_api_docs_exposes_local_methodology() -> None:
    client = TestClient(create_app())
    index = client.get("/api/docs")
    assert index.status_code == 200
    assert any(doc["doc_id"] == "methodology" for doc in index.json()["docs"])

    doc = client.get("/api/docs/methodology")
    assert doc.status_code == 200
    assert "Steering-vector math" in doc.json()["content"]


def test_all_indexed_local_docs_can_be_fetched() -> None:
    client = TestClient(create_app())
    for local_doc in LOCAL_DOCS:
        response = client.get(f"/api/docs/{local_doc.doc_id}")
        assert response.status_code == 200
        assert response.json()["doc"]["path"] == local_doc.path
        assert response.json()["content"].strip()


def test_api_get_experiment_reads_result_artifact() -> None:
    client = TestClient(create_app())
    experiment_id = "test_api_artifact"
    path = default_result_path(experiment_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text('{"experiment_id": "test_api_artifact", "ok": true}', encoding="utf-8")
    try:
        response = client.get(f"/api/experiments/{experiment_id}")
        assert response.status_code == 200
        assert response.json()["ok"] is True
    finally:
        path.unlink(missing_ok=True)
