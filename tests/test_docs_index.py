from llm_steering.docs_index import extract_markdown_sections


def test_extract_markdown_sections_skips_fences_and_deduplicates_ids() -> None:
    sections = extract_markdown_sections(
        """# Overview

```md
## Not a visible heading
```

## Steering-vector math
### Steering-vector math
"""
    )

    assert sections == [
        {"id": "overview", "title": "Overview", "level": 1},
        {"id": "steering-vector-math", "title": "Steering-vector math", "level": 2},
        {"id": "steering-vector-math-2", "title": "Steering-vector math", "level": 3},
    ]
