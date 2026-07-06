import json
import subprocess
import sys


def _run_import_probe(args: list[str]) -> dict[str, object]:
    code = f"""
import contextlib
import io
import json
import sys
from llm_steering.cli import main
with contextlib.redirect_stdout(io.StringIO()):
    exit_code = main({args!r})
print(json.dumps({{
    "exit_code": exit_code,
    "torch": "torch" in sys.modules,
    "transformers": "transformers" in sys.modules,
    "fastapi": "fastapi" in sys.modules,
    "huggingface_hub": "huggingface_hub" in sys.modules,
    "dotenv": "dotenv" in sys.modules,
    "yaml": "yaml" in sys.modules
}}))
"""
    completed = subprocess.run([sys.executable, "-c", code], check=True, capture_output=True, text=True)
    return json.loads(completed.stdout)


def test_no_model_cli_path_does_not_import_optional_runtime_dependencies() -> None:
    assert _run_import_probe(["demo", "--toy", "--json"]) == {
        "exit_code": 0,
        "torch": False,
        "transformers": False,
        "fastapi": False,
        "huggingface_hub": False,
        "dotenv": False,
        "yaml": False,
    }


def test_registry_only_cli_path_does_not_import_optional_runtime_dependencies() -> None:
    assert _run_import_probe(["validate-model", "google/diffusiongemma-26B-A4B-it"]) == {
        "exit_code": 1,
        "torch": False,
        "transformers": False,
        "fastapi": False,
        "huggingface_hub": False,
        "dotenv": False,
        "yaml": False,
    }
