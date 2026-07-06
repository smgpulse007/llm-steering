from llm_steering.cli import main
import pytest


def test_cli_help_lists_product_commands(capsys) -> None:
    with pytest.raises(SystemExit) as exc:
        main(["--help"])
    assert exc.value.code == 0
    output = capsys.readouterr().out
    assert "verify" in output
    assert "demo" in output
    assert "showcase" in output


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


def test_cli_validate_showcase_json(capsys) -> None:
    assert main(["showcase", "validate"]) == 0
    output = capsys.readouterr().out
    assert "pre_post_showcase.json" in output


def test_cli_validate_versioned_artifacts(capsys) -> None:
    assert main(["artifacts", "validate"]) == 0
    output = capsys.readouterr().out
    assert '"status": "ok"' in output
    assert "use_case_showcase" in output
