import json
import subprocess
import sys


def test_no_model_cli_path_does_not_import_torch_or_transformers() -> None:
    code = """
import contextlib
import io
import json
import sys
from llm_steering.cli import main
with contextlib.redirect_stdout(io.StringIO()):
    exit_code = main(["demo", "--toy", "--json"])
print(json.dumps({
    "exit_code": exit_code,
    "torch": "torch" in sys.modules,
    "transformers": "transformers" in sys.modules,
    "fastapi": "fastapi" in sys.modules
}))
"""
    completed = subprocess.run([sys.executable, "-c", code], check=True, capture_output=True, text=True)
    payload = json.loads(completed.stdout)

    assert payload == {
        "exit_code": 0,
        "torch": False,
        "transformers": False,
        "fastapi": False,
    }
