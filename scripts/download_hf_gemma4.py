from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from huggingface_hub import HfApi, snapshot_download
from huggingface_hub.utils import HfHubHTTPError

from llm_steering.config import RuntimeSettings


def default_local_dir(model_id: str) -> Path:
    safe_name = model_id.replace("/", "__").replace(":", "_")
    return ROOT / "models" / "hf" / safe_name


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Download a Gemma 4 checkpoint from Hugging Face.")
    parser.add_argument("--model-id", default=None, help="Hugging Face model id to download.")
    parser.add_argument("--local-dir", type=Path, default=None, help="Target local directory.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    settings = RuntimeSettings.from_env()
    model_id = args.model_id or settings.hf_model_id
    local_dir = args.local_dir or (settings.hf_model_local_dir if model_id == settings.hf_model_id else default_local_dir(model_id))
    local_dir.mkdir(parents=True, exist_ok=True)

    api = HfApi(token=settings.hf_token or None)
    try:
        identity = api.whoami()
    except Exception:
        identity = None

    print(
        json.dumps(
            {
                "model_id": model_id,
                "local_dir": str(local_dir),
                "authenticated": identity is not None,
                "user": None if identity is None else identity.get("name") or identity.get("fullname"),
            },
            indent=2,
        )
    )

    try:
        path = snapshot_download(
            repo_id=model_id,
            local_dir=str(local_dir),
            token=settings.hf_token or None,
            resume_download=True,
        )
    except HfHubHTTPError as exc:
        raise SystemExit(
            "Hugging Face download failed. Make sure your token is valid and you have accepted any required model terms.\n"
            f"Original error: {exc}"
        ) from exc

    print(json.dumps({"download_path": path}, indent=2))


if __name__ == "__main__":
    main()
