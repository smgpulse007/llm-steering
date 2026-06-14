from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
import textwrap
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from PIL import Image, ImageDraw, ImageFont

from llm_steering.config import RuntimeSettings, load_prompt_pair
from llm_steering.hf_runtime import generate_text, load_hf_model
from llm_steering.ollama_client import OllamaClient
from llm_steering.steering import compute_steering_vector, generate_with_steering

DEFAULT_EXTRA_PROMPTS = (
    "Write a one-sentence opinion about getting stuck in traffic on a Monday morning.",
    "Write a one-sentence opinion about waiting through airport security during a holiday rush.",
)


def _serialize_repo_path(path: str | Path) -> str:
    candidate = Path(path)
    try:
        return str(candidate.resolve().relative_to(ROOT))
    except Exception:
        return str(path)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build small public-facing showcase assets for the repository README.")
    parser.add_argument(
        "--config",
        type=Path,
        default=ROOT / "configs" / "prompt_pairs" / "sentiment_rich.yaml",
        help="Prompt-pair config used for the steering showcase.",
    )
    parser.add_argument("--hf-model-id", default=None, help="Optional Hugging Face model id override.")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=ROOT / "docs" / "showcase",
        help="Directory for compact public JSON artifacts.",
    )
    parser.add_argument(
        "--asset-dir",
        type=Path,
        default=ROOT / "docs" / "assets",
        help="Directory for rendered images and GIFs.",
    )
    parser.add_argument(
        "--extra-prompt",
        action="append",
        default=[],
        help="Additional prompt(s) to include in the showcase. Can be repeated.",
    )
    parser.add_argument("--skip-ollama", action="store_true", help="Skip the optional Ollama vs HF baseline artifact.")
    return parser.parse_args()


def _load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        Path("C:/Windows/Fonts/segoeui.ttf"),
        Path("C:/Windows/Fonts/arial.ttf"),
    ]
    for path in candidates:
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


def _load_mono_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        Path("C:/Windows/Fonts/CascadiaMono.ttf"),
        Path("C:/Windows/Fonts/consola.ttf"),
        Path("C:/Windows/Fonts/lucon.ttf"),
    ]
    for path in candidates:
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


def _wrap_lines(text: str, width: int) -> list[str]:
    wrapped: list[str] = []
    for paragraph in text.splitlines() or [text]:
        lines = textwrap.wrap(paragraph, width=width) or [""]
        wrapped.extend(lines)
    return wrapped


def _build_frame(title: str, subtitle: str, body: str, accent: tuple[int, int, int]) -> Image.Image:
    image = Image.new("RGB", (1400, 900), "white")
    draw = ImageDraw.Draw(image)
    title_font = _load_font(34)
    subtitle_font = _load_font(22)
    body_font = _load_font(24)

    draw.rounded_rectangle((40, 40, 1360, 160), radius=28, fill=(241, 245, 249), outline=accent, width=4)
    draw.text((70, 70), title, font=title_font, fill=(15, 23, 42))
    draw.text((70, 118), subtitle, font=subtitle_font, fill=accent)

    draw.rounded_rectangle((40, 200, 1360, 840), radius=28, fill=(255, 255, 255), outline=(148, 163, 184), width=3)

    y = 240
    for line in _wrap_lines(body, width=72):
        draw.text((70, y), line, font=body_font, fill=(30, 41, 59))
        y += 38

    draw.text((70, 800), "Generated from docs/showcase JSON via scripts/build_showcase.py", font=subtitle_font, fill=(100, 116, 139))
    return image


def _wrap_preserving_indent(text: str, width: int) -> list[str]:
    wrapped: list[str] = []
    for paragraph in text.splitlines() or [text]:
        indent = len(paragraph) - len(paragraph.lstrip(" "))
        content = paragraph[indent:]
        lines = textwrap.wrap(content, width=max(8, width - indent)) or [""]
        wrapped.extend([(" " * indent) + line for line in lines])
    return wrapped


def _build_terminal_frame(title: str, lines: list[str]) -> Image.Image:
    image = Image.new("RGB", (1400, 900), "#020617")
    draw = ImageDraw.Draw(image)
    title_font = _load_font(24)
    mono_font = _load_mono_font(25)

    draw.rounded_rectangle((40, 40, 1360, 860), radius=28, fill="#0f172a", outline="#334155", width=3)
    draw.rounded_rectangle((40, 40, 1360, 100), radius=28, fill="#111827", outline="#334155", width=3)
    draw.ellipse((70, 60, 92, 82), fill="#fb7185")
    draw.ellipse((105, 60, 127, 82), fill="#fbbf24")
    draw.ellipse((140, 60, 162, 82), fill="#4ade80")
    draw.text((200, 58), title, font=title_font, fill="#e2e8f0")

    y = 140
    for line in lines:
        color = "#e2e8f0"
        if line.startswith("demo>"):
            color = "#93c5fd"
        elif line.startswith("{") or line.startswith("  "):
            color = "#cbd5e1"
        elif line.startswith("#"):
            color = "#94a3b8"

        for wrapped in _wrap_preserving_indent(line, width=78):
            draw.text((80, y), wrapped, font=mono_font, fill=color)
            y += 34

    draw.text((80, 820), "Portable public-safe terminal-style GIF generated with Pillow; optional VHS tapes live in docs/tapes/.", font=title_font, fill="#64748b")
    return image


def _save_gif(path: Path, frames: list[Image.Image], durations: list[int]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(
        path,
        save_all=True,
        append_images=frames[1:],
        format="GIF",
        duration=durations,
        loop=0,
        disposal=2,
    )


def _save_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


def main() -> None:
    args = parse_args()
    output_dir = args.output_dir
    asset_dir = args.asset_dir
    output_dir.mkdir(parents=True, exist_ok=True)
    asset_dir.mkdir(parents=True, exist_ok=True)

    settings = RuntimeSettings.from_env()
    pair = load_prompt_pair(args.config)
    prompts = [pair.default_user_prompt, *DEFAULT_EXTRA_PROMPTS, *args.extra_prompt]

    loaded = load_hf_model(settings, model_id=args.hf_model_id)
    artifact = compute_steering_vector(
        loaded,
        positive_prompt=pair.positive,
        negative_prompt=pair.negative,
        system_prompt=pair.system_prompt,
        layer_index=pair.layer,
        normalize=pair.normalize,
    )

    samples: list[dict[str, Any]] = []
    for label_index, prompt in enumerate(prompts, start=1):
        baseline = generate_text(
            loaded,
            system_prompt=pair.system_prompt,
            user_prompt=prompt,
            max_new_tokens=settings.max_new_tokens,
            do_sample=False,
        )
        post = generate_with_steering(
            loaded,
            system_prompt=pair.system_prompt,
            user_prompt=prompt,
            vector=artifact.vector,
            layer_index=pair.layer,
            coefficient=pair.coefficient,
            apply_to=pair.apply_to,
            hook_stage="post",
            max_new_tokens=settings.max_new_tokens,
            do_sample=False,
        )
        pre = generate_with_steering(
            loaded,
            system_prompt=pair.system_prompt,
            user_prompt=prompt,
            vector=artifact.vector,
            layer_index=pair.layer,
            coefficient=pair.coefficient,
            apply_to=pair.apply_to,
            hook_stage="pre",
            max_new_tokens=settings.max_new_tokens,
            do_sample=False,
        )
        samples.append(
            {
                "label": f"sample_{label_index}",
                "user_prompt": prompt,
                "baseline": baseline,
                "post_activation": post,
                "pre_activation": pre,
                "post_delta_detected": baseline != post,
                "pre_delta_detected": baseline != pre,
            }
        )

    showcase_payload: dict[str, Any] = {
        "pair": pair.name,
        "description": pair.description,
        "prompt_config": _serialize_repo_path(args.config),
        "hf_model_id": loaded.model_id,
        "hf_source": loaded.source,
        "layer": pair.layer,
        "coefficient": pair.coefficient,
        "apply_to": pair.apply_to,
        "normalize": pair.normalize,
        "vector_norm": float(artifact.vector.norm().item()),
        "samples": samples,
    }
    _save_json(output_dir / "pre_post_showcase.json", showcase_payload)

    hero = samples[0]
    baseline_frame = _build_frame(
        "Baseline generation",
        hero["user_prompt"],
        hero["baseline"],
        accent=(71, 85, 105),
    )
    post_frame = _build_frame(
        "Post-activation steering",
        f"layer={pair.layer} · coeff={pair.coefficient} · apply_to={pair.apply_to}",
        hero["post_activation"],
        accent=(2, 132, 199),
    )
    pre_frame = _build_frame(
        "Pre-activation steering",
        f"layer={pair.layer} · coeff={pair.coefficient} · apply_to={pair.apply_to}",
        hero["pre_activation"],
        accent=(22, 163, 74),
    )

    _save_gif(asset_dir / "post_activation_demo.gif", [baseline_frame, post_frame], [1800, 2200])
    _save_gif(asset_dir / "pre_activation_demo.gif", [baseline_frame, pre_frame], [1800, 2200])
    _save_gif(asset_dir / "pre_vs_post_demo.gif", [baseline_frame, post_frame, pre_frame], [1500, 1800, 1800])

    terminal_frames = [
        _build_terminal_frame(
            "Local verification",
            [
                r"demo> .\.venv\Scripts\python.exe -m pytest",
                ".......                                                                  [100%]",
                "7 passed, 2 warnings in 4.83s",
                "",
                r"demo> .\.venv\Scripts\python.exe scripts\verify_gpu.py",
                "{",
                '  "python_version": "3.13.1",',
                '  "torch_version": "2.11.0+cu128",',
                '  "device_name": "NVIDIA GeForce RTX 4090",',
                '  "ollama_on_path": true',
                "}",
            ],
        ),
        _build_terminal_frame(
            "Post-activation demo",
            [
                r"demo> python scripts\run_actadd.py --config configs\prompt_pairs\sentiment_rich.yaml",
                '{',
                '  "hook_stage": "post",',
                '  "steering_delta_detected": true,',
                f'  "baseline": "{hero["baseline"]}",',
                f'  "steered": "{hero["post_activation"]}"',
                '}',
            ],
        ),
        _build_terminal_frame(
            "Pre-activation demo",
            [
                r"demo> python scripts\run_actadd.py --config configs\prompt_pairs\sentiment_rich.yaml --hook-stage pre",
                '{',
                '  "hook_stage": "pre",',
                '  "steering_delta_detected": true,',
                f'  "baseline": "{hero["baseline"]}",',
                f'  "steered": "{hero["pre_activation"]}"',
                '}',
            ],
        ),
        _build_terminal_frame(
            "Public artifact generation",
            [
                r"demo> python scripts\build_showcase.py --skip-ollama",
                "# writes compact tracked showcase files",
                r"demo> dir docs\assets",
                "  activation_steering_flow.svg",
                "  post_activation_demo.gif",
                "  pre_activation_demo.gif",
                "  pre_post_hooking.svg",
                "  pre_vs_post_demo.gif",
                r"demo> dir docs\showcase",
                "  pre_post_showcase.json",
                "  README.md",
            ],
        ),
    ]
    _save_gif(asset_dir / "terminal_walkthrough.gif", terminal_frames, [1800, 2200, 2200, 2200])

    if args.skip_ollama:
        return

    ollama_payload: dict[str, Any] = {
        "prompt": "Explain activation steering in plain English in two sentences.",
        "system_prompt": "You are a helpful assistant.",
        "ollama_model": settings.ollama_model,
        "hf_model_id": loaded.model_id,
    }

    try:
        ollama = OllamaClient(base_url=settings.ollama_base_url, model=settings.ollama_model)
        ollama_payload["ollama_response"] = ollama.generate(
            ollama_payload["prompt"],
            system_prompt=ollama_payload["system_prompt"],
        )
        ollama_payload["hf_response"] = generate_text(
            loaded,
            system_prompt=ollama_payload["system_prompt"],
            user_prompt=ollama_payload["prompt"],
            max_new_tokens=settings.max_new_tokens,
            do_sample=False,
        )
        ollama_payload["status"] = "ok"
    except Exception as exc:  # pragma: no cover - depends on external Ollama runtime
        ollama_payload["status"] = "skipped"
        ollama_payload["error"] = str(exc)

    _save_json(output_dir / "ollama_vs_hf_baseline.json", ollama_payload)


if __name__ == "__main__":
    main()
