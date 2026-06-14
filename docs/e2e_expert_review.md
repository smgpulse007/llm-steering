# E2E Expert Review Notes

This note captures the two specialist review passes performed during the workbench hardening pass. It is intended for the next Codex agent or maintainer who continues the open-source release work.

## Review Scope

- UI and interaction review of the React workbench.
- Backend and E2E contract review of the FastAPI experiment flow.
- Model-readiness review for steering support claims.
- Documentation and handoff review for public release prep.

## UI Review Findings

### High: long-response diff could freeze the browser

The first word-level diff implementation used an LCS table directly against both outputs. That is acceptable for small examples but risky for long generations because the work grows with `left_tokens * right_tokens`.

Resolution:

- `apps/web/src/lib/diff.tsx` now exposes `safeDiffTokens`.
- Diff generation is capped by token count and cell count.
- When an output is too long, the UI skips the diff and keeps the rendered Markdown panes visible.

Remaining work:

- Move diffing to a Web Worker if very long generated outputs become a core workflow.
- Consider line-first diffing before token diffing.

### Medium: model output was not rendered like an LLM tool

The earlier output panes rendered raw Markdown as text, which made headings, lists, tables, code blocks, and generated email structure hard to read.

Resolution:

- `apps/web/src/lib/markdown.tsx` now uses `react-markdown`.
- GFM, tables, math, KaTeX, and syntax highlighting are enabled.
- Output panes show rendered Markdown first.
- Automatic diff is a secondary expandable panel instead of replacing the answer.

Remaining work:

- Add copy buttons for rendered and raw output.
- Add optional source/raw tab per pane.

### Medium: model picker/cards were layout fragile

Long model names and support badges could force horizontal scrolling and janky wrapping.

Resolution:

- Model rows use constrained grid layout.
- Long model names wrap with `overflow-wrap: anywhere`.
- Descriptions are line-clamped.
- Horizontal overflow is disabled in the model list.

Remaining work:

- Add virtualization if the model registry grows beyond a few dozen entries.
- Add search/filter controls for larger registries.

### Medium: explainability was too shallow for a starter kit

The earlier side panel explained only the basic equation. It did not teach the controls, render local research docs, or separate practical work from learning material.

Resolution:

- Explainability now has sub-tabs:
  - Math & Architecture
  - Control Knobs
  - Local Docs
  - Model Roadmap
- Every major config knob has a plain-language explanation, implementation detail, and tuning note.
- Local docs are served through the API and rendered with the same Markdown renderer as model output.

Remaining work:

- Add interactive diagrams for token scope and pre/post hook placement.
- Add per-run interpretation that explains the observed output delta.

## Backend and E2E Review Findings

### High: steering readiness gating was inconsistent

Vector build was stricter than experiment run. Some `needs_validation` models could reach `/api/experiments/run` even though they were not supported for steering.

Resolution:

- `src/llm_steering/experiments.py` now centralizes support gating with `require_steering_ready`.
- Both vector build and experiment run use the same readiness check.
- API routes map steering-readiness failures to HTTP 409.
- Tests assert unsupported models are blocked.

Remaining work:

- Add a real hook smoke-test endpoint before promoting any model to supported.

### Medium: request validation was too loose

Invalid hook stages or token scopes could enter deeper runtime code.

Resolution:

- `request_from_mapping` now validates `hook_stage` and `apply_to`.
- API routes map invalid request values to HTTP 400.

Remaining work:

- Move request validation fully into typed Pydantic schemas.

### Medium: artifact flow was partial

The UI showed artifact paths, but did not fetch the stored JSON result directly.

Resolution:

- Frontend API client includes `fetchExperiment`.
- Console rail can fetch and display the saved JSON artifact for the current experiment.
- Backend tests cover experiment artifact readback.

Remaining work:

- Add download buttons for JSON and vector metadata.
- Add vector metadata sidecar if tensor files are emitted.

### Medium: local docs could silently drift

Explainability docs were useful only if every indexed path exists and can be served.

Resolution:

- `src/llm_steering/docs_index.py` centralizes the local docs index.
- API exposes `GET /api/docs` and `GET /api/docs/{doc_id}`.
- Tests verify every indexed local doc can be fetched.

Remaining work:

- Add table-of-contents extraction for long docs.
- Add deep links to sections.

## Model Support Guidance

Supported today:

- `google/gemma-4-E2B-it`

Near-term validation targets:

- `google/gemma-4-E4B-it`
- `google/gemma-4-12B-it`
- `microsoft/Phi-4-mini-instruct`
- `mistralai/Ministral-3-3B-Instruct-2512`

Research and adapter targets:

- `google/diffusiongemma-26B-A4B-it`
- `Qwen/Qwen3.6-27B`
- `Qwen/Qwen3.6-35B-A3B`
- `Qwen/Qwen3-Coder-Next`
- `meta-llama/Llama-4-Scout-17B-16E-Instruct`

Do not promote a model to supported until these checks pass:

1. Runtime load succeeds.
2. Prompt formatting is verified.
3. Hidden states are available.
4. Transformer block discovery succeeds.
5. Pre and post hook smoke tests pass.
6. A short baseline vs steered experiment exports artifacts.
7. README and UI support matrix are updated.

## Verification Performed

Commands run after the hardening pass:

```powershell
cd apps/web
npm.cmd run build
```

Result: TypeScript and Vite production build passed.

```powershell
.\.venv\Scripts\python.exe -m pytest -p no:cacheprovider --basetemp .tmp\pytest-final-ui-b
```

Result: 23 tests passed.

```powershell
python -m json.tool research\verified_sources.json
```

Result: source registry JSON parsed successfully.

