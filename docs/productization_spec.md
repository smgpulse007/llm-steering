# llm-steering Open Source Productization Spec

Status: implementation contract with productization and docs-first slices applied
Branch: `codex/docs-first-pages`
Date: 2026-07-05
Owner: smgpulse007

## 1. Objective

Turn `llm-steering` from a working local starter kit into a professional open source product for learning, demonstrating, and running activation steering experiments.

The product should support two linked journeys:

1. Beginner journey: teach the foundations of transformer internals, prompt steering, activation steering, steering vectors, hook placement, and evaluation discipline.
2. Advanced journey: let users run real local activation-steering experiments, inspect outputs and artifacts, and extend the system to new open models through explicit validation gates.

The repository should remain honest about what is verified. A model, method, or workflow is not "supported" until the repo contains a reproducible validation path and the UI/docs expose the exact status.

## 2. Current Baseline

The repo already contains meaningful product surface:

- Python package under `src/llm_steering`.
- ActAdd and mean-difference steering-vector construction.
- Pre-activation and post-activation PyTorch hooks.
- Hugging Face runtime integration for local hidden-state access.
- FastAPI API in `src/llm_steering/api.py`.
- React/Vite workbench under `apps/web`.
- Local documentation rendered through the API and static Pages fallback.
- Public Pages home with a guided foundations-to-experiments learning path.
- Docs reader with grouped documents, table-of-contents extraction, and hashable section links.
- Public GIF/JSON showcase artifacts under `docs/assets` and `docs/showcase`.
- Research archive under `research`.
- GitHub Actions CI for Python tests.
- Release checklist and changelog for public release handoff.

Local validation on 2026-07-05:

- `.\.venv\Scripts\python.exe --version`: Python 3.13.1
- `.\.venv\Scripts\python.exe -m pytest`: 54 tests passed, 3 warnings
- `cd apps/web; npm.cmd run build`: production build passed
- `cd apps/web; npm.cmd run build:pages`: Pages production build passed with `/llm-steering/` asset base
- `.\.venv\Scripts\python.exe scripts\validate_pages_build.py`: passed
- `.\.venv\Scripts\python.exe -m llm_steering.cli verify --no-model`: passed
- `.\.venv\Scripts\python.exe -m llm_steering.cli demo --toy --json`: passed
- `.\.venv\Scripts\python.exe -m llm_steering.cli showcase validate`: passed
- Frontend chunk split: Markdown renderer dependencies now build as `markdown-core`, `markdown-highlight`, and `markdown-math` chunks below Vite's warning threshold
- GitHub Pages workflow and static build exist; live action status should be rechecked after this branch is pushed or merged

## 3. Product Definition

### Product Name

`llm-steering`

### One-line Positioning

A local-first open lab for learning activation steering and running reproducible steering-vector experiments on open language models.

### Core Promise

Users should be able to clone the repo, install it with clear instructions, run a no-model tutorial, then graduate into local model experiments that produce baseline-vs-steered outputs and reproducible artifacts.

### Non-goals

- Do not claim validated steering for DiffusionGemma until a diffusion-aware adapter is designed and tested.
- Do not claim validated steering for Qwen, Phi, Mistral, Llama, or MoE models until hidden-state extraction, layer discovery, hook smoke tests, and artifact exports pass.
- Do not turn the project into a generic chatbot UI.
- Do not hide limitations behind polished demos.
- Do not require a large gated model for the beginner learning path.

## 4. Users And Workflows

### Persona A: Curious Beginner

Goal: understand what activation steering is and why it differs from prompt engineering.

Expected workflow:

1. Open GitHub Pages.
2. Read or interact with a guided lesson.
3. Compare prompt steering vs activation steering conceptually.
4. Inspect a static baseline-vs-steered demo artifact.
5. Run a no-model local toy demo.
6. Understand what hardware/model access is required for real experiments.

### Persona B: Applied Engineer

Goal: run practical steering experiments for tone, support, tutoring, risk calibration, or code review behavior.

Expected workflow:

1. Clone and install the repo.
2. Run environment verification.
3. Download or point at a supported local model.
4. Launch API and workbench.
5. Pick a preset or custom prompt-pair dataset.
6. Run baseline and steered generation.
7. Inspect diff, vector diagnostics, run settings, and result artifact.
8. Export a reproduction packet.

### Persona C: Research-Oriented User

Goal: use the repo as a compact baseline for ActAdd, CAA-style mean differences, layer sweeps, and future SEA/SAE work.

Expected workflow:

1. Read methodology and research archive.
2. Run scripted experiments.
3. Sweep layer/coefficient/hook-stage/token-scope settings.
4. Compare metrics and qualitative outputs.
5. Add a model adapter or method implementation behind validation gates.

## 5. Expert Audit Lenses

Every phase should be reviewed through these lenses before being called done:

1. Open source release engineer: installation, packaging, CI, docs, dependency hygiene.
2. ML systems engineer: runtime compatibility, hardware assumptions, model loading, artifact reproducibility.
3. Research lead: methods, claims, citations, limits, evaluation design.
4. Product and education designer: beginner path, lesson sequencing, user comprehension.
5. UI/UX engineer: workbench usability, visual hierarchy, responsive behavior, loading/error states.
6. QA and safety reviewer: unsupported-model gating, failure modes, no overclaiming, no unsafe hidden state.

## 6. Architecture Target

### Local Runtime

The local runtime remains the advanced execution path:

- Python package provides steering primitives.
- FastAPI exposes model registry, runtime status, docs, vector build, experiment run, sweep planning/execution, and artifact readback.
- React workbench proxies `/api/*` to the local FastAPI server in development.
- Local model weights and generated artifacts stay out of git.

### Public Static Site

GitHub Pages is the public learning and portfolio surface:

- Deployed from the repo with GitHub Actions.
- Uses static assets and checked-in showcase JSON.
- Does not require the Python API.
- Makes the first screen useful without local setup.
- Clearly links to local advanced setup for real steering runs.

### Shared Content

Beginner lessons, method explainers, source references, and showcase artifacts should be shared between the static site and local workbench where practical. Avoid maintaining two unrelated narratives.

## 7. Research Spine

The product should teach and implement methods in this order:

1. Transformer basics: tokens, embeddings, layers, residual stream, hidden states.
2. Prompt steering: system prompts, few-shot examples, limitations.
3. Activation steering: inference-time activation edits.
4. ActAdd: single contrast pair, steering vector, coefficient, layer, hook.
5. CAA-style mean difference: multiple contrast pairs and more stable behavior directions.
6. Evaluation loop: baseline, prompt-only control, steered output, off-target checks, layer/coefficient sweeps.
7. Advanced roadmap: SEA, activation patching, SAE-guided steering, conditional activation steering, feature steering.

Source categories:

- Primary research papers.
- Official model documentation.
- Official or widely used implementation repos.
- Public article layer for explanation, not as sole proof for technical claims.

## 8. Phase Plan

### Phase 0: Branch And Baseline Audit

Objective: freeze the current truth before changing implementation.

Deliverables:

- Productization branch.
- Current validation notes.
- Repo gap audit.
- GitHub Pages status check.

Likely files:

- `docs/productization_spec.md`
- `docs/release_readiness_audit.md`

Validation gates:

- `git status --short --branch`
- `.\.venv\Scripts\python.exe -m pytest -q`
- `cd apps/web; npm.cmd run build`
- `gh repo view smgpulse007/llm-steering --json ...`
- `gh api repos/smgpulse007/llm-steering/pages`

Exit criteria:

- Branch exists.
- Baseline checks are recorded.
- Gaps are written as measurable work, not vague intentions.

### Phase 1: Installation And Packaging Hardening

Objective: make a fresh clone installable and understandable without relying on the maintainer's workstation.

Deliverables:

- Clear setup matrix:
  - Windows PowerShell
  - macOS/Linux shell
  - optional GPU path
  - no-model tutorial path
- Dependency strategy:
  - split core, API, notebook, CUDA/heavy, and dev extras where practical
  - reduce mandatory dependencies for users who only want the tutorial or static docs
- Console entry points:
  - `llm-steering verify`
  - `llm-steering api`
  - `llm-steering demo`
  - `llm-steering showcase`
- `Makefile` or `justfile` equivalent if it fits cross-platform needs.
- Fresh-clone smoke instructions.

Likely files:

- `pyproject.toml`
- `src/llm_steering/cli.py`
- `scripts/serve_api.py`
- `scripts/verify_gpu.py`
- `README.md`
- `.github/workflows/ci.yml`
- `.env.example`

Validation gates:

- `python -m pip install -e .`
- `python -m pip install -e .[api,media]`
- `python -m llm_steering.cli verify` or equivalent console command
- `llm-steering --help`
- `llm-steering verify --no-model`
- `python -m pytest -q`

Stop conditions:

- If Python 3.13-only support blocks common ML dependency installs, decide whether to support Python 3.11/3.12 as the public default while retaining 3.13 validation.
- If PyTorch CUDA dependency resolution becomes platform-specific, document CPU/no-model and GPU paths separately.

### Phase 2: No-Model Beginner Mode

Objective: allow anyone to learn the mechanics without downloading gated model weights.

Deliverables:

- Toy transformer or synthetic residual-stream simulation.
- Static demonstration of:
  - prompt-only change
  - activation-vector addition
  - coefficient sweep
  - layer choice metaphor
  - failure/oversteer example
- Beginner lesson content as structured data or Markdown.
- Tests for toy mode.

Likely files:

- `src/llm_steering/toy_runtime.py`
- `src/llm_steering/lessons.py`
- `docs/lessons/`
- `apps/web/src/lib/lessons.ts`
- `apps/web/src/App.tsx`

Validation gates:

- `llm-steering demo --toy`
- `python -m pytest tests/test_toy_runtime.py -q`
- Static site can render beginner lessons without API.

Exit criteria:

- A user can complete the beginner path without Hugging Face auth, GPU, Ollama, or model weights.
- Beginner mode does not pretend synthetic behavior is real model steering.

### Phase 3: GitHub Pages Public Site

Objective: create a polished public site that explains the project and shows real checked-in artifacts.

Deliverables:

- Pages build workflow.
- Vite `base` configured for `/llm-steering/`.
- Static site mode that uses checked-in showcase JSON/GIFs.
- Public docs reader with grouped documents, search/filter, section outline, and hashable section links.
- Static Pages docs bundle that matches the local API docs inventory.
- Home page with:
  - project thesis
  - beginner path entry
  - guided foundations-to-experiments journey
  - advanced workbench preview
  - research map
  - model support matrix
  - limitations
  - install path
- Repo metadata update with homepage URL once Pages is live.

Likely files:

- `.github/workflows/pages.yml`
- `apps/web/vite.config.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- `README.md`

Validation gates:

- `cd apps/web; npm.cmd run build`
- Inspect built asset paths for `/llm-steering/`.
- GitHub Actions Pages deploy succeeds.
- Public URL loads without API.
- `#docs/<doc_id>/<section_id>` links open the selected document and scroll to the section.

Stop conditions:

- If the single workbench app becomes too complex for static and local modes, split into a static marketing/learning site and a local workbench app inside the same Vite project.

### Phase 4: Workbench UX Refactor

Objective: make the advanced local app feel like a serious experiment console.

Deliverables:

- Explicit Beginner/Advanced mode switch or top-level route.
- Workbench first screen remains operational, not a landing page.
- Stronger run lifecycle:
  - idle
  - validating
  - building vector
  - generating baseline
  - generating steered output
  - saving artifact
  - failed with actionable message
- Run history panel.
- Copy/download buttons for outputs and artifacts. Implemented for rendered/raw output copy, Markdown downloads, result JSON, and vector metadata JSON.
- Sweep planning/execution UI with grid preview, aggregate metrics, and manifest export.
- Per-run interpretation panel explaining what changed and what did not.
- Responsive review across desktop and mobile.

Likely files:

- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/lib/api.ts`
- `apps/web/src/lib/types.ts`
- `apps/web/src/lib/presets.ts`

Validation gates:

- `npm.cmd run build`
- Manual smoke with API unavailable: static/fallback mode works.
- Manual smoke with API available: model registry/docs endpoints load.
- No text overlap at common desktop and mobile widths.

Exit criteria:

- A new user can identify what to do next from the first screen.
- Unsupported models are visible but cannot be run as steering-ready.
- Long generated Markdown remains readable.

### Phase 5: Experiment Reproducibility And Metrics

Objective: make every serious run auditable and comparable.

Deliverables:

- Reproduction artifact schema version.
- Run manifest with:
  - model id
  - model source/local path
  - method
  - prompts
  - prompt pairs
  - layer
  - coefficient
  - hook stage
  - token scope
  - decoding settings
  - timestamps
  - vector diagnostics
  - output metrics
  - environment summary
- Prompt-only control run support. Implemented in API/script artifacts and the workbench comparison UI.
- Coefficient/layer sweep execution, not only planning. Implemented in backend, API, and CLI with versioned sweep manifests.
- Metrics table:
  - length delta
  - lexical overlap
  - sentiment/style proxy where appropriate
  - refusal/safety proxy where appropriate
  - user-defined rubric placeholder
- Artifact export from UI.

Likely files:

- `src/llm_steering/experiments.py`
- `src/llm_steering/metrics.py`
- `src/llm_steering/api.py`
- `src/llm_steering/artifacts.py`
- `tests/test_api.py`
- `tests/test_metrics.py`
- `apps/web/src/lib/types.ts`

Validation gates:

- Unit tests for schema and metrics.
- API tests for artifact readback.
- API and CLI tests for sweep planning/execution contracts.
- One local Gemma run exports a valid artifact when model weights are present.
- No-model tests still pass in CI.

Exit criteria:

- A run can be reproduced or rejected based on its artifact alone.
- Static showcase artifacts map cleanly to the schema.

### Phase 6: Model Adapter Validation Framework

Objective: make model support claims mechanically gated.

Deliverables:

- Adapter interface:
  - load
  - format prompt
  - expose hidden states
  - locate layers
  - attach pre-hook
  - attach post-hook
  - run generation
- Hook smoke-test endpoint/CLI.
- Implemented as `llm-steering hook-smoke`, `POST /api/models/hook-smoke`, and a workbench model-rail report; no-load reports are safe for CI, and `--load-model` runs pre/post probes across `last_token` and `all_tokens`.
- Model validation report artifact.
- Support promotion checklist.
- Initial validation target order:
  1. `google/gemma-4-E4B-it`
  2. `google/gemma-4-12B-it`
  3. `microsoft/Phi-4-mini-instruct`
  4. `mistralai/Ministral-3-3B-Instruct-2512`
  5. Qwen3.6 served/local paths
  6. DiffusionGemma generation-only adapter research

Likely files:

- `src/llm_steering/model_registry.py`
- `src/llm_steering/introspection.py`
- `src/llm_steering/hf_runtime.py`
- `src/llm_steering/adapters/`
- `tests/test_introspection.py`
- `tests/test_model_registry.py`

Validation gates for promoting a model:

- Runtime load succeeds.
- Prompt formatting is verified.
- Hidden states are returned.
- Transformer layer discovery succeeds.
- Pre-hook smoke test passes.
- Post-hook smoke test passes.
- Live hook smoke report passes for both `last_token` and `all_tokens` scopes.
- Short baseline-vs-steered artifact exports.
- README and UI support matrix are updated.

Stop conditions:

- Served-only runtimes that do not expose internal activations must not be labeled steering-ready.
- DiffusionGemma must remain generation-only until diffusion-phase intervention is explicitly implemented and validated.

### Phase 7: Research And Curriculum Expansion

Objective: turn the repo into a credible learning resource, not just an app.

Deliverables:

- `docs/lessons/01_transformers.md`
- `docs/lessons/02_prompt_steering.md`
- `docs/lessons/03_activation_steering.md`
- `docs/lessons/04_actadd.md`
- `docs/lessons/05_caa.md`
- `docs/lessons/06_evaluation.md`
- `docs/lessons/07_advanced_methods.md`
- Research source index with stable citations and "claim -> source -> repo implementation" mapping.
- Public glossary.
- Diagrams for residual stream, hook stage, token scope, and coefficient sweeps.

Likely files:

- `docs/lessons/`
- `docs/glossary.md`
- `research/verified_sources.json`
- `src/llm_steering/docs_index.py`
- `apps/web/src/lib/lessons.ts`
- `apps/web/src/lib/markdown.tsx`

Validation gates:

- Docs index tests fetch every lesson.
- Docs index tests require every indexed document to expose section metadata.
- Static site renders every lesson and research note included in the API docs index.
- No unsupported claim lacks a source or caveat.

Exit criteria:

- A beginner can go from "what is a transformer layer?" to "what does this steering run change?" inside the repo.

### Phase 8: Release Automation And Portfolio Polish

Objective: prepare the repo for public sharing and recurring maintenance.

Deliverables:

- Expanded CI:
  - Python tests
  - frontend build
  - Pages build asset-base validation
  - docs link/path check
  - JSON artifact schema validation
  - optional no-model CLI smoke
- GitHub Pages deployment.
- Release checklist.
- Issue templates.
- PR template.
- Badges in README.
- Versioning and changelog.
- Optional PyPI readiness assessment.

Likely files:

- `.github/workflows/ci.yml`
- `.github/workflows/pages.yml`
- `.github/ISSUE_TEMPLATE/`
- `.github/pull_request_template.md`
- `CHANGELOG.md`
- `README.md`
- `CITATION.cff`

Validation gates:

- CI passes on branch.
- Pages deploy passes.
- Fresh clone instructions tested in a clean environment.
- README quick start matches actual commands.

Exit criteria:

- The public repo can be pinned as a portfolio project without needing private explanation from the maintainer.

## 9. Method Support Roadmap

### Implemented/Retained

- ActAdd single-pair steering.
- Mean-difference steering vectors.
- Pre-activation and post-activation hooks.
- Last-token and all-token application.
- Local docs and research archive.
- Static showcase artifacts.

### Near-Term

- Prompt-only control baseline. Implemented for experiment artifacts and the workbench.
- Executed layer/coefficient sweeps. Implemented in backend, API, CLI, and the workbench sweep panel.
- Artifact schema validation.
- No-model toy mode.
- Model hook smoke tests. CLI/API report path implemented; per-model live evidence is still required before promotions.
- Better output metrics.

### Later

- CAA workflow with dataset management.
- Activation patching diagnostics.
- SEA prototype after CAA and sweeps are stable.
- SAE-guided exploration if a compatible open SAE/model pair is selected.
- Conditional activation steering once simple steering is measurable.

## 10. GitHub Pages Specification

The public Pages site should be generated from `apps/web`.

Required behavior:

- Works at `https://smgpulse007.github.io/llm-steering/`.
- Does not require FastAPI.
- Shows static demo artifacts when API is absent.
- Links to local advanced setup.
- Makes model support states obvious.

Implementation notes:

- Vite project-site deploys require `base: "/llm-steering/"`.
- Use GitHub Actions Pages source.
- Keep local dev proxy for `/api`.
- After deployment, set the GitHub repository homepage URL.

## 11. Quality Gates

Minimum gate before calling the productized release ready:

```powershell
git status --short --branch
.\.venv\Scripts\python.exe -m pytest -q
cd apps/web
npm.cmd run build
```

Additional release gates:

```powershell
python -m json.tool research\verified_sources.json
python -m json.tool docs\showcase\pre_post_showcase.json
python -m json.tool docs\showcase\use_case_showcase.json
python -m json.tool docs\showcase\ollama_vs_hf_baseline.json
```

Future gates:

- `llm-steering verify --no-model`
- `llm-steering demo --toy`
- `llm-steering artifacts validate`
- `llm-steering validate-model google/gemma-4-E2B-it`
- `llm-steering export-site-check`

## 12. Open Decisions

1. Should the public site and local workbench remain one Vite app, or should the static learning site be split from the local workbench route?
2. Should Python support remain `>=3.13`, or should the public install target support Python 3.11/3.12 for broader ML dependency compatibility?
3. Should package management stay `pip`-first, or should `uv` become the recommended fast path?
4. Should the project pursue PyPI packaging now, or wait until the CLI and dependency extras are cleaner?
5. What is the first non-Gemma model that should be validated end to end?
6. Should beginner lessons be plain Markdown, structured JSON/MDX, or both?
7. Should the public site include interactive toy mode in-browser, or only static visuals plus local toy CLI?

## 13. Implementation Order

Recommended order:

1. Finish Phase 0 docs and audit.
2. Implement Phase 1 CLI/setup hardening.
3. Implement Phase 2 no-model beginner mode.
4. Implement Phase 3 GitHub Pages.
5. Refactor Phase 4 workbench UX around the new beginner/advanced model.
6. Implement Phase 5 reproducibility upgrades.
7. Implement Phase 6 model validation framework.
8. Expand Phase 7 curriculum and advanced methods.
9. Finish Phase 8 release automation.

This order creates public value early without blocking on large model downloads or advanced research uncertainty.

## 14. Source Backbone

Use these as the first-pass source backbone for research and product claims:

- ActAdd: https://arxiv.org/abs/2308.10248
- CAA: https://aclanthology.org/2024.acl-long.828/
- Representation Engineering: https://arxiv.org/abs/2310.01405
- SEA: https://arxiv.org/abs/2405.09719
- IBM activation-steering: https://github.com/ibm/activation-steering
- TransformerLens: https://github.com/TransformerLensOrg/TransformerLens
- Gemma 4 model card: https://ai.google.dev/gemma/docs/core/model_card_4
- DiffusionGemma model card: https://huggingface.co/google/diffusiongemma-26B-A4B-it
- Qwen3.6 repo: https://github.com/QwenLM/Qwen3.6
- Vite static deploy: https://vite.dev/guide/static-deploy
