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
USE_CASES: tuple[dict[str, Any], ...] = (
    {
        "slug": "customer_support_empathy",
        "config": ROOT / "configs" / "prompt_pairs" / "customer_support_empathy.yaml",
        "title": "Customer support de-escalation",
        "category": "Support / operations",
        "why_it_matters": "Tone steering can help a base support model sound calmer, more empathetic, and more ownership-oriented without retraining.",
        "what_to_notice": "The steered reply keeps the same task but sounds more immediate and supportive.",
        "accent": (14, 116, 144),
    },
    {
        "slug": "tutor_encouragement",
        "config": ROOT / "configs" / "prompt_pairs" / "tutor_encouragement.yaml",
        "title": "Encouraging tutoring explanations",
        "category": "Education / tutoring",
        "why_it_matters": "Activation steering can nudge a small open model toward clearer, more learner-friendly explanations for classroom or study workflows.",
        "what_to_notice": "The steered answer becomes more scaffolded and explanatory instead of just terse correctness.",
        "accent": (37, 99, 235),
    },
    {
        "slug": "release_risk_calibration",
        "config": ROOT / "configs" / "prompt_pairs" / "release_risk_calibration.yaml",
        "title": "Risk-aware launch recommendations",
        "category": "Product / release ops",
        "why_it_matters": "Teams can steer the same base model toward more calibrated launch memos, rollout advice, and go-live recommendations.",
        "what_to_notice": "The steered answer leans harder into phased rollout language and operational validation.",
        "accent": (202, 138, 4),
    },
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
    parser.add_argument("--skip-use-cases", action="store_true", help="Skip the higher-level starter-kit use-case assets.")
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


def _draw_wrapped_text(
    draw: ImageDraw.ImageDraw,
    *,
    text: str,
    x: int,
    y: int,
    width: int,
    font: ImageFont.FreeTypeFont | ImageFont.ImageFont,
    fill: str | tuple[int, int, int],
    line_height: int,
) -> int:
    for line in _wrap_lines(text, width=width):
        draw.text((x, y), line, font=font, fill=fill)
        y += line_height
    return y


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


def _build_use_case_title_frame(
    *,
    title: str,
    category: str,
    prompt: str,
    why_it_matters: str,
    what_to_notice: str,
    accent: tuple[int, int, int],
) -> Image.Image:
    image = Image.new("RGB", (1600, 900), "#f8fafc")
    draw = ImageDraw.Draw(image)
    title_font = _load_font(42)
    subtitle_font = _load_font(24)
    body_font = _load_font(28)

    draw.rounded_rectangle((50, 50, 1550, 210), radius=30, fill="#ffffff", outline=accent, width=5)
    draw.text((90, 88), title, font=title_font, fill="#0f172a")
    draw.text((92, 142), category, font=subtitle_font, fill=accent)

    draw.rounded_rectangle((50, 255, 1550, 455), radius=28, fill="#ffffff", outline="#cbd5e1", width=3)
    draw.text((85, 290), "Real public-facing prompt", font=subtitle_font, fill="#475569")
    _draw_wrapped_text(draw, text=prompt, x=85, y=330, width=80, font=body_font, fill="#1e293b", line_height=40)

    draw.rounded_rectangle((50, 500, 735, 835), radius=28, fill="#ffffff", outline="#cbd5e1", width=3)
    draw.text((85, 540), "Why this use case matters", font=subtitle_font, fill="#475569")
    _draw_wrapped_text(draw, text=why_it_matters, x=85, y=585, width=42, font=body_font, fill="#1e293b", line_height=40)

    draw.rounded_rectangle((865, 500, 1550, 835), radius=28, fill="#ffffff", outline="#cbd5e1", width=3)
    draw.text((900, 540), "What to notice in the output", font=subtitle_font, fill="#475569")
    _draw_wrapped_text(draw, text=what_to_notice, x=900, y=585, width=42, font=body_font, fill="#1e293b", line_height=40)

    draw.text((85, 850), "This GIF is generated from real model outputs captured by scripts/build_showcase.py.", font=subtitle_font, fill="#64748b")
    return image


def _build_use_case_comparison_frame(
    *,
    title: str,
    category: str,
    prompt: str,
    baseline: str,
    steered: str,
    what_changed: str,
    layer: int,
    coefficient: float,
    apply_to: str,
    hook_stage: str,
    accent: tuple[int, int, int],
) -> Image.Image:
    image = Image.new("RGB", (1600, 980), "#f8fafc")
    draw = ImageDraw.Draw(image)
    title_font = _load_font(38)
    subtitle_font = _load_font(22)
    body_font = _load_font(24)

    draw.rounded_rectangle((50, 40, 1550, 185), radius=30, fill="#ffffff", outline=accent, width=5)
    draw.text((90, 78), title, font=title_font, fill="#0f172a")
    draw.text((92, 132), f"{category} · layer={layer} · coeff={coefficient} · apply_to={apply_to} · hook={hook_stage}", font=subtitle_font, fill=accent)

    draw.rounded_rectangle((50, 210, 1550, 300), radius=24, fill="#ffffff", outline="#cbd5e1", width=3)
    draw.text((80, 240), f"Prompt: {prompt}", font=subtitle_font, fill="#334155")

    draw.rounded_rectangle((50, 335, 760, 845), radius=28, fill="#ffffff", outline="#94a3b8", width=3)
    draw.text((80, 370), "Baseline model output", font=subtitle_font, fill="#475569")
    _draw_wrapped_text(draw, text=baseline, x=80, y=420, width=38, font=body_font, fill="#1e293b", line_height=38)

    draw.rounded_rectangle((840, 335, 1550, 845), radius=28, fill="#ffffff", outline=accent, width=4)
    draw.text((870, 370), "Steered model output", font=subtitle_font, fill=accent)
    _draw_wrapped_text(draw, text=steered, x=870, y=420, width=38, font=body_font, fill="#1e293b", line_height=38)

    draw.rounded_rectangle((50, 870, 1550, 935), radius=18, fill="#e2e8f0", outline="#cbd5e1", width=2)
    draw.text((80, 890), f"What changed: {what_changed}", font=subtitle_font, fill="#334155")
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

    if not args.skip_use_cases:
        use_case_payloads: list[dict[str, Any]] = []
        combined_use_case_frames: list[Image.Image] = []
        combined_use_case_durations: list[int] = []

        for use_case in USE_CASES:
            use_case_pair = load_prompt_pair(use_case["config"])
            prompt = use_case_pair.default_user_prompt
            use_case_artifact = compute_steering_vector(
                loaded,
                positive_prompt=use_case_pair.positive,
                negative_prompt=use_case_pair.negative,
                system_prompt=use_case_pair.system_prompt,
                layer_index=use_case_pair.layer,
                normalize=use_case_pair.normalize,
            )
            baseline = generate_text(
                loaded,
                system_prompt=use_case_pair.system_prompt,
                user_prompt=prompt,
                max_new_tokens=settings.max_new_tokens,
                do_sample=False,
            )
            steered = generate_with_steering(
                loaded,
                system_prompt=use_case_pair.system_prompt,
                user_prompt=prompt,
                vector=use_case_artifact.vector,
                layer_index=use_case_pair.layer,
                coefficient=use_case_pair.coefficient,
                apply_to=use_case_pair.apply_to,
                hook_stage=use_case_pair.hook_stage,
                max_new_tokens=settings.max_new_tokens,
                do_sample=False,
            )

            payload = {
                "slug": use_case["slug"],
                "title": use_case["title"],
                "category": use_case["category"],
                "why_it_matters": use_case["why_it_matters"],
                "what_to_notice": use_case["what_to_notice"],
                "prompt_config": _serialize_repo_path(use_case["config"]),
                "user_prompt": prompt,
                "system_prompt": use_case_pair.system_prompt,
                "baseline": baseline,
                "steered": steered,
                "steering_delta_detected": baseline != steered,
                "layer": use_case_pair.layer,
                "coefficient": use_case_pair.coefficient,
                "apply_to": use_case_pair.apply_to,
                "hook_stage": use_case_pair.hook_stage,
            }
            use_case_payloads.append(payload)

            intro_frame = _build_use_case_title_frame(
                title=use_case["title"],
                category=use_case["category"],
                prompt=prompt,
                why_it_matters=use_case["why_it_matters"],
                what_to_notice=use_case["what_to_notice"],
                accent=use_case["accent"],
            )
            comparison_frame = _build_use_case_comparison_frame(
                title=use_case["title"],
                category=use_case["category"],
                prompt=prompt,
                baseline=baseline,
                steered=steered,
                what_changed=use_case["what_to_notice"],
                layer=use_case_pair.layer,
                coefficient=use_case_pair.coefficient,
                apply_to=use_case_pair.apply_to,
                hook_stage=use_case_pair.hook_stage,
                accent=use_case["accent"],
            )
            _save_gif(
                asset_dir / f"use_case_{use_case['slug']}.gif",
                [intro_frame, comparison_frame],
                [2200, 2600],
            )
            combined_use_case_frames.extend([intro_frame, comparison_frame])
            combined_use_case_durations.extend([1700, 2200])

        _save_json(output_dir / "use_case_showcase.json", {"use_cases": use_case_payloads})
        if combined_use_case_frames:
            _save_gif(asset_dir / "starter_use_cases.gif", combined_use_case_frames, combined_use_case_durations)

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
