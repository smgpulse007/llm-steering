from llm_steering.showcase import SHOWCASE_JSON_PATHS, validate_showcase_file, validate_showcase_files


def test_all_showcase_json_files_validate() -> None:
    payload = validate_showcase_files()

    assert payload["status"] == "ok"
    assert len(payload["files"]) == len(SHOWCASE_JSON_PATHS)


def test_invalid_showcase_file_reports_errors(tmp_path) -> None:
    path = tmp_path / "bad.json"
    path.write_text("{", encoding="utf-8")

    result = validate_showcase_file(path)

    assert result["ok"] is False
    assert result["errors"]
