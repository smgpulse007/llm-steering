from __future__ import annotations

from typing import Any

import json

try:
    from fastapi import FastAPI, HTTPException
except ImportError:  # pragma: no cover - exercised only without optional API deps
    FastAPI = None  # type: ignore[assignment]
    HTTPException = None  # type: ignore[assignment]

from .config import RuntimeSettings
from .docs_index import get_local_doc, list_local_docs
from .experiments import (
    SteeringReadinessError,
    build_vector_artifact,
    default_result_path,
    request_from_mapping,
    run_experiment,
    sweep_plan,
)
from .introspection import registry_only_report
from .model_registry import list_model_dicts


def create_app() -> Any:
    if FastAPI is None:
        raise RuntimeError("FastAPI is not installed. Install the project with API dependencies before serving.")

    app = FastAPI(title="llm-steering workbench API", version="0.1.0")

    @app.get("/api/models")
    def api_models() -> dict[str, object]:
        return {"models": list_model_dicts()}

    @app.post("/api/models/introspect")
    def api_introspect(payload: dict[str, Any]) -> dict[str, object]:
        try:
            model_id = str(payload["model_id"])
            return registry_only_report(model_id).to_dict()
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    @app.get("/api/runtime/status")
    def api_runtime_status() -> dict[str, object]:
        settings = RuntimeSettings.from_env()
        return {
            "hf_model_id": settings.hf_model_id,
            "hf_model_local_dir": str(settings.hf_model_local_dir),
            "ollama_model": settings.ollama_model,
            "ollama_base_url": settings.ollama_base_url,
            "default_layer": settings.default_layer,
            "default_coefficient": settings.default_coefficient,
            "max_new_tokens": settings.max_new_tokens,
        }

    @app.get("/api/docs")
    def api_docs() -> dict[str, object]:
        return {"docs": list_local_docs()}

    @app.get("/api/docs/{doc_id}")
    def api_doc(doc_id: str) -> dict[str, object]:
        try:
            doc, content = get_local_doc(doc_id)
            return {"doc": doc.to_dict(), "content": content}
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except (FileNotFoundError, ValueError) as exc:
            raise HTTPException(status_code=500, detail=f"Local documentation is misconfigured: {exc}") from exc

    @app.post("/api/vectors/build")
    def api_vectors_build(payload: dict[str, Any]) -> dict[str, object]:
        try:
            request = request_from_mapping(payload)
            return build_vector_artifact(request)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except SteeringReadinessError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.post("/api/experiments/run")
    def api_experiment_run(payload: dict[str, Any]) -> dict[str, object]:
        try:
            request = request_from_mapping(payload)
            return run_experiment(request).to_dict()
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except SteeringReadinessError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.post("/api/experiments/sweep")
    def api_experiment_sweep(payload: dict[str, Any]) -> dict[str, object]:
        try:
            base = request_from_mapping(payload)
            layers = [int(layer) for layer in payload.get("layers", [base.layer])]
            coefficients = [float(coefficient) for coefficient in payload.get("coefficients", [base.coefficient])]
            planned = sweep_plan(base, layers=layers, coefficients=coefficients)
        except KeyError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return {
            "status": "planned",
            "count": len(planned),
            "runs": [
                {
                    "model_id": request.model_id,
                    "layer": request.layer,
                    "coefficient": request.coefficient,
                    "hook_stage": request.hook_stage,
                    "apply_to": request.apply_to,
                }
                for request in planned
            ],
        }

    @app.get("/api/experiments/{experiment_id}")
    def api_experiment_get(experiment_id: str) -> dict[str, object]:
        result_path = default_result_path(experiment_id)
        if not result_path.exists():
            raise HTTPException(status_code=404, detail=f"No result artifact found for {experiment_id}.")
        return json.loads(result_path.read_text(encoding="utf-8"))

    return app


app = create_app() if FastAPI is not None else None
