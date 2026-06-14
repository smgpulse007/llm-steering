# Methodology

This document explains the math and implementation choices behind the steering workflows in `llm-steering`.

## Scope

The repository currently focuses on **inference-time activation steering** for Gemma 4 using Hugging Face model access and lightweight intervention hooks. The first-class method is **Activation Addition (ActAdd)** with optional pre-activation and post-activation insertion points.

## End-to-end pipeline

1. Choose a contrast pair such as a positive and negative sentiment prompt.
2. Run the frozen model and collect a hidden state from layer $l$.
3. Construct a steering direction from the contrast.
4. Scale the direction by a coefficient $\alpha$.
5. Inject the direction into the forward pass at a chosen layer and token scope.
6. Compare baseline and steered generations.

## Steering-vector math

### Single-pair ActAdd

Given a positive prompt $x^+$ and negative prompt $x^-$, the basic steering vector at layer $l$ and token position $t$ is:

$$
v_{l,t} = h_l(x^+)_t - h_l(x^-)_t
$$

where $h_l(x)_t \in \mathbb{R}^d$ is the hidden state at layer $l$ and token position $t$.

If normalization is enabled, the implementation uses:

$$
\hat{v}_{l,t} = \frac{v_{l,t}}{\lVert v_{l,t} \rVert_2}
$$

This is implemented in `src/llm_steering/steering.py` by `compute_steering_vector()`.

### Dataset-averaged difference vectors

When multiple paired demonstrations are available, the repository can average their differences:

$$
\bar{v}_{l,t} = \frac{1}{n} \sum_{i=1}^{n} \left(h_l(x_i^+)_t - h_l(x_i^-)_t\right)
$$

Optionally, the averaged direction is normalized afterward.

This is implemented by `compute_mean_difference_vector()`.

## Injection equations

Let $\alpha$ be the steering coefficient.

### Post-activation steering

Post-activation steering edits the residual stream **after** the chosen transformer block executes:

$$
h'_{l,t} = h_{l,t} + \alpha \hat{v}
$$

for all token positions or only the final token, depending on `apply_to`.

In the code, this uses a standard forward hook registered by `steering_hook(..., hook_stage="post")`.

### Pre-activation steering

Pre-activation steering edits the block input **before** the chosen transformer block runs:

$$
\tilde{h}^{\text{in}}_{l,t} = h^{\text{in}}_{l,t} + \alpha \hat{v}
$$

This can produce a different qualitative effect because the transformer block consumes the edited hidden state and can transform it further.

In the code, this uses a forward pre-hook registered by `steering_hook(..., hook_stage="pre")`.

## Token targeting

The repository supports two token scopes.

### Final-token-only steering

Only the last prompt token is modified:

$$
h'_{l,t} = \begin{cases}
h_{l,t} + \alpha \hat{v} & \text{if } t = T \\
h_{l,t} & \text{otherwise}
\end{cases}
$$

This is useful for conservative experiments or for isolating the immediate effect of the prompt boundary.

### All-token steering

Every token position in the current hidden-state tensor receives the intervention:

$$
h'_{l,t} = h_{l,t} + \alpha \hat{v} \quad \forall t
$$

This tends to produce stronger visible effects, especially for small local demos.

## Mapping the math to the code

### Hidden-state extraction

- `prepare_text_inputs()` in `src/llm_steering/hf_runtime.py` formats system/user messages.
- `collect_hidden_state()` in `src/llm_steering/steering.py` runs the model with `output_hidden_states=True` and extracts the selected layer state.

### Vector construction

- `compute_steering_vector()` creates a single-pair direction.
- `compute_mean_difference_vector()` creates an averaged direction across multiple pairs.
- `save_vector()` and `load_vector()` preserve tensor payloads plus provenance metadata.

### Hook insertion

- `locate_transformer_layers()` finds the model's transformer-layer list across several architecture layouts.
- `steering_hook()` selects the target layer and registers either a forward hook (`post`) or forward pre-hook (`pre`).
- `_apply_direction()` applies the vector to either the final token or the full sequence.

### Generation

- `generate_text()` produces the baseline output.
- `generate_with_steering()` applies the hook during generation and then calls the same runtime.
- `scripts/run_actadd.py` is the main CLI entry point for single experiments.

## Choosing layers and coefficients

The repository defaults follow the literature and local validation notes:

- start in the **middle layers**
- use short prompts first
- sweep multiple coefficients rather than assuming one magic value
- prefer richer, tightly matched contrast pairs over minimal word pairs for first demos

On this workstation, the richer sentiment pair in `configs/prompt_pairs/sentiment_rich.yaml` produces a clearer visible effect than the minimal `Love` vs `Hate` pair under greedy decoding.

## Why pre vs post can differ

The same vector can behave differently depending on whether it is added before or after the block:

- **pre-activation** edits can be transformed by attention and MLP computation within the block
- **post-activation** edits act more like a direct residual bias after the block's computation

This repository exposes both so you can compare them directly in the showcase assets and future experiments.

## Limits and caveats

- Steering success is sensitive to prompt construction.
- Large coefficients can harm fluency or simply collapse generations into repetitive wording.
- Qualitative changes should not be confused with robust causal understanding.
- Baseline comparisons between Ollama and Hugging Face reflect both runtime differences and model-format differences.
- Pre-activation support here is a practical engineering feature for experimentation, not a claim that pre-hooks are the uniquely correct causal site for every steering method.

## Recommended evaluation loop

For a serious study rather than a one-off demo, use the following sequence:

1. baseline generation
2. post-activation steering
3. pre-activation steering
4. layer sweep
5. coefficient sweep
6. off-target prompt checks
7. compact artifact export with metadata

That progression keeps the experiments interpretable while leaving room for later work such as CAA, SEA, activation patching, and SAE-guided methods.
