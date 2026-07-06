from __future__ import annotations

import importlib.util
from pathlib import Path


SCRIPT_PATH = Path(__file__).resolve().parents[1] / "scripts" / "validate_pages_build.py"
SPEC = importlib.util.spec_from_file_location("validate_pages_build", SCRIPT_PATH)
assert SPEC is not None
validate_pages_build_module = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(validate_pages_build_module)


def test_validate_pages_build_accepts_base_scoped_assets(tmp_path: Path) -> None:
    dist = tmp_path / "dist"
    assets = dist / "assets"
    assets.mkdir(parents=True)
    (dist / "index.html").write_text(
        """
<!doctype html>
<script type="module" src="/llm-steering/assets/index.js"></script>
<link rel="stylesheet" href="/llm-steering/assets/index.css">
""",
        encoding="utf-8",
    )
    (assets / "index.js").write_text("console.log('ok')", encoding="utf-8")
    (assets / "index.css").write_text("body{}", encoding="utf-8")

    assert validate_pages_build_module.validate_pages_build(dist) == []


def test_validate_pages_build_rejects_wrong_base_and_missing_assets(tmp_path: Path) -> None:
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text(
        """
<!doctype html>
<script type="module" src="/assets/index.js"></script>
<link rel="stylesheet" href="/llm-steering/assets/missing.css">
""",
        encoding="utf-8",
    )

    errors = validate_pages_build_module.validate_pages_build(dist)

    assert "Asset URL does not use Pages base /llm-steering/: /assets/index.js" in errors
    assert "Referenced asset is missing: /llm-steering/assets/missing.css" in errors
