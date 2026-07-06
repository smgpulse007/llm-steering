from __future__ import annotations

import argparse
import json
from pathlib import Path
import shutil
import subprocess
import sys
from typing import Any

from .showcase import validate_showcase_files
from .toy_runtime import default_toy_run, run_toy_steering


ROOT = Path(__file__).resolve().parents[2]
def _print_json(payload: dict[str, Any]) -> None:
    print(json.dumps(payload, indent=2, ensure_ascii=False))


def command_verify(args: argparse.Namespace) -> int:
    checks: list[dict[str, object]] = []
    checks.extend(validate_showcase_files()["files"])  # type: ignore[arg-type]
    checks.append(
        {
            "path": "apps/web/package.json",
            "exists": (ROOT / "apps" / "web" / "package.json").exists(),
            "valid_json": True,
        }
    )
    checks.append(
        {
            "path": ".github/workflows/ci.yml",
            "exists": (ROOT / ".github" / "workflows" / "ci.yml").exists(),
            "valid_json": None,
        }
    )

    payload: dict[str, Any] = {
        "status": "ok",
        "mode": "no-model" if args.no_model else "local-runtime",
        "python": sys.version.split()[0],
        "node_on_path": shutil.which("node") is not None,
        "npm_on_path": shutil.which("npm") is not None or shutil.which("npm.cmd") is not None,
        "checks": checks,
    }

    if not args.no_model:
        try:
            import torch

            payload["torch"] = {
                "version": torch.__version__,
                "cuda_available": torch.cuda.is_available(),
                "cuda_version": torch.version.cuda,
                "device_count": torch.cuda.device_count(),
                "device_name": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
            }
        except Exception as exc:  # pragma: no cover - depends on optional runtime install state
            payload["status"] = "warning"
            payload["torch_error"] = str(exc)

    if any(
        check.get("exists") is False or check.get("valid_json") is False or check.get("ok") is False
        for check in checks
    ):
        payload["status"] = "failed"

    _print_json(payload)
    return 0 if payload["status"] in {"ok", "warning"} else 1


def command_demo(args: argparse.Namespace) -> int:
    if not args.toy:
        print("Only --toy demo mode is available from the product CLI today.", file=sys.stderr)
        return 2

    run = run_toy_steering(
        prompt=args.prompt,
        positive=args.positive,
        negative=args.negative,
        coefficient=args.coefficient,
        layer=args.layer,
    )
    if args.json:
        _print_json(run.to_dict())
    else:
        print("Toy activation steering demo")
        print()
        print(run.baseline)
        print(run.prompt_only)
        print(run.steered)
        print()
        print("Steering vector:")
        for feature, value in run.steering_vector.items():
            print(f"  {feature}: {value:+.4f}")
        print()
        print("Teaching notes:")
        for note in run.teaching_notes:
            print(f"- {note}")
    return 0


def command_api(args: argparse.Namespace) -> int:
    import uvicorn

    uvicorn.run("scripts.serve_api:app", host=args.host, port=args.port, reload=args.reload)
    return 0


def command_showcase(args: argparse.Namespace) -> int:
    if args.validate or args.action == "validate":
        payload = validate_showcase_files()
        _print_json(payload)
        return 0 if payload["status"] == "ok" else 1

    script_path = ROOT / "scripts" / "build_showcase.py"
    command = [sys.executable, str(script_path)]
    if args.skip_ollama:
        command.append("--skip-ollama")
    return subprocess.call(command, cwd=ROOT)


def command_validate_model(args: argparse.Namespace) -> int:
    from .introspection import registry_only_report

    report = registry_only_report(args.model_id).to_dict()
    _print_json(report)
    return 0 if report["steering_ready_by_registry"] else 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="llm-steering",
        description="Product CLI for the local-first activation steering lab.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    verify = subparsers.add_parser("verify", help="Check local repo readiness without running a model.")
    verify.add_argument("--no-model", action="store_true", help="Skip torch/CUDA/model checks.")
    verify.set_defaults(func=command_verify)

    demo = subparsers.add_parser("demo", help="Run a beginner-friendly deterministic demo.")
    demo.add_argument("--toy", action="store_true", help="Run the no-model toy activation steering demo.")
    demo.add_argument("--json", action="store_true", help="Emit machine-readable JSON.")
    demo.add_argument("--prompt", default=default_toy_run().prompt)
    demo.add_argument("--positive", default=default_toy_run().positive)
    demo.add_argument("--negative", default=default_toy_run().negative)
    demo.add_argument("--coefficient", type=float, default=1.4)
    demo.add_argument("--layer", type=int, default=3)
    demo.set_defaults(func=command_demo)

    api = subparsers.add_parser("api", help="Serve the local FastAPI workbench API.")
    api.add_argument("--host", default="127.0.0.1")
    api.add_argument("--port", type=int, default=8000)
    api.add_argument("--reload", action="store_true")
    api.set_defaults(func=command_api)

    showcase = subparsers.add_parser("showcase", help="Build or validate public showcase artifacts.")
    showcase.add_argument("action", nargs="?", choices=["build", "validate"], default="build")
    showcase.add_argument("--validate", action="store_true", help="Validate checked-in JSON artifacts.")
    showcase.add_argument("--skip-ollama", action="store_true", help="Forwarded to scripts/build_showcase.py.")
    showcase.set_defaults(func=command_showcase)

    validate_model = subparsers.add_parser("validate-model", help="Report registry gating for a model id.")
    validate_model.add_argument("model_id")
    validate_model.set_defaults(func=command_validate_model)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
