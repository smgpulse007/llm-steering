# Steering Workbench Spec

This document defines the target behavior for the `llm-steering` workbench. It exists so the UI, API, and research docs can evolve without losing the core product contract.

## Product Shape

The workbench has two primary modes:

1. **Console** - practical steering execution.
2. **Explainability** - learning, math, architecture, local documentation, and model-readiness review.

The first screen should remain the Console. The app is a tool surface, not a landing page.

## Console Requirements

The Console must let a user:

- choose a model from a registry-backed list
- see whether that model is supported, validation-pending, generation-only, or experimental
- load preset use cases
- edit system prompt, user prompt, and prompt-pair dataset
- tune steering controls
- run an experiment through the API
- inspect baseline and steered outputs as rendered Markdown
- inspect automatic diff highlights without losing rendered Markdown
- view diagnostics, artifacts, and logs

### Model Picker

The model picker must avoid horizontal scrolling. Long model names, status badges, and role text must wrap inside the card. Cards should show:

- display name
- role
- support status
- concise runtime/steering notes for the selected model
- introspection action

Unsupported models are allowed to appear in the picker, but steering execution must stay gated until validation passes.

### Presets

Preset cards should load complete console state except the selected model ID. Required starter presets:

- customer support empathy
- tutor scaffolding
- product launch risk calibration
- code review precision

Each preset should include matched positive/negative prompt pairs, a user prompt, default layer, coefficient, hook stage, token scope, and decoding parameters.

### Output Rendering

Model responses must render like a normal Markdown preview:

- headings
- paragraphs
- lists
- numbered lists
- blockquotes
- inline code
- fenced code blocks
- tables
- bold/italic formatting

Diff highlighting must not replace the main rendered answer. It should be a secondary view or panel that helps compare the baseline and steered outputs.

## Control Knob Explanations

Each user-facing config knob must be explained in the Explainability view:

| Knob | Required explanation |
| --- | --- |
| Layer | What block receives the intervention and why middle layers are a common starting point |
| Coefficient | How vector magnitude is scaled and why sweeps matter |
| Hook stage | Difference between pre-activation and post-activation hooks |
| Token scope | Difference between last-token and all-token application |
| Normalize | Why unit vectors make coefficients comparable |
| Max tokens | How generation length affects qualitative review and runtime |
| Sampling controls | What temperature, top-p, and top-k do and when they matter |
| Prompt pairs | How positive/negative examples define the steering direction |

## Explainability Requirements

The Explainability section must have sub-tabs:

- **Math & Architecture** - equations, forward-pass flow, and current run summary.
- **Control Knobs** - plain-language and technical descriptions for each control.
- **Local Docs** - attached repo docs rendered through the app.
- **Model Roadmap** - model support candidates and readiness criteria.

### Local Docs

The UI should load local documentation through the API, not hardcoded browser file paths. Required docs:

- `docs/methodology.md`
- `research/steering_vectors_literature_review.md`
- `research/gemma4_runtime_notes.md`
- `research/2026-06-14_diffusiongemma_qwen_ui_research_notes.md`

The Markdown renderer used for model output should also render local docs.

## API Requirements

The API must expose:

- `GET /api/models`
- `POST /api/models/introspect`
- `GET /api/runtime/status`
- `GET /api/docs`
- `GET /api/docs/{doc_id}`
- `POST /api/vectors/build`
- `POST /api/experiments/run`
- `POST /api/experiments/sweep`
- `GET /api/experiments/{experiment_id}`

Experiment results must include:

- baseline text
- steered text
- vector diagnostics
- output delta metrics
- vector artifact path
- result artifact path
- reproduction command

## Model Support Roadmap

Support readiness means more than appearing in the picker. A model becomes supported only when:

1. It loads through a known backend.
2. Prompt formatting is confirmed.
3. Hidden states are available.
4. Transformer layer discovery succeeds.
5. A hook smoke test passes.
6. A short baseline vs steered experiment can export artifacts.
7. The README/support matrix reflects the exact validation state.

Recommended next targets:

1. `google/gemma-4-E4B-it`
2. `google/gemma-4-12B-it`
3. `microsoft/Phi-4-mini-instruct`
4. `mistralai/Ministral-3-3B-Instruct-2512`

Research/adapter targets:

- `google/diffusiongemma-26B-A4B-it`
- `Qwen/Qwen3.6-27B`
- `Qwen/Qwen3.6-35B-A3B`
- `Qwen/Qwen3-Coder-Next`
- `meta-llama/Llama-4-Scout-17B-16E-Instruct`

## Verification Gates

Before calling the workbench healthy:

- Python tests pass.
- Frontend TypeScript build passes.
- `/api/models` responds.
- `/api/docs` responds and can load methodology.
- UI dev server responds.
- A real Gemma 4 E2B experiment can run if local weights are present.
- Rendered Markdown output and diff panel are visible in the console.
- The Explainability docs tab can render local docs.
