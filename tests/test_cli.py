import json
import sys
from types import SimpleNamespace

import pytest

from llm_steering.cli import main
from llm_steering import cli


def test_cli_help_lists_product_commands(capsys) -> None:
    with pytest.raises(SystemExit) as exc:
        main(["--help"])
    assert exc.value.code == 0
    output = capsys.readouterr().out
    assert "verify" in output
    assert "demo" in output
    assert "showcase" in output
    assert "sweep" in output
    assert "hook-smoke" in output


def test_cli_verify_no_model(capsys) -> None:
    assert main(["verify", "--no-model"]) == 0
    output = capsys.readouterr().out
    assert '"mode": "no-model"' in output
    assert '"status": "ok"' in output


@pytest.mark.parametrize("contents,expected", [('{}', 0), ('{invalid', 1), (None, 1)])
def test_cli_verify_really_parses_package_json(tmp_path, monkeypatch, capsys, contents, expected):
    manifest = tmp_path / "apps/web/package.json"
    manifest.parent.mkdir(parents=True)
    if contents is not None:
        manifest.write_text(contents, encoding="utf-8")
    workflow = tmp_path / ".github/workflows/ci.yml"
    workflow.parent.mkdir(parents=True)
    workflow.write_text("name: test\n", encoding="utf-8")
    monkeypatch.setattr(cli, "ROOT", tmp_path)
    monkeypatch.setattr(cli, "validate_showcase_files", lambda: {"files": []})
    assert main(["verify", "--no-model"]) == expected
    payload = json.loads(capsys.readouterr().out)
    package = next(check for check in payload["checks"] if check["path"] == "apps/web/package.json")
    assert package["valid_json"] is (expected == 0)


def test_cli_toy_demo_json(capsys) -> None:
    assert main(["demo", "--toy", "--json"]) == 0
    output = capsys.readouterr().out
    assert '"mode": "synthetic_no_model"' in output
    assert '"steering_vector"' in output
    assert "Activation-steered toy model" in output


def test_cli_api_serves_packaged_fastapi_app(monkeypatch) -> None:
    seen: dict[str, object] = {}

    def fake_run(app: str, *, host: str, port: int, reload: bool) -> None:
        seen.update({"app": app, "host": host, "port": port, "reload": reload})

    monkeypatch.setitem(sys.modules, "uvicorn", SimpleNamespace(run=fake_run))

    assert main(["api", "--host", "0.0.0.0", "--port", "8123", "--reload"]) == 0
    assert seen == {
        "app": "llm_steering.api:app",
        "host": "0.0.0.0",
        "port": 8123,
        "reload": True,
    }


def test_cli_hook_smoke_defaults_to_no_load(capsys) -> None:
    assert main(["hook-smoke", "google/gemma-4-E2B-it"]) == 0
    output = capsys.readouterr().out
    assert '"status": "not_run"' in output
    assert '"mode": "registry_only"' in output
    assert "--load-model" in output


def test_cli_sweep_plan_only(tmp_path, capsys) -> None:
    request_path = tmp_path / "request.json"
    request_path.write_text(
        json.dumps(
            {
                "model_id": "google/gemma-4-E2B-it",
                "system_prompt": "",
                "user_prompt": "Explain steering.",
                "prompt_pairs": [{"positive": "Helpful", "negative": "Unhelpful"}],
                "layer": 18,
                "coefficient": 1.0,
            }
        ),
        encoding="utf-8",
    )

    assert (
        main(
            [
                "sweep",
                "--request",
                str(request_path),
                "--layers",
                "12",
                "18",
                "--coefficients",
                "0.5",
                "1.0",
                "--plan-only",
            ]
        )
        == 0
    )
    output = capsys.readouterr().out
    assert '"status": "planned"' in output
    assert '"count": 4' in output


def test_cli_validate_showcase_json(capsys) -> None:
    assert main(["showcase", "validate"]) == 0
    output = capsys.readouterr().out
    assert "pre_post_showcase.json" in output


def test_cli_validate_versioned_artifacts(capsys) -> None:
    assert main(["artifacts", "validate"]) == 0
    output = capsys.readouterr().out
    assert '"status": "ok"' in output
    assert "use_case_showcase" in output
