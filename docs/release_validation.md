# llm-steering Release Validation Snapshot

Date: 2026-07-06
Branches: `codex/docs-first-pages`, `main`
Validated landing commit: `6c7b0a54c097eb68ac094ba52c68dfcc9c7461f3`
Repository: `https://github.com/smgpulse007/llm-steering`

## Clean Environment Evidence

GitHub Actions CI passed on fresh Ubuntu runners:

- Branch validation:
  - Workflow: `ci`
  - Run: `https://github.com/smgpulse007/llm-steering/actions/runs/28793358581`
  - Job: `tests`
  - Result: `success`
  - Started: `2026-07-06T13:00:20Z`
  - Completed: `2026-07-06T13:02:44Z`
- Main validation:
  - Workflow: `ci`
  - Run: `https://github.com/smgpulse007/llm-steering/actions/runs/28793530414`
  - Job: `tests`
  - Result: `success`
  - Started: `2026-07-06T13:03:33Z`
  - Completed: `2026-07-06T13:07:11Z`

The CI jobs validated:

- Base editable install: `python -m pip install -e .`
- Base no-model CLI path:
  - `llm-steering --help`
  - `llm-steering verify --no-model`
  - `llm-steering demo --toy --json`
  - `llm-steering showcase validate`
  - `llm-steering artifacts validate`
- Development install: `python -m pip install -e .[dev]`
- Python suite: `python -m pytest`
- Web dependency install: `npm ci`
- Normal web build: `npm run build`
- Pages web build: `npm run build:pages`
- Pages asset-base validation: `python scripts/validate_pages_build.py`

## Pages Deployment Evidence

GitHub Pages deployed the validated landing commit from `main`:

- Workflow: `pages`
- Run: `https://github.com/smgpulse007/llm-steering/actions/runs/28793530417`
- Build job: `success`, completed `2026-07-06T13:04:01Z`
- Deploy job: `success`, completed `2026-07-06T13:04:15Z`
- Public URL: `https://smgpulse007.github.io/llm-steering/`
- Browser route verified: `https://smgpulse007.github.io/llm-steering/#docs/lesson_actadd`
- Public route checks: React root rendered, docs navigation visible, lesson content visible, asset URLs use `/llm-steering/`, and no browser console errors were observed.

## Local Closeout Evidence

Validated locally on Windows with `.venv` Python 3.13.1:

```powershell
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe -m llm_steering.cli verify --no-model
.\.venv\Scripts\python.exe -m llm_steering.cli demo --toy --json
.\.venv\Scripts\python.exe -m llm_steering.cli showcase validate
npm run build
npm run build:pages
.\.venv\Scripts\python.exe scripts\validate_pages_build.py
git diff --check
```

Results:

- Python tests: `54 passed, 3 warnings`
- No-model verification: passed
- Toy demo: passed
- Showcase validation: passed
- Normal web build: passed
- Pages build: passed
- Pages asset-base validation: passed
- Diff whitespace check: passed
- Large Markdown chunk warning: resolved by splitting Markdown renderer dependencies into `markdown-core`, `markdown-highlight`, and `markdown-math`.

## GitHub Repository State

Verified with GitHub CLI on 2026-07-06:

- Default branch: `main`
- Visibility: public
- Homepage: `https://smgpulse007.github.io/llm-steering/`
- GitHub Pages:
  - build type: workflow
  - source branch: `main`
  - HTTPS enforced: true
  - public: true
- Topics include activation steering, interpretability, local-first AI, PyTorch, FastAPI, React, and representation engineering.

## Model Validation Caveat

This snapshot does not promote any additional model to supported status. Live loaded-model gates still require local weights and per-model evidence:

- runtime load succeeds
- prompt formatting verified
- hidden states returned
- transformer layer discovery succeeds
- pre-hook smoke passes
- post-hook smoke passes
- loaded hook smoke passes for `last_token` and `all_tokens`
- baseline-vs-steered artifact exported and validated

Unsupported, experimental, and generation-only models remain visibly gated in the registry and UI.
