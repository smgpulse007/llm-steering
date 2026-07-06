from llm_steering.cli import main
import json
import pytest


def test_cli_help_lists_product_commands(capsys) -> None:
    with pytest.raises(SystemExit) as exc:
        main(["--help"])
    assert exc.value.code == 0
    output = capsys.readouterr().out
    assert "verify" in output
    assert "demo" in output
    assert "showcase" in output
    assert "sweep" in output


def test_cli_verify_no_model(capsys) -> None:
    assert main(["verify", "--no-model"]) == 0
    output = capsys.readouterr().out
    assert '"mode": "no-model"' in output
    assert '"status": "ok"' in output


def test_cli_toy_demo_json(capsys) -> None:
    assert main(["demo", "--toy", "--json"]) == 0
    output = capsys.readouterr().out
    assert '"mode": "synthetic_no_model"' in output
    assert '"steering_vector"' in output
    assert "Activation-steered toy model" in output


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
