from __future__ import annotations

import argparse
from pathlib import Path
import textwrap

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build README-specific GIF assets.")
    parser.add_argument(
        "--asset-dir",
        type=Path,
        default=ROOT / "docs" / "assets",
        help="Directory where README GIF assets should be written.",
    )
    parser.add_argument(
        "--ui-frame-dir",
        type=Path,
        default=ROOT / ".tmp" / "readme_ui_frames",
        help="Directory containing captured PNG frames for the workbench UI GIF.",
    )
    parser.add_argument("--skip-ui", action="store_true", help="Only generate the setup terminal GIF.")
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


def _wrap(text: str, width: int) -> list[str]:
    lines: list[str] = []
    for paragraph in text.splitlines() or [text]:
        lines.extend(textwrap.wrap(paragraph, width=width) or [""])
    return lines


def _terminal_frame(title: str, commands: list[str], footer: str) -> Image.Image:
    image = Image.new("RGB", (1500, 920), "#071012")
    draw = ImageDraw.Draw(image)
    title_font = _load_font(28)
    label_font = _load_font(22)
    mono_font = _load_mono_font(27)

    draw.rounded_rectangle((36, 36, 1464, 884), radius=28, fill="#101819", outline="#4b5c5d", width=3)
    draw.rounded_rectangle((36, 36, 1464, 104), radius=28, fill="#1d2527", outline="#4b5c5d", width=3)
    draw.ellipse((70, 60, 94, 84), fill="#ff6b78")
    draw.ellipse((110, 60, 134, 84), fill="#ffd166")
    draw.ellipse((150, 60, 174, 84), fill="#7ce3b1")
    draw.text((210, 58), title, font=title_font, fill="#f2f8f5")

    y = 146
    for command in commands:
        color = "#d7e7e1"
        if command.startswith("PS>"):
            color = "#9df0c8"
        elif command.startswith("#"):
            color = "#91aaa2"
        elif command.startswith("http"):
            color = "#9fd6ff"
        for line in _wrap(command, 82):
            draw.text((78, y), line, font=mono_font, fill=color)
            y += 38
        y += 8

    draw.rounded_rectangle((70, 800, 1430, 850), radius=14, fill="#182225", outline="#334145", width=2)
    draw.text((94, 812), footer, font=label_font, fill="#b7c7c2")
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
        optimize=True,
    )


def build_setup_terminal_gif(asset_dir: Path) -> Path:
    frames = [
        _terminal_frame(
            "Setup: clone and environment",
            [
                "PS> git clone https://github.com/smgpulse007/llm-steering.git",
                "PS> cd llm-steering",
                "PS> python -m venv .venv",
                r"PS> .\.venv\Scripts\Activate.ps1",
            ],
            "Create an isolated Python environment before downloading any model files.",
        ),
        _terminal_frame(
            "Setup: install and model access",
            [
                "PS> python -m pip install -e .[dev]",
                "# Configure HF_TOKEN in .env or run hf auth login",
                "PS> python scripts/download_hf_gemma4.py",
                "PS> python scripts/verify_gpu.py",
            ],
            "The repo does not ship model weights; Hugging Face access stays explicit.",
        ),
        _terminal_frame(
            "Run the workbench",
            [
                r"PS> .\.venv\Scripts\python.exe -m uvicorn scripts.serve_api:app --host 127.0.0.1 --port 8000",
                "PS> cd apps/web",
                "PS> npm install",
                "PS> npm run dev",
                "http://127.0.0.1:5173",
            ],
            "FastAPI serves experiments; Vite serves the local steering console.",
        ),
        _terminal_frame(
            "Validate before release",
            [
                "PS> python -m pytest",
                "23 passed",
                "PS> cd apps/web",
                "PS> npm run build",
                "TypeScript and Vite production build passed",
            ],
            "The public README posture is tied to repeatable checks.",
        ),
    ]
    path = asset_dir / "setup_terminal_walkthrough.gif"
    _save_gif(path, frames, [1800, 2000, 2200, 1900])
    return path


def build_ui_gif(asset_dir: Path, ui_frame_dir: Path) -> Path | None:
    frame_paths = sorted(ui_frame_dir.glob("*.png"))
    if not frame_paths:
        return None

    frames: list[Image.Image] = []
    for frame_path in frame_paths:
        frame = Image.open(frame_path).convert("RGB")
        if frame.width > 1240:
            ratio = 1240 / frame.width
            frame = frame.resize((1240, int(frame.height * ratio)), Image.Resampling.LANCZOS)
        frames.append(frame)

    path = asset_dir / "workbench_ui_overview.gif"
    _save_gif(path, frames, [1700, 1700, 1800, 1900, 1900][: len(frames)])
    return path


def main() -> None:
    args = parse_args()
    args.asset_dir.mkdir(parents=True, exist_ok=True)
    terminal_path = build_setup_terminal_gif(args.asset_dir)
    print(f"Wrote {terminal_path.relative_to(ROOT)}")

    if args.skip_ui:
        return

    ui_path = build_ui_gif(args.asset_dir, args.ui_frame_dir)
    if ui_path is None:
        print(f"No UI frames found in {args.ui_frame_dir}; skipped workbench UI GIF.")
    else:
        print(f"Wrote {ui_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
