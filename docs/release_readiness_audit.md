# llm-steering Release Readiness Audit

Status: implementation audit after P0 productization slice  
Date: 2026-07-05  
Branch: `codex/open-source-productization-plan`  

## Summary

`llm-steering` has moved from a script-first local starter kit toward a productized open source release. The branch now adds an installed CLI, no-model toy onboarding, beginner lessons, structural showcase validation, expanded CI, GitHub Pages workflow scaffolding, issue/PR templates, and a static learning surface inside the React app. Remaining gaps are mainly GitHub-side deployment verification, dependency-extra splitting, deeper experiment reproducibility, and model-validation automation.

## Verified Current State

Repository:

- Remote: `https://github.com/smgpulse007/llm-steering.git`
- Public repo: yes
- Default branch: `main`
- GitHub Pages: not enabled as of this audit
- Current branch for this work: `codex/open-source-productization-plan`

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
| Python package | Improved | Medium | Editable install works locally and now exposes `llm-steering`; dependency extras are still not split. |
| CLI | Good baseline | Medium | Product CLI now covers verify, toy demo, API serving, showcase validation/build, and model registry validation. |
| API | Good baseline | Medium | FastAPI layer exists, but request schemas and lifecycle states need hardening. |
| UI workbench | Improved | Medium | Functional local workbench now has a static learning home for Pages and local-only run gating. |
| Beginner education | Good baseline | Medium | Beginner lessons and a no-model toy demo exist; in-browser toy simulation remains later work. |
| Research grounding | Good | Low | Research notes exist; claims need tighter source-to-feature mapping. |
| GitHub Pages | Workflow ready | Medium | Pages workflow and Pages build exist; live deployment still must be verified after push. |
| CI | Improved | Medium | Python tests, no-model CLI smoke, showcase validation, and frontend build are configured. |
| Model support gating | Good baseline | Medium | Registry gates unsupported models; hook smoke-test automation is missing. |
| Reproducibility | Partial | Medium | JSON artifacts exist; schema/versioning/run manifests need hardening. |
| Portfolio readiness | Improved | Medium | README has badges, public URL, no-model path, and local workbench path; live Pages verification remains. |

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
   - Why: current install pulls heavy ML/notebook/API dependencies together.
   - Status: partially implemented.
   - Evidence: README has no-model and advanced local paths; dependency extras remain future work.

### P1: Should Fix For Strong Release

1. Add artifact schema versioning and validation.
2. Add prompt-only baseline/control runs.
3. Add real sweep execution and sweep artifacts.
4. Add download/copy buttons in the UI.
5. Add hook smoke-test CLI/API.
6. Add docs path tests for future lesson files.
7. Add issue templates and PR template.
8. Add changelog and release checklist.

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
- Needs a shorter quick-start path.
- Needs public site link once Pages is live.
- Needs "no GPU/no model" path.
- Needs clearer install variants.

### `pyproject.toml`

Strengths:

- Modern setuptools config.
- Package metadata exists.
- Dev extra exists.

Gaps:

- `requires-python = ">=3.13"` may be too narrow for open source ML users.
- Heavy dependencies are all mandatory.
- No console scripts.
- No separate API/notebook/GPU extras.

### `.github/workflows/ci.yml`

Strengths:

- Python 3.13 CI exists.
- Editable install and tests run.

Gaps:

- No frontend build.
- No Node dependency cache.
- No docs/artifact JSON validation.
- No Pages deploy.

### `apps/web`

Strengths:

- Functional Vite/React app.
- Model registry fallback.
- API client exists.
- Markdown rendering and safe diff logic exist.

Gaps:

- Static public mode is not formalized.
- No Pages base path.
- Large Markdown chunk warning.
- Run lifecycle is still too coarse.
- Beginner learning path is not first-class.

### `src/llm_steering/api.py`

Strengths:

- Core routes exist.
- Unsupported models are gated.
- Local docs can be served.

Gaps:

- Schemas are plain dicts rather than full Pydantic models.
- Sweep route only plans.
- Hook smoke-test endpoint is missing.
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
5. Add artifact schema versioning and prompt-only control runs.

The completed slice creates visible product value without waiting on model downloads or advanced research.
