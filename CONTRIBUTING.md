# Contributing to llm-steering

Thanks for helping improve `llm-steering`.

This repository is a local-first research workspace for activation steering on open models. The goal is to keep it honest, reproducible, and lightweight enough for contributors to reason about without mystery meat infrastructure.

## Ground rules

- Keep model weights, cached datasets, and raw local experiment artifacts out of git.
- Prefer small, reproducible demo assets over giant output dumps.
- If you make a research claim in docs, include enough evidence or caveats for someone else to reproduce it.
- Preserve the separation between:
  - reusable library code in `src/llm_steering/`
  - runnable scripts in `scripts/`
  - source-backed notes in `research/`
  - public-facing showcase assets in `docs/`

## Local setup

1. Activate the repository virtual environment.
2. Install the package in editable mode with dev dependencies: `python -m pip install -e .[dev]`
3. Run the lightweight test suite: `python -m pytest`
4. Optionally verify the local runtime stack: `python scripts/verify_gpu.py`

## Pull request checklist

Before opening a PR, please make sure that:

- tests pass locally
- any new script has a short usage note in the README or docstring
- new prompt-pair configs include a clear description and conservative defaults
- large local files remain ignored
- secrets are not committed (`.env`, access tokens, cached credentials)
- public-facing docs reflect the actual current behavior of the code

## Working on steering experiments

If you add or modify a steering method:

- log the layer, coefficient, token targeting, and hook stage
- keep the baseline comparison in the same artifact when possible
- document whether the effect was qualitative, quantitative, or both
- call out failure cases instead of silently deleting them

## Public artifacts

Tracked assets should stay small and reviewable. Good candidates include:

- SVG diagrams
- Markdown tables
- compact JSON showcase outputs
- short GIFs that help explain qualitative behavior

Avoid committing:

- full model checkpoints
- large `.pt` vector dumps meant only for local work
- heavyweight notebook outputs that can be regenerated

## Code style

The codebase is intentionally simple:

- use type hints where practical
- keep functions focused and easy to test
- prefer additive changes over large rewrites
- keep research scripts explicit rather than overly abstract

If you're unsure whether a change belongs here, open an issue or draft PR with the question. Clear research beats clever opacity every time.
