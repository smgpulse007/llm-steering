# Showcase artifacts

This directory contains small, tracked artifacts intended for the public README and repository landing experience.

## Expected files

- `pre_post_showcase.json` — compact baseline vs pre-activation vs post-activation results
- `use_case_showcase.json` — curated starter-kit use cases with real baseline vs steered outputs
- `ollama_vs_hf_baseline.json` — optional runtime baseline comparison between local Ollama and Hugging Face

The README also embeds GIF assets rendered in `docs/assets/`, including a terminal-style walkthrough that mirrors the commands shown to users.

## How they are generated

Run:

- `python scripts/build_showcase.py`

That script writes machine-readable JSON here and writes the corresponding GIFs to `docs/assets/`.

## Design goals

The showcase artifacts are intentionally:

- small enough to review in git
- reproducible from repository scripts
- directly referenced by the README
- representative of the current implemented behavior

Heavier local experiment logs should stay outside this directory.
