# Gemma 4 runtime notes

_Last verified: 2026-05-09_

## Official Gemma 4 positioning

According to the official Gemma pages and model card, Gemma 4 is designed for:

- reasoning
- coding
- agentic workflows
- multimodal understanding
- local deployment from edge devices to consumer GPUs

Official download and runtime paths include:

- Hugging Face
- Ollama
- Kaggle
- LM Studio
- Docker

## Official Ollama variants

The official Gemma + Ollama documentation lists these Gemma 4 tags:

- `gemma4:e2b`
- `gemma4:e4b`
- `gemma4:26b`
- `gemma4:31b`

On this machine, `ollama pull gemma4` completed successfully and produced:

- `gemma4:latest`

## Official Hugging Face path

The official Hugging Face inference guide for Gemma shows Gemma 4 running with Transformers and gives `google/gemma-4-E2B-it` as a concrete example model id.

That makes `google/gemma-4-E2B-it` the safest initial HF target for this repo.

## Gemma 4 architecture notes relevant to steering

From the official model card:

- Gemma 4 uses hybrid attention with interleaved local sliding-window and global attention.
- Final layers remain global.
- E2B and E4B are dense models optimized for parameter efficiency.
- 26B A4B is a Mixture-of-Experts model with a smaller active parameter count than total parameter count.
- E2B/E4B support text, image, and audio.
- 26B/31B support text and image.

These details matter for activation steering because:

1. **Middle-layer sweeps are still the right first move.**
   The steering literature repeatedly finds mid-layer interventions effective.
2. **Context length is large enough to tempt overcomplication.**
   Start with short prompts and short generations anyway.
3. **Multimodal support does not mean multimodal steering should be step one.**
   Text-only steering experiments should come first.

## Size and hardware implications

The official model card reports:

- E2B: 2.3B effective parameters, 128K context, text/image/audio
- E4B: 4.5B effective parameters, 128K context, text/image/audio
- 26B A4B: 25.2B total / 3.8B active, 256K context, text/image
- 31B: 30.7B total, 256K context, text/image

For this RTX 4090 workstation, the practical recommendation is:

- **Start with E2B** for the first HF steering loop.
- Move to **E4B** once the hooks, logging, and vector workflow are stable.
- Treat **26B/31B** as later-stage experiments, especially if you want long context or multimodal steering.

## Gemma Scope relevance

The current official Gemma Scope 2 docs focus on **Gemma 3**, not Gemma 4.

That means:

- Gemma Scope is highly relevant to the overall research direction.
- But for Gemma 4 specifically, there is not yet an equally mature official “Scope 4” workflow in the docs gathered here.

So the practical order is:

1. HF hidden-state hooks on Gemma 4
2. ActAdd / mean-difference / CAA-style experiments
3. Later SAE-guided work once Gemma 4 feature tooling is clearer

## Best-practice defaults from the Gemma 4 model card

The model card recommends standardized sampling defaults:

- `temperature=1.0`
- `top_p=0.95`
- `top_k=64`

The card also notes:

- Gemma 4 uses normal `system`, `user`, and `assistant` roles.
- Thinking mode is controlled with `<|think|>` in the system prompt.
- Historical thought traces should **not** be replayed into future turns.

For steering experiments, that suggests:

- keep thinking mode **off** for the first causal comparisons
- add it only after baseline steering is stable
- avoid mixing chain-of-thought and steering until you have a clean baseline

## Local validation notes from this workstation

The following was verified directly in this repo on 2026-05-09:

- `ollama pull gemma4` completed successfully and the local Ollama baseline generates normally.
- `google/gemma-4-E2B-it` downloaded successfully into `models/hf/google_gemma-4-E2B-it`.
- The HF steering hook path for this checkpoint is the **text tower**, exposed as `model.language_model.layers` under the top-level conditional-generation wrapper.
- A conservative single-token sentiment pair like `Love` vs `Hate` can produce **little or no visible change** under greedy decoding, even though the steering hook is active.
- A richer sentence-level contrast pair with a larger coefficient **does** produce a visible nudge in generated wording.

Practical lesson:

- Gemma 4 steering setup is working locally.
- For visible first demos, prefer richer contrast pairs and treat layer / coefficient sweeps as mandatory rather than optional.

## Experimental recommendation for this repo

Use the following progression:

1. Ollama baseline with `gemma4`
2. HF baseline with `google/gemma-4-E2B-it`
3. Single-pair ActAdd-style steering
4. Dataset-averaged steering vectors
5. Layer sweeps
6. Coefficient sweeps
7. Robustness checks across multiple prompt families

This order keeps the setup simple and makes failures easier to interpret.
