# 2026-06-14 DiffusionGemma, Qwen, and Steering UI Research Notes

These notes were prepared as a handoff package for the next Codex agent. They extend the existing Gemma 4 activation-steering archive with the public DiffusionGemma release, current Qwen open model targets, and UI/refactor implications for a stronger open-source release.

## Current repo baseline

The repository is already a local-first activation-steering starter kit. It contains:

- Hugging Face runtime loading in `src/llm_steering/hf_runtime.py`.
- Hidden-state extraction, single-pair ActAdd, mean-difference vectors, pre-hooks, and post-hooks in `src/llm_steering/steering.py`.
- CLI experiments in `scripts/run_actadd.py`.
- Prompt-pair configs in `configs/prompt_pairs/`.
- Research archive and source manifest in `research/`.
- Public demo assets and methodology docs under `docs/`.

The current verified model path is `google/gemma-4-E2B-it`. The default steering loop assumes a conventional hidden-state-producing Hugging Face model where transformer layers can be found by `locate_transformer_layers()`.

## Source-backed model findings

### DiffusionGemma

Primary sources:

- Google launch post: https://blog.google/innovation-and-ai/technology/developers-tools/diffusion-gemma-faster-text-generation/
- Google developer guide: https://developers.googleblog.com/en/diffusiongemma-the-developer-guide/
- Google AI docs overview: https://ai.google.dev/gemma/docs/diffusiongemma
- Hugging Face model card: https://huggingface.co/google/diffusiongemma-26B-A4B-it

Verified facts as of 2026-06-14:

- Public model ID: `google/diffusiongemma-26B-A4B-it`.
- License: Apache 2.0 on Hugging Face.
- HF tags/class metadata from the Hugging Face MCP connector: task `image-text-to-text`, library `transformers`, architecture `diffusion_gemma`, model class `AutoModelForMultimodalLM`, about 25.8B parameters.
- Google positions it as an experimental open model built on the Gemma 4 backbone, with a 26B total MoE shape and about 3.8B active parameters during inference.
- It uses block diffusion/discrete diffusion rather than normal left-to-right autoregressive decoding.
- Google describes the key generation unit as a 256-token canvas/block that is refined in parallel, then committed for longer generations.
- Google reports up to 4x faster generation on dedicated GPUs in the intended low/medium batch local setting, but also says standard Gemma 4 remains recommended when maximum output quality is required.
- The model card reports long context up to 256K, multimodal inputs, function calling, coding/reasoning, and multilingual support.
- Official serving path includes vLLM with diffusion-specific overrides and a diffusion config, for example `--diffusion-config '{"canvas_length": 256}'` and entropy-bound sampler settings.

Implementation implications:

- Do not treat DiffusionGemma as just another `AutoModelForCausalLM` adapter.
- Hidden-state collection and intervention timing may differ because the model has prefill/incremental prefill phases and denoising phases.
- A first public UI can expose DiffusionGemma in "runtime exploration" mode even before steering hooks are fully validated.
- Full steering support should be gated behind introspection: layer discovery, hidden state availability, hook compatibility, and generation API compatibility.
- The UI should explain that DiffusionGemma is valuable for low-latency interactive workflows, but its steering math may need diffusion-phase-specific handling.

### Qwen latest open targets

Primary sources:

- Qwen3.6 GitHub repository: https://github.com/QwenLM/Qwen3.6
- Qwen3.6-27B model card: https://huggingface.co/Qwen/Qwen3.6-27B
- Qwen3.6-35B-A3B model card: https://huggingface.co/Qwen/Qwen3.6-35B-A3B
- Qwen3-Coder-Next model card: https://huggingface.co/Qwen/Qwen3-Coder-Next

Verified facts as of 2026-06-14:

- The latest general Qwen open series found in official sources is Qwen3.6.
- Hugging Face MCP found four Qwen3.6 repos: `Qwen/Qwen3.6-35B-A3B`, `Qwen/Qwen3.6-35B-A3B-FP8`, `Qwen/Qwen3.6-27B-FP8`, and `Qwen/Qwen3.6-27B`.
- `Qwen/Qwen3.6-27B` metadata: task `image-text-to-text`, library `transformers`, architecture `qwen3_5`, model class `AutoModelForMultimodalLM`, about 27.8B parameters, Apache 2.0.
- Qwen's model card recommends current serving engines and warns that Qwen3.6 has a default 262,144-token context window, with at least 128K recommended for preserving thinking capabilities where possible.
- `Qwen/Qwen3-Coder-Next` is not the latest general Qwen release, but it is a high-priority coding/agent steering candidate. HF metadata reports architecture `qwen3_next`, task `text-generation`, about 79.7B total parameters, Apache 2.0.
- Qwen3-Coder-Next uses a hybrid layout involving Gated DeltaNet, Gated Attention, and MoE blocks. It should not be assumed to match the simple decoder-layer paths used by Gemma.

Implementation implications:

- Add Qwen3.6 as a first-class model family in the model registry.
- Start Qwen steering with `Qwen/Qwen3.6-27B` if hardware allows. Prefer FP8 or remote/vLLM mode for practical UI demos when local VRAM is insufficient.
- Add `Qwen/Qwen3.6-35B-A3B` as a higher-priority MoE target for users with enough serving capacity.
- Treat `Qwen/Qwen3-Coder-Next` as an agentic/coding behavior target, not the default baseline for all steering demos.
- Extend layer discovery with introspection reports instead of hardcoding assumptions.

## Steering literature update

Primary added source:

- Understanding (Un)Reliability of Steering Vectors in Language Models: https://arxiv.org/html/2505.22637v1

Important takeaway:

- Steering vectors can work, but reliability depends on whether the target behavior is represented by a coherent direction.
- The paper reports that higher cosine similarity between training-set activation differences predicts better steering, and that better positive/negative separability along the difference-of-means line predicts better steering.
- The UI should therefore not present steering as magic. It should surface vector norm, pair agreement, cosine agreement, separability/discriminability, layer, coefficient, hook stage, and before/after deltas.

Existing source still central:

- CAA paper: https://aclanthology.org/2024.acl-long.828.pdf

Implementation implication:

- Upgrade the experiment path from one-off ActAdd to dataset-averaged vectors, prompt-pair agreement metrics, layer/coefficient sweeps, and off-target checks.

## UI product direction

Build a functional steering workbench, not a landing page.

Core workflow:

1. User manually chooses a model.
2. UI runs model capability introspection.
3. User chooses a steering behavior preset or creates a new prompt-pair/dataset.
4. UI extracts a vector or loads a cached vector.
5. User sweeps layer, coefficient, hook stage, token scope, generation settings, and runtime backend.
6. UI shows baseline vs steered output, vector diagnostics, metric deltas, and an explanation panel.
7. User exports the experiment as JSON plus a reproducible CLI command.

Design direction:

- shadcn-style controls, Tailwind, lucide icons, tight operational layout.
- Glass/iOS-style surface treatment: translucent panels, subtle blur, hairline borders, restrained highlights.
- Avoid a marketing hero. First viewport should be the actual model steering console.
- Dense, polished controls: model picker, runtime status, vector builder, tuning panel, comparison panes, explanation pane, logs/artifacts drawer.
- Use stable dimensions for controls and output panes so generated text and logs do not resize the entire workspace.
- Include clear safety/validity states: "unsupported", "introspection pending", "hook-compatible", "generation-only", "steering validated".

Recommended architecture:

- Backend: FastAPI or equivalent Python API wrapping existing `llm_steering` code.
- Frontend: Vite + React + TypeScript + Tailwind + shadcn/ui + lucide-react.
- Shared experiment schema: Pydantic models on the backend and generated/hand-maintained TypeScript types in the UI.
- Keep heavy model artifacts outside git; cache vectors under `vectors/` and results under `results/`.

High-value backend endpoints:

- `GET /api/models`: registry entries and support status.
- `POST /api/models/introspect`: layer paths, hidden-state shape, generation class, hook compatibility, VRAM warning.
- `POST /api/vectors/build`: build ActAdd or mean-difference vector.
- `POST /api/experiments/run`: baseline plus steered generation.
- `POST /api/experiments/sweep`: layer/coefficient/hook/token-scope sweep.
- `GET /api/experiments/{id}`: result artifact.
- `GET /api/runtime/status`: CUDA, torch dtype, loaded model, memory, queue state.

Explainability panel requirements:

- Plain-language summary: what changed and where the vector was injected.
- Math panel: `v = mean(h_positive - h_negative)`, optional normalization, `h' = h + alpha * v`.
- Reliability diagnostics: pair count, vector norm, pairwise cosine agreement, positive/negative separability score, output metric delta.
- Before/after comparison: baseline output, steered output, highlighted changed phrases, optional model-generated explanation.
- Sub-agent/smaller-model mode: allow a lightweight local/remote evaluator to summarize changes and flag confounds, but clearly label it as an evaluator, not ground truth.

## Model registry starter list

Use this as the initial model list for the UI. Each entry should have a support status, runtime hints, and a warning if steering is not yet validated.

| Model ID | Initial role | Steering readiness |
| --- | --- | --- |
| `google/gemma-4-E2B-it` | Verified local baseline | Supported today |
| `google/gemma-4-E4B-it` | Next Gemma small model | Likely compatible after sweep |
| `google/gemma-4-12B-it` | Stronger Gemma quality target | Needs hardware/runtime validation |
| `google/gemma-4-26B-it` | Standard high-quality Gemma 4 comparison for DiffusionGemma | Needs serving/runtime validation |
| `google/diffusiongemma-26B-A4B-it` | Diffusion generation target | Generation first; steering requires adapter research |
| `Qwen/Qwen3.6-27B` | Latest general Qwen target | Needs layer discovery and hook validation |
| `Qwen/Qwen3.6-27B-FP8` | Practical Qwen3.6 serving target | Prefer for constrained local/remote serving |
| `Qwen/Qwen3.6-35B-A3B` | Latest Qwen MoE target | Needs MoE-aware validation |
| `Qwen/Qwen3.6-35B-A3B-FP8` | Practical Qwen MoE serving target | Needs serving/runtime validation |
| `Qwen/Qwen3-Coder-Next` | Agentic coding behavior target | High risk; architecture-specific adapter likely needed |

## Suggested next experiments

1. Add a model registry module with metadata, tags, support status, and adapter hints.
2. Add model introspection that reports available layer paths, hidden-state availability, generation API class, tokenizer/processor shape, and hook smoke-test result.
3. Add CAA-style multi-pair config support and metrics for pairwise cosine agreement.
4. Add layer/coefficient sweep CLI and JSON output before building the UI.
5. Build backend API around the CLI primitives.
6. Build the shadcn/glass UI as a workbench.
7. Validate Gemma 4 E2B end to end in the UI before claiming Qwen/DiffusionGemma steering support.
8. Add Qwen3.6 adapter validation.
9. Add DiffusionGemma generation mode, then research diffusion-phase steering.
10. Update README with the UI path, support matrix, screenshots, and explicit limitations.

## Open risks

- DiffusionGemma may not expose hidden states or hookable layers in the same way as causal LMs.
- Qwen3.6 multimodal model classes may need processor-aware prompt formatting and image/text input handling.
- Qwen3-Coder-Next has a hybrid architecture that may break layer assumptions.
- Large models may require vLLM/SGLang/OpenAI-compatible local endpoints rather than direct in-process HF loading.
- The UI should not imply that a visible style change proves robust causal steering.
