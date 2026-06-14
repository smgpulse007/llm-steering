from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from llm_steering.config import RuntimeSettings
from llm_steering.hf_runtime import generate_text, load_hf_model
from llm_steering.ollama_client import OllamaClient


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Compare Ollama and Hugging Face baseline generations.")
    parser.add_argument("--prompt", required=True, help="User prompt to send to both runtimes.")
    parser.add_argument("--system-prompt", default="You are a helpful assistant.")
    parser.add_argument("--hf-model-id", default=None)
    parser.add_argument("--max-new-tokens", type=int, default=None)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    settings = RuntimeSettings.from_env()

    ollama = OllamaClient(base_url=settings.ollama_base_url, model=settings.ollama_model)
    ollama_response = ollama.generate(args.prompt, system_prompt=args.system_prompt)

    loaded = load_hf_model(settings, model_id=args.hf_model_id)
    hf_response = generate_text(
        loaded,
        system_prompt=args.system_prompt,
        user_prompt=args.prompt,
        max_new_tokens=args.max_new_tokens or settings.max_new_tokens,
        do_sample=False,
    )

    result = {
        "prompt": args.prompt,
        "system_prompt": args.system_prompt,
        "ollama_model": settings.ollama_model,
        "hf_model_id": loaded.model_id,
        "hf_source": loaded.source,
        "ollama_response": ollama_response,
        "hf_response": hf_response,
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
