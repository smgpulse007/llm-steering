from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


ASSET_ATTR_RE = re.compile(r"""(?:src|href)=["']([^"']+)["']""")
REQUIRED_ASSET_SUFFIXES = (".js", ".css")


def _normalize_base(base: str) -> str:
    normalized = base.strip() or "/"
    if not normalized.startswith("/"):
        normalized = f"/{normalized}"
    if not normalized.endswith("/"):
        normalized = f"{normalized}/"
    return normalized


def _asset_paths(index_html: str) -> list[str]:
    return [
        value
        for value in ASSET_ATTR_RE.findall(index_html)
        if value.endswith((".js", ".css", ".woff", ".woff2", ".ttf", ".gif", ".png", ".jpg", ".jpeg", ".webp", ".svg"))
    ]


def validate_pages_build(dist_dir: Path, base: str = "/llm-steering/") -> list[str]:
    errors: list[str] = []
    base = _normalize_base(base)
    index_path = dist_dir / "index.html"

    if not index_path.exists():
        return [f"Missing Pages index: {index_path}"]

    index_html = index_path.read_text(encoding="utf-8")
    assets = _asset_paths(index_html)
    if not assets:
        errors.append("index.html does not reference any built assets.")

    for suffix in REQUIRED_ASSET_SUFFIXES:
        if not any(asset.endswith(suffix) for asset in assets):
            errors.append(f"index.html does not reference a {suffix} asset.")

    for asset in assets:
        if asset.startswith("http://") or asset.startswith("https://"):
            continue
        if not asset.startswith(base):
            errors.append(f"Asset URL does not use Pages base {base}: {asset}")
            continue
        relative_asset = asset.removeprefix(base)
        asset_path = dist_dir / relative_asset
        if not asset_path.exists():
            errors.append(f"Referenced asset is missing: {asset}")
        elif asset_path.stat().st_size == 0:
            errors.append(f"Referenced asset is empty: {asset}")

    return errors


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Validate the built GitHub Pages asset graph.")
    parser.add_argument("--dist", default="apps/web/dist", help="Path to the Vite dist directory.")
    parser.add_argument("--base", default="/llm-steering/", help="Expected GitHub Pages base path.")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    errors = validate_pages_build(Path(args.dist), base=args.base)
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print(f"Pages build validated: {args.dist} ({_normalize_base(args.base)})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
