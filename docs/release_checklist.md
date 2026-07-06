# llm-steering Release Checklist

Use this checklist before merging a productization branch, cutting a GitHub release, or calling the repo portfolio-ready.

## 1. Branch Hygiene

- [ ] `git status --short --branch` shows the intended branch and no accidental generated files.
- [ ] `apps/web/dist`, `apps/web/node_modules`, `__pycache__`, egg-info, `.env`, `models/hf`, `vectors`, and `results` remain untracked except for intentional `.gitkeep` files.
- [ ] User-facing changes are reflected in `README.md`, `docs/productization_spec.md`, `docs/release_readiness_audit.md`, and `CHANGELOG.md` when applicable.
- [ ] Model support claims remain gated; unsupported or generation-only models are not presented as steering-ready.

## 2. Python And CLI Gates

Run from the repository root:

```powershell
.\.venv\Scripts\python.exe --version
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe -m llm_steering.cli verify --no-model
.\.venv\Scripts\python.exe -m llm_steering.cli demo --toy --json
.\.venv\Scripts\python.exe -m llm_steering.cli showcase validate
.\.venv\Scripts\python.exe -m llm_steering.cli artifacts validate docs\showcase\pre_post_showcase.json docs\showcase\use_case_showcase.json docs\showcase\ollama_vs_hf_baseline.json
.\.venv\Scripts\python.exe -m llm_steering.cli validate-model google/gemma-4-E2B-it
```

Expected:

- [ ] Python version matches the supported release target.
- [ ] Tests pass.
- [ ] No-model verification and toy demo pass without Hugging Face auth, model weights, or GPU hardware.
- [ ] Showcase and artifact validation pass for checked-in public artifacts.
- [ ] Model registry validation passes and keeps unsupported models visibly gated.

## 3. Frontend And Pages Gates

Run:

```powershell
cd apps/web
npm ci
npm run build
npm run build:pages
cd ..\..
.\.venv\Scripts\python.exe scripts\validate_pages_build.py
```

Expected:

- [ ] Normal Vite build passes.
- [ ] Pages build uses the `/llm-steering/` base path.
- [ ] `scripts/validate_pages_build.py` confirms local JS/CSS assets are present, non-empty, and Pages-scoped.
- [ ] Any chunk-size warning is either fixed or explicitly tracked in `docs/release_readiness_audit.md`.

## 4. Local Pages Smoke

Run:

```powershell
cd apps/web
npm run preview:pages
```

Open `http://127.0.0.1:4173/llm-steering/` and verify:

- [ ] First viewport explains the project without requiring local setup.
- [ ] Guided path buttons open the intended docs and update the hash route.
- [ ] Docs search/filter works.
- [ ] Section outline links update `#docs/<doc_id>/<section_id>` and scroll to the section.
- [ ] Console tab clearly shows static/public mode and blocks real runs without the local API.
- [ ] Desktop and mobile widths have no horizontal overflow or nested mobile scroll traps.

## 5. Local Advanced Smoke

Run:

```powershell
llm-steering api
cd apps/web
npm run dev
```

Verify:

- [ ] `/api/models`, `/api/runtime`, and `/api/docs` load in the workbench.
- [ ] Unsupported and generation-only models remain visible but blocked from steering runs.
- [ ] Introspection and hook-smoke controls return local reports when the API is available.
- [ ] A supported-model run exports a result artifact when model weights are available.
- [ ] Sweep planning and execution produce versioned sweep manifests when model weights are available.

If model weights are not available, record that live model gates were skipped and do not promote any model support status.

## 6. Model Promotion Gate

Before changing a model to `supported`, attach evidence that:

- [ ] Runtime load succeeds.
- [ ] Prompt formatting is verified.
- [ ] Hidden states are returned.
- [ ] Transformer layer discovery succeeds.
- [ ] Pre-hook smoke test passes.
- [ ] Post-hook smoke test passes.
- [ ] Loaded hook smoke passes for `last_token` and `all_tokens`.
- [ ] A short baseline-vs-steered artifact is exported and validated.
- [ ] README, UI support matrix, and registry notes point to the validation evidence.

## 7. GitHub Release Gate

After pushing the branch or merging to `main`:

- [ ] GitHub CI passes.
- [ ] GitHub Pages workflow passes.
- [ ] `https://smgpulse007.github.io/llm-steering/` loads in static mode.
- [ ] Repository homepage points to the Pages URL.
- [ ] Repo topics include activation steering, ActAdd, representation engineering, interpretability, and local LLMs where appropriate.
- [ ] `CHANGELOG.md` has an accurate `Unreleased` section or a dated release entry.
- [ ] GitHub release notes mention known limitations and any skipped model-validation gates.

## 8. Final Sign-Off

- [ ] No secrets, model weights, generated vectors, or private artifacts are tracked.
- [ ] Limitations are explicit in the README, Pages site, and support matrix.
- [ ] The branch can be reviewed from the PR template without private context from the maintainer.
- [ ] Remaining known gaps are carried in `docs/release_readiness_audit.md`.
