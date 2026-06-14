from pathlib import Path

from llm_steering.config import load_prompt_pair, project_root


def test_load_prompt_pair_from_repo_config() -> None:
    pair = load_prompt_pair(project_root() / "configs" / "prompt_pairs" / "sentiment.yaml")
    assert pair.name == "sentiment_shift"
    assert pair.positive == "Love"
    assert pair.negative == "Hate"
    assert pair.layer == 18
    assert pair.hook_stage == "post"
