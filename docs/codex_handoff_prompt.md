# Codex Handoff Prompt: Full Steering UI Refactor and Model Expansion

You are continuing work in the `llm-steering` repository. Treat this as a full research-backed refactor and productization pass for an open-source activation-steering workbench.

## Mission

Build an end-to-end functional UI that lets a user manually select a model, construct or load steering vectors, tune steering parameters, compare baseline vs steered outputs, and understand what is happening mathematically and operationally.

The UI should use a shadcn-style design system with polished glass/iOS-style effects, but it must be a real workbench, not a landing page. Prioritize function, explainability, and experiment reproducibility.

## Required first steps

1. Read the repo before editing:
   - `README.md`
   - `docs/methodology.md`
   - `research/README.md`
   - `research/steering_vectors_literature_review.md`
   - `research/gemma4_runtime_notes.md`
   - `research/2026-06-14_diffusiongemma_qwen_ui_research_notes.md`
   - `src/llm_steering/hf_runtime.py`
   - `src/llm_steering/steering.py`
   - `src/llm_steering/config.py`
   - `scripts/run_actadd.py`
2. Search the web again before finalizing model claims. The current notes were verified on 2026-06-14, but public model pages can change.
3. Prefer official sources and primary sources:
   - Google DiffusionGemma launch post: https://blog.google/innovation-and-ai/technology/developers-tools/diffusion-gemma-faster-text-generation/
   - Google DiffusionGemma developer guide: https://developers.googleblog.com/en/diffusiongemma-the-developer-guide/
   - Google DiffusionGemma docs: https://ai.google.dev/gemma/docs/diffusiongemma
   - DiffusionGemma HF model: https://huggingface.co/google/diffusiongemma-26B-A4B-it
   - Qwen3.6 GitHub: https://github.com/QwenLM/Qwen3.6
   - Qwen3.6-27B HF model: https://huggingface.co/Qwen/Qwen3.6-27B
   - Qwen3.6-35B-A3B HF model: https://huggingface.co/Qwen/Qwen3.6-35B-A3B
   - Qwen3-Coder-Next HF model: https://huggingface.co/Qwen/Qwen3-Coder-Next
   - CAA paper: https://aclanthology.org/2024.acl-long.828.pdf
   - Steering reliability paper: https://arxiv.org/html/2505.22637v1
4. Use available MCP/plugin capabilities when useful:
   - Hugging Face connector for model metadata and repo details.
   - GitHub connector if creating PR-oriented summaries or inspecting remote issues.
   - Multi-agent/sub-agent tools if available for parallel UI review, model adapter review, or research verification.

## Existing implementation to preserve

The current repo already supports:

- `google/gemma-4-E2B-it` local HF path.
- Prompt-pair steering-vector extraction.
- Single-pair ActAdd vectors.
- Mean-difference vectors.
- Pre-activation and post-activation hooks.
- Token targeting with `last_token` and `all_tokens`.
- Baseline vs steered generation.
- JSON artifacts and public showcase assets.

Do not throw this away. Wrap it behind a cleaner model registry, experiment API, and UI.

## Target model support matrix

Implement a registry-driven model picker with explicit statuses:

| Model ID | Role | Required status handling |
| --- | --- | --- |
| `google/gemma-4-E2B-it` | Verified baseline | Supported |
| `google/gemma-4-E4B-it` | Next small Gemma | Needs validation |
| `google/gemma-4-12B-it` | Stronger Gemma | Needs hardware validation |
| `google/gemma-4-26B-it` | High-quality Gemma comparison | Needs serving validation |
| `google/diffusiongemma-26B-A4B-it` | Public DiffusionGemma target | Generation first; steering experimental |
| `Qwen/Qwen3.6-27B` | Current general Qwen target | Needs layer/hook validation |
| `Qwen/Qwen3.6-27B-FP8` | Practical Qwen serving target | Needs endpoint/runtime validation |
| `Qwen/Qwen3.6-35B-A3B` | Qwen MoE target | Needs MoE validation |
| `Qwen/Qwen3.6-35B-A3B-FP8` | Practical Qwen MoE serving target | Needs endpoint/runtime validation |
| `Qwen/Qwen3-Coder-Next` | Coding/agent steering target | Needs architecture-specific adapter |

The UI must not claim steering support for a model until introspection and a hook smoke test pass.

## Backend architecture

Add a Python API layer, preferably FastAPI, around the existing package. Keep the package importable and keep CLI workflows working.

Recommended modules:

- `src/llm_steering/model_registry.py`
- `src/llm_steering/introspection.py`
- `src/llm_steering/experiments.py`
- `src/llm_steering/metrics.py`
- `src/llm_steering/api.py`

Recommended endpoints:

- `GET /api/models`
- `POST /api/models/introspect`
- `POST /api/vectors/build`
- `POST /api/experiments/run`
- `POST /api/experiments/sweep`
- `GET /api/experiments/{id}`
- `GET /api/runtime/status`

Backend requirements:

- Return structured errors when a model is generation-only or hook-incompatible.
- Cache loaded models carefully; avoid loading multiple huge models accidentally.
- Save reproducible artifacts under `results/`.
- Save vector tensors and metadata under `vectors/`.
- Include CLI-equivalent commands in every experiment result.
- Add focused tests for registry, introspection, metrics, and API schemas.

## Steering and metrics requirements

Add support for stronger experiments:

- Single-pair ActAdd remains available.
- Multi-pair CAA-style mean-difference vectors become first-class.
- Layer sweep.
- Coefficient sweep.
- Hook-stage sweep: pre vs post.
- Token scope sweep: last token vs all tokens.
- Pairwise cosine agreement across prompt-pair diffs.
- Vector norm and normalized/un-normalized reporting.
- Positive/negative separability or a simple discriminability score along the mean-difference line.
- Off-target prompts for regression checks.

Surface these metrics in the UI and explain why they matter. The steering reliability research says coherent directions are more reliable; the UI should make that visible.

## DiffusionGemma requirements

Do not force DiffusionGemma into the causal-LM path blindly.

Implement support in stages:

1. Registry entry and documentation.
2. Generation-only mode if direct hidden-state steering is not validated.
3. Runtime introspection for model class, architecture, processor, generation kwargs, hidden-state support, and hookable layer paths.
4. Adapter research for diffusion-phase steering.

The UI should label DiffusionGemma clearly as experimental for steering because it uses block diffusion/parallel denoising rather than ordinary left-to-right token generation.

## Qwen requirements

Start with introspection and adapter work:

- Confirm processor/tokenizer formatting.
- Confirm hidden states are available.
- Confirm layer paths for `qwen3_5`, `qwen3_5_moe`, and `qwen3_next`.
- Add layer path candidates only after verifying model structure.
- Run a hook smoke test before enabling steering controls.
- Prefer endpoint/vLLM/SGLang mode for giant models if direct in-process loading is not practical.

## UI requirements

Create a real app workspace, for example `apps/web`, using:

- Vite
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- lucide-react

The first screen should be the steering console.

Required views/components:

- Model picker with support badges and runtime hints.
- Runtime status bar: device, dtype, loaded model, VRAM/memory, backend, queue state.
- Prompt-pair/vector builder.
- Dataset-style multi-pair editor.
- Steering controls: layer, coefficient, hook stage, token scope, normalize, decoding settings.
- Sweep builder for layers and coefficients.
- Baseline vs steered comparison panes.
- Explanation panel with math and plain-language interpretation.
- Metrics panel with vector norm, cosine agreement, separability, output deltas.
- Artifact drawer with result JSON, vector metadata, and CLI reproduction command.
- Logs panel for backend events and model warnings.

Visual design:

- shadcn-style component primitives.
- Glass/iOS-style translucent surfaces with subtle blur, hairline borders, and restrained highlights.
- Dense operational layout; no marketing hero.
- Use lucide icons for buttons where possible.
- Avoid nested cards.
- Use stable dimensions for panes, controls, tiles, and output areas.
- Make all text fit on desktop and mobile.
- Avoid a one-note purple/blue/cream/dark-slate palette. Use a balanced, professional color system.

## Explainability requirements

The UI should explain:

- What vector was built.
- Which layer and token scope were edited.
- Whether the hook is pre-activation or post-activation.
- What equation was applied.
- What changed between baseline and steered output.
- Why a metric suggests the vector is or is not reliable.
- Which claims are validated vs experimental.

Optional but valuable:

- Add a small evaluator mode that asks a smaller model or sub-agent to summarize before/after differences and flag possible confounds.
- Keep this labeled as an evaluator. Do not present it as proof.

## Acceptance criteria

The handoff is complete when:

- Existing tests still pass.
- New backend tests pass.
- A local dev server starts and the user gets a URL.
- The UI can run the verified Gemma 4 E2B path end to end.
- Unsupported models are visible but safely gated.
- The UI can export a reproducible experiment artifact.- Models can be swapped out and that is clearly demo'ded in the UI.
- README/research docs are updated with the support matrix and limitations.
- Public claims are backed by official/model-card/paper sources.- Commit and pushed to github after E2E validation using MCP servers playwright and gifs, and readme is updated, along with the terminal gifs.

## Engineering guardrails

- Keep changes scoped and additive where possible.
- Preserve CLI workflows.
- Do not commit model weights or generated heavy artifacts.
- Do not claim DiffusionGemma steering works until it is validated.
- Do not claim Qwen steering works until layer discovery and hook smoke tests pass.
- Keep the open-source release honest: visible changes are not automatically proof of robust causal control.
