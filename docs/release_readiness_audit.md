# llm-steering Release Readiness Audit

Status: implementation audit after P0 productization slice  
Date: 2026-07-05  
Branch: `codex/open-source-productization-plan`  

## Summary

`llm-steering` has moved from a script-first local starter kit toward a productized open source release. The branch now adds an installed CLI, no-model toy onboarding, beginner lessons, structural showcase validation, expanded CI, GitHub Pages workflow scaffolding, issue/PR templates, and a static learning surface inside the React app. Later docs-first passes added a public docs reader, hashable docs and section links, bundled Pages media, split Python dependency extras, and prompt-only comparison controls. Remaining gaps are mainly deeper experiment reproducibility and model-validation automation.

## Verified Current State

Repository:

- Remote: `https://github.com/smgpulse007/llm-steering.git`
- Public repo: yes
- Default branch: `main`
- GitHub Pages: enabled after the productization merge
- Current branch for this follow-up work: `codex/docs-first-pages`

Local validation:

- `.venv` Python: 3.13.1
- Python tests: 34 passed
- Frontend production build: passed
- Pages production build with `/llm-steering/` base: passed
- No-model CLI verification: passed
- Toy demo CLI: passed
- Structural showcase/source JSON validation: passed
- Frontend build warning: `markdown` chunk exceeds 500 kB after minification

Tracked hygiene:

- `apps/web/node_modules`, `apps/web/dist`, `__pycache__`, and egg-info artifacts are ignored and not tracked.
- `.env` is ignored; `.env.example` is tracked.
- `models/hf`, `vectors`, and `results` keep only `.gitkeep` tracked.

## Readiness Scorecard

| Area | Current Status | Release Risk | Notes |
| --- | --- | --- | --- |
| Python package | Improved | Medium | Editable base install exposes `llm-steering`; heavy HF/API/media/notebook dependencies are split into extras. |
| CLI | Strong baseline | Medium | Product CLI now covers verify, toy demo, API serving, sweep plan/run, showcase validation/build, artifact validation, and model registry validation. |
| API | Good baseline | Medium | FastAPI layer exists, but request schemas and lifecycle states need hardening. |
| UI workbench | Improved | Medium | Functional local workbench now has a docs-first Pages surface, local-only run gating, and sweep controls. |
| Beginner education | Good baseline | Medium | Beginner lessons and a no-model toy demo exist; in-browser toy simulation remains later work. |
| Research grounding | Good | Low | Research notes exist; claims need tighter source-to-feature mapping. |
| GitHub Pages | Live baseline | Medium | Pages workflow and Pages build exist; live deployment was verified on `main`; this branch keeps Pages deployment scoped to `main`. |
| CI | Improved | Medium | Python tests, no-model CLI smoke, showcase validation, and frontend build are configured. |
| Model support gating | Improved | Medium | Registry gates unsupported models, and hook smoke-test CLI/API/workbench reports now exist; live model promotion still needs per-model evidence. |
| Reproducibility | Improved | Medium | JSON artifacts now carry schema/version metadata, prompt-only controls, comparison deltas, sweep manifests, and CLI/API validation; richer metrics still need hardening. |
| Portfolio readiness | Improved | Medium | README has badges, public URL, no-model path, local workbench path, and a docs-first Pages surface. |

## Gap Backlog

### P0: Must Fix Before Public Product Claim

1. Add no-model beginner path.
   - Why: a public user should learn something without gated model access or GPU hardware.
   - Status: implemented on this branch.
   - Evidence: `llm-steering demo --toy --json` emits a `synthetic_no_model` payload.

2. Add GitHub Pages deployment.
   - Why: the portfolio project needs a public interactive/educational surface.
   - Status: workflow and static site implemented; live deployment pending push/actions verification.
   - Done when: `https://smgpulse007.github.io/llm-steering/` loads and uses static artifacts without API.

3. Expand CI to include frontend build.
   - Why: the public workbench can break while Python tests stay green.
   - Status: implemented in `.github/workflows/ci.yml`.
   - Evidence: CI now runs `npm ci` and `npm run build` under `apps/web`.

4. Add product CLI.
   - Why: scripts are fine for maintainers, but open source users need discoverable commands.
   - Status: implemented.
   - Evidence: tests cover help, verify, toy demo, and showcase validation.

5. Clarify dependency/install matrix.
   - Why: public users should not install the full ML/notebook/API stack to run the tutorial path.
   - Status: implemented in follow-up branch.
   - Evidence: base install is dependency-light; `config`, `hf`, `api`, `media`, `notebooks`, and `dev` extras split heavier paths.

### P1: Should Fix For Strong Release

1. Add real sweep execution and sweep artifacts.
   - Status: implemented in backend, API, CLI, and workbench UI.
   - Evidence: `run_sweep()` writes versioned sweep manifests, `POST /api/experiments/sweep/run` executes a grid, `llm-steering sweep` can plan or run a JSON request, and the console exposes a layer/coefficient sweep panel with manifest export.
2. Add download/copy buttons in the UI.
   - Status: implemented for output panes and artifact rail.
   - Evidence: baseline, prompt-only, and steered panes expose rendered/raw copy plus Markdown download; the artifact rail exposes result JSON and vector metadata copy/download actions.
3. Add hook smoke-test CLI/API.
   - Status: implemented.
   - Evidence: `llm-steering hook-smoke` emits a no-load registry report by default, `--load-model` runs live pre/post hook probes across token scopes, `POST /api/models/hook-smoke` exposes the same report contract, and the workbench model rail can display the report.
4. Add docs path tests for future lesson files.
   - Status: implemented for indexed docs and section outlines.
   - Evidence: API tests fetch every indexed doc and require non-empty extracted sections.
5. Add issue templates and PR template.
6. Add changelog and release checklist.

Completed follow-up:

- Prompt-only baseline/control runs are now included in API/script experiment artifacts and the workbench comparison UI.
- Local docs now expose table-of-contents metadata, search/filter affordances, and hashable section links in the API and static Pages fallback.
- Output and artifact copy/download actions are available in the workbench UI.
- Layer/coefficient sweeps can execute through the backend/API/CLI/workbench and produce versioned sweep manifests.
- Hook smoke-test reports are available through the CLI, API, and workbench model rail.

### P2: Later Differentiators

1. CAA dataset workflow.
2. Activation patching diagnostics.
3. SEA prototype.
4. SAE-guided steering exploration.
5. Conditional activation steering.
6. In-browser toy simulation.
7. Model adapter plugins.

## File-Level Observations

### `README.md`

Strengths:

- Strong thesis.
- Honest limitations.
- Useful public demo artifacts.
- Clear support matrix.

Gaps:

- Too much is packed into one long README.
- Needs continued pruning into a dedicated docs site over time.
- Has public site link, no GPU/no model path, and clearer install variants.

### `pyproject.toml`

Strengths:

- Modern setuptools config.
- Package metadata exists.
- Dev extra exists.

Gaps:

- `requires-python = ">=3.13"` may be too narrow for open source ML users.

Current strengths:

- Console script exists.
- API/HF/media/notebook/dev extras exist.

### `.github/workflows/ci.yml`

Strengths:

- Python 3.13 CI exists.
- Editable install and tests run.

Gaps:

- No live hook smoke-test CI job for supported model adapters because CI does not have model weights.

### `apps/web`

Strengths:

- Functional Vite/React app.
- Model registry fallback.
- API client exists.
- Markdown rendering and safe diff logic exist.
- Public docs reader has document groups, search/filter, an in-document outline, and stable section links.
- Static Pages mode bundles the same docs inventory as the local API for public browsing.
- Output panes and artifact rail include copy/download actions for review handoff.

Gaps:

- Large Markdown chunk warning.
- Run lifecycle is still too coarse.
- Sweep result interpretation is still mostly metric/table based.

### `src/llm_steering/api.py`

Strengths:

- Core routes exist.
- Unsupported models are gated.
- Local docs can be served.
- Sweep execution route writes versioned manifests.
- Hook smoke-test route returns registry-only or loaded-model validation reports.

Gaps:

- Schemas are plain dicts rather than full Pydantic models.
- No Pydantic response model yet for hook smoke-test reports.
- Error payloads are not yet product-level.

### `src/llm_steering/model_registry.py`

Strengths:

- Model support state is explicit.
- Unsupported/experimental models are visible but gated.

Gaps:

- Registry claims need periodic refresh as model cards evolve.
- Promotion workflow is manual.
- No validation report artifact per model.

### `research`

Strengths:

- High-signal archive exists.
- Primary research and model docs are represented.

Gaps:

- Need a claim/source/implementation map.
- Need beginner-friendly summaries separate from research notes.
- Need source refresh policy.

## Suggested Milestone Packaging

### Milestone 1: Installable Starter Kit

Scope:

- CLI.
- Install matrix.
- CI frontend build.
- No-model verification.

Exit:

- Fresh clone can run a toy demo and tests.

### Milestone 2: Public Learning Site

Scope:

- GitHub Pages.
- Beginner lessons.
- Static showcase mode.

Exit:

- Public URL teaches activation steering without local setup.

### Milestone 3: Advanced Experiment Console

Scope:

- Workbench UX refactor.
- Run lifecycle.
- Artifact downloads.
- Prompt-only controls.
- Sweep execution.

Exit:

- Local users can run and export serious experiments.

### Milestone 4: Model Validation Program

Scope:

- Adapter interface.
- Hook smoke tests.
- Validation reports.
- First non-E2B target validation.

Exit:

- Model support promotions are evidence-backed.

### Milestone 5: Research Expansion

Scope:

- CAA workflow.
- Evaluation metrics.
- Activation patching.
- SEA/SAE research spikes.

Exit:

- Repo becomes a credible baseline for advanced steering experimentation.

## Acceptance Criteria For "Portfolio Ready"

The project can be called portfolio ready when:

- Public Pages site is live.
- README links to Pages and has a short verified quick start.
- Fresh clone can run no-model tutorial.
- CI passes Python and frontend build.
- Local advanced path can launch API and UI.
- At least one real model remains verified with reproducible artifacts.
- Unsupported models stay visibly gated.
- Limitations are explicit in README, site, and UI.
- Repo topics and homepage URL are updated.

## Acceptance Criteria For "Open Source Product Ready"

The project can be called open source product ready when:

- CLI is stable and documented.
- Dependency extras are clear.
- Artifact schemas are versioned.
- Sweep execution is implemented.
- Model validation reports exist.
- Beginner curriculum is complete.
- Release checklist and changelog exist.
- A clean-environment install test has been performed and documented.

## Immediate Next Implementation Slice

Recommended next slice after this branch lands:

1. Verify GitHub Actions and Pages deployment after push.
2. Set repository homepage to `https://smgpulse007.github.io/llm-steering/`.
3. Decide whether to merge the branch into `main` immediately or open a review PR first.
4. Split dependency extras only after a lazy-import pass across config/API/model modules.
5. Add prompt-only control runs.

The completed slice creates visible product value without waiting on model downloads or advanced research.
