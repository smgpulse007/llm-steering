from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from llm_steering.config import RuntimeSettings, load_prompt_pair
from llm_steering.hf_runtime import generate_text, load_hf_model
from llm_steering.steering import compute_steering_vector, generate_with_steering, save_vector


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run a basic ActAdd-style steering experiment.")
    parser.add_argument("--config", type=Path, required=True, help="Prompt-pair YAML config.")
    parser.add_argument("--user-prompt", default=None, help="Override the user prompt from the config.")
    parser.add_argument("--hf-model-id", default=None, help="Optional HF model id override.")
    parser.add_argument("--layer", type=int, default=None)
    parser.add_argument("--coefficient", type=float, default=None)
    parser.add_argument(
        "--hook-stage",
        choices=("post", "pre"),
        default=None,
        help="Whether to inject the steering vector before or after the chosen transformer block.",
    )
    parser.add_argument("--max-new-tokens", type=int, default=None)
    parser.add_argument("--save-vector", action="store_true")
    parser.add_argument("--vector-out", type=Path, default=None)
    parser.add_argument("--result-out", type=Path, default=None)
    return parser.parse_args()


def default_vector_path(model_id: str, pair_name: str, layer: int) -> Path:
    model_stub = model_id.split("/")[-1].replace(":", "_")
    return ROOT / "vectors" / f"{pair_name}_{model_stub}_layer{layer}.pt"


def _serialize_repo_path(path: str | Path | None) -> str | None:
    if path is None:
        return None
    candidate = Path(path)
    try:
        return str(candidate.resolve().relative_to(ROOT))
    except Exception:
        return str(path)


def main() -> None:
    args = parse_args()
    settings = RuntimeSettings.from_env()
    pair = load_prompt_pair(args.config)
    user_prompt = args.user_prompt or pair.default_user_prompt
    layer = args.layer if args.layer is not None else pair.layer
    coefficient = args.coefficient if args.coefficient is not None else pair.coefficient
    hook_stage = args.hook_stage or pair.hook_stage
    max_new_tokens = args.max_new_tokens or settings.max_new_tokens

    loaded = load_hf_model(settings, model_id=args.hf_model_id)
    artifact = compute_steering_vector(
        loaded,
        positive_prompt=pair.positive,
        negative_prompt=pair.negative,
        system_prompt=pair.system_prompt,
        layer_index=layer,
        normalize=pair.normalize,
    )

    baseline = generate_text(
        loaded,
        system_prompt=pair.system_prompt,
        user_prompt=user_prompt,
        max_new_tokens=max_new_tokens,
        do_sample=False,
    )
    steered = generate_with_steering(
        loaded,
        system_prompt=pair.system_prompt,
        user_prompt=user_prompt,
        vector=artifact.vector,
        layer_index=layer,
        coefficient=coefficient,
        apply_to=pair.apply_to,
        hook_stage=hook_stage,
        max_new_tokens=max_new_tokens,
        do_sample=False,
    )

    vector_path = None
    if args.save_vector or args.vector_out is not None:
        vector_path = save_vector(artifact, args.vector_out or default_vector_path(loaded.model_id, pair.name, layer))

    result = {
        "pair": pair.name,
        "description": pair.description,
        "prompt_config": _serialize_repo_path(args.config),
        "hf_model_id": loaded.model_id,
        "hf_source": loaded.source,
        "positive_prompt": pair.positive,
        "negative_prompt": pair.negative,
        "system_prompt": pair.system_prompt,
        "user_prompt": user_prompt,
        "layer": layer,
        "coefficient": coefficient,
        "apply_to": pair.apply_to,
        "hook_stage": hook_stage,
        "normalize": pair.normalize,
        "max_new_tokens": max_new_tokens,
        "vector_norm": float(artifact.vector.norm().item()),
        "baseline": baseline,
        "steered": steered,
        "steering_delta_detected": baseline != steered,
        "vector_path": _serialize_repo_path(vector_path),
        "vector_metadata": artifact.metadata,
    }

    if args.result_out is not None:
        args.result_out.parent.mkdir(parents=True, exist_ok=True)
        args.result_out.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")

    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
