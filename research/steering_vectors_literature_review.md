# Steering vectors and activation steering: working literature review

_Last updated: 2026-05-09_

## What this document is trying to do

This is a **working research brief** for building experiments, not a museum catalog of every paper that has ever used the word “steering.”

The goal is to answer four practical questions:

1. What are the major families of steering methods?
2. Which ones are realistic to implement first on local Gemma 4 hardware?
3. What do the papers say about layer choice, prompt construction, and evaluation?
4. What should this repo implement now versus later?

## Core vocabulary

### Steering vector

A vector in activation space that, when injected or otherwise used during inference, biases model behavior in a desired direction.

Typical sources:

- prompt-pair activation differences
- dataset-averaged contrastive differences
- probe-derived directions
- covariance or spectral methods
- SAE feature combinations

### Activation engineering

A broad name for **inference-time intervention on activations** rather than weights.

This usually means:

- model weights stay frozen
- a vector or transformation is added, projected, or otherwise applied during the forward pass
- behavior changes without retraining the model

### Representation engineering

A broader top-down framework focused on **reading** and **controlling** high-level concepts and functions in learned representations.

It includes steering, but also includes:

- concept extraction
- lie / harmfulness / bias monitoring
- function-level analysis
- low-rank control methods

### Activation patching

A debugging and interpretability method where activations from one run are copied into another run to test causal importance.

It is not the same thing as steering, but it is extremely useful for:

- locating sensitive layers
- confirming whether a chosen intervention site is meaningful
- distinguishing correlation from causal leverage

### SAE-based steering

A newer family of methods that uses sparse autoencoders (SAEs) to edit more interpretable, less polysemantic features than raw dense activations.

This is promising, but operationally heavier than basic ActAdd-style steering.

## The main research line, in order

## 1. Latent steering vectors exist in frozen LMs

### Subramani, Suresh, Peters (ACL Findings 2022)

**Source:** https://aclanthology.org/2022.findings-acl.48/

Main idea:

- The information needed to steer generation is already encoded in frozen pretrained language models.
- Steering vectors can be extracted from latent space and used to reconstruct or bias outputs.

What matters for us:

- This paper helps justify the entire project.
- It argues that steering is not necessarily “teaching” the model anything new.
- Instead, steering often **elicits** or **selects** from capabilities that are already present.

Practical takeaway:

- Steering is worth trying before fine-tuning.
- Frozen-model intervention is a serious experimental path, not just a hack.

Limitation:

- Extraction in this paper is not the simplest or cheapest operational method for local iteration.

## 2. Simple prompt-pair activation differences work surprisingly well

### Turner et al. — *Steering Language Models With Activation Engineering* (ActAdd)

**Source:** https://arxiv.org/abs/2308.10248

Main contribution:

- Introduces **Activation Addition (ActAdd)**.
- Compute a steering vector from a contrast pair like `Love - Hate`.
- Inject that vector into a model’s residual stream during generation.

Key results reported:

- strong topic steering
- sentiment control
- detoxification
- limited impact on off-target knowledge benchmarks in their experiments

Important implementation details from the paper:

- **middle layers** are often the best intervention site
- right-padding shorter contrast prompts works
- a small number of hyperparameters matter: layer, coefficient, alignment strategy
- the method is **optimization-free** and lightweight

Why it matters for this repo:

- It is the best first method to implement on Gemma 4.
- It fits local hardware.
- It gives rapid iteration cycles and visible behavioral differences.

Caveats from the paper:

- the effect depends on prompt-pair quality
- it is not API-only; you need hidden-state access
- large coefficients can degrade fluency
- success does not imply that all desired behaviors are linearly steerable

Repo implication:

- **Implement ActAdd first.**
- Use it as the baseline steering method before moving to more elaborate approaches.

## 3. Dataset-averaged contrastive vectors are more stable than one-off pairs

### Panickssery et al. — *Steering Llama 2 via Contrastive Activation Addition* (CAA)

**Source:** https://arxiv.org/abs/2312.06681

Main idea:

- Instead of using one hand-picked contrast pair, average residual-stream differences across many positive/negative examples of a behavior.
- Apply the resulting steering vector at all token positions after the user prompt.

Why this matters:

- Single-pair ActAdd is fast but noisy.
- CAA is often a better next step when a behavior is too brittle under prompt-pair choice.

Practical takeaway:

- Once the repo can compute and inject one vector, the next upgrade is to support **dataset-averaged vectors**.
- This is particularly useful for behaviors like:
  - honesty vs hallucination
  - sycophancy vs independence
  - refusal vs compliance

Repo implication:

- Add CAA-style vector building after basic ActAdd works.
- Support saving vectors to disk with prompt metadata.

## 4. Representation engineering broadens the game from “steer text” to “read and control internal concepts”

### Zou et al. — *Representation Engineering: A Top-Down Approach to AI Transparency*

**Source:** https://arxiv.org/abs/2310.01405

This is the most important conceptual paper for the workspace.

Main framework:

- **Representation reading** — extract directions that correlate with high-level concepts or functions
- **Representation control** — use those directions, contrast vectors, or low-rank adapters to alter behavior

Key introduced or emphasized methods:

- **LAT (Linear Artificial Tomography)** for extracting reading vectors
- **Reading vectors** for monitoring concepts/functions
- **Contrast vectors** for stronger stimulus-dependent control
- **LoRRA** for low-rank representation adaptation with low inference overhead

Important evaluation advice from the paper:

Do not stop at correlation.
Use multiple experiment types:

1. **Correlation** — can the vector predict the concept?
2. **Manipulation** — does editing the vector change behavior?
3. **Termination** — does removing it impair the function?
4. **Recovery** — can reintroducing it restore the function?

This is one of the biggest practical takeaways from the whole literature.

Why it matters for your repo:

- It turns the project from “prompt tricks with vectors” into a proper experimental lab.
- It gives a structure for datasets, evaluation, and documentation.
- It strongly supports storing metadata for every vector and experiment.

Practical conclusions we should keep:

- middle layers are often strong sites for intervention
- task template design matters a lot
- simple unsupervised methods like PCA over paired differences can be surprisingly strong
- honest evaluation requires both steering success **and** collateral-damage checks

Repo implication:

- The repo should log:
  - vector source prompts or dataset
  - layer
  - coefficient
  - token position choice
  - baseline vs steered outputs
  - off-target checks

## 5. Spectral methods improve on naive dense differences when you have positive/negative demonstrations

### Qiu et al. — *Spectral Editing of Activations for Large Language Model Alignment* (SEA)

**Source:** https://arxiv.org/abs/2405.09719

Main idea:

- Project representations into directions with maximal covariance with positive demonstrations while minimizing covariance with negative demonstrations.
- Includes linear and nonlinear variants.

Why this matters:

- SEA is a serious step up from raw mean differences when you have a curated demonstration set.
- It aims to improve effectiveness while preserving generalization and minimizing damage.

Practical conclusion:

- SEA is a strong candidate for the **second wave** of methods in this repo.
- It is more involved than ActAdd, so it should come after the basic hook + vector pipeline is stable.

Repo implication:

- The data format should support labeled positive/negative examples from the start.
- Even if SEA is not implemented immediately, the repo should not paint itself into a corner.

## 6. Activation patching is the debugging tool you want nearby

### Heimersheim & Nanda — *How to use and interpret activation patching*

**Source:** https://arxiv.org/abs/2404.15255

Main message:

- Activation patching is useful, but easy to misuse.
- Choice of metric, patch target, and interpretation all matter.

Why it matters here:

- Steering failures can come from:
  - the wrong layer
  - the wrong token position
  - a weak vector
  - a metric that misses the effect
- Activation patching gives a disciplined way to understand where interventions matter.

Repo implication:

- Patching should not be the first implemented feature.
- But the repo design should leave room for it.
- At minimum, structure model-loading code so layer-level intervention is reusable.

## 6.5. Some safety behaviors appear to live in strikingly low-dimensional directions

### Arditi et al. — *Refusal in Language Models Is Mediated by a Single Direction*

**Source:** https://arxiv.org/abs/2406.11717

Main idea:

- Across 13 open chat models, refusal behavior can be strongly mediated by a **one-dimensional direction** in residual-stream activations.
- Removing that direction suppresses refusal.
- Adding it can induce refusal on otherwise harmless requests.

Why it matters:

- This is some of the clearest evidence that important chat behaviors can be surprisingly low-dimensional.
- It strengthens the case that activation-space control is not just a toy for sentiment steering.
- It also shows why steering research has real safety implications and should be handled carefully.

Practical takeaway:

- If you later study refusal / compliance directions in Gemma 4, log those experiments carefully and separate:
  - behavior change,
  - capability retention,
  - and safety implications.

Repo implication:

- The repo should support behavior-specific vector metadata and careful experiment notes, especially for safety-adjacent directions.

## 7. SAEs make feature-level steering more precise than dense residual edits

### Lieberum et al. — *Gemma Scope: Open Sparse Autoencoders Everywhere All At Once on Gemma 2*

**Source:** https://arxiv.org/abs/2408.05147

Main contribution:

- Releases open SAEs across Gemma 2 layers and sublayers.
- Lowers the barrier to serious feature-level interpretability work.

Why it matters:

- Dense residual vectors are powerful, but polysemantic.
- SAEs offer a route to editing more interpretable and more targeted features.

Limit for this repo right now:

- The officially gathered Gemma Scope tooling is centered on Gemma 2 / Gemma 3, not yet a mature Gemma 4 story in the docs we verified.

Repo implication:

- SAE support belongs on the roadmap.
- It should **not** block the initial Gemma 4 steering build.

## 8. SAE-based representation engineering can steer behavior more precisely

### Zhao et al. — *Steering Knowledge Selection Behaviours in LLMs via SAE-Based Representation Engineering* (SpARE)

**Source:** https://arxiv.org/abs/2410.15999

Main idea:

- Detect knowledge conflict in mid-layer residual streams.
- Use SAEs to identify functional features correlated with selecting contextual vs parametric knowledge.
- Remove undesired features and add desired ones at inference time.

Why it matters:

- This is a very concrete demonstration that SAE-based editing can outperform dense representation-engineering baselines on a real control problem.

Important practical lessons:

- knowledge-conflict signals are strongest in **middle layers**
- only a **small set of SAE activations** may be needed
- input-dependent editing is better than crude input-independent editing
- both **adding desired** and **removing undesired** features matter

Repo implication:

- Once basic Gemma 4 steering is stable, the most promising advanced extension is:
  1. use dense steering first,
  2. then move toward SAE-guided steering,
  3. especially for more subtle behaviors.

## 9. SAEs can be used to improve steering vectors themselves

### Chalnev, Siu, Conmy — *Improving Steering Vectors by Targeting Sparse Autoencoder Features* (SAE-TS)

**Source:** https://arxiv.org/abs/2411.02193

Main idea:

- Use SAEs to measure the causal effects of steering vectors.
- Build improved steering vectors that target specific SAE features while minimizing collateral effects.

Why it matters:

- This points toward a future where steering is less trial-and-error.
- It provides a path for making vectors more coherent and less side-effect-prone.

Repo implication:

- This is a later-stage method.
- It belongs after:
  - stable dense vector extraction
  - baseline logging
  - reproducible evaluation

## Gemma-specific conclusions

## What the official Gemma docs support today

The official docs gathered here support:

- Gemma 4 on Hugging Face Transformers
- Gemma 4 on Ollama
- official model-card details for variant choice and generation defaults

They do **not** yet provide the same mature official SAE tooling story for Gemma 4 that Gemma Scope provided for Gemma 2 / 3.

So the best build order for Gemma 4 is:

1. **HF hidden-state access**
2. **ActAdd / mean-difference steering**
3. **CAA-style averaged steering**
4. **SEA-style spectral methods**
5. **SAE-guided work once the surrounding tooling is mature**

## What to implement first in this repo

### Phase 1 — minimal but real

- HF Gemma 4 download helper
- local model loading with hidden-state access
- layer locator and forward hook utilities
- ActAdd / mean-difference steering
- saved vectors with metadata
- Ollama baseline comparison

### Phase 2 — reproducibility

- prompt-pair datasets
- CSV / JSON logging
- coefficient sweeps
- layer sweeps
- off-target prompts and comparison reports

### Phase 3 — stronger methods

- CAA-style dataset-averaged vectors
- SEA / covariance-based editing
- activation patching diagnostics

### Phase 4 — feature-level work

- SAE integration
- Gemma Scope-derived analysis when appropriate
- SAE-targeted steering / SpARE-style editing

## What the literature says about good experimental hygiene

Across the gathered sources, the recurring advice is:

- prefer **mid-layer sweeps** over guessing one layer forever
- keep **contrast pairs clean and narrow**
- test **multiple coefficients**
- save **all vector provenance**
- compare against **off-target tasks**
- do not confuse **correlation** with **causal control**
- use **activation patching** or other diagnostics when steering fails mysteriously

## Recommended initial experiments on Gemma 4

1. **Sentiment steering**
   - easy to observe
   - good for coefficient sweeps
2. **Tone / politeness steering**
   - useful for comparing qualitative control without extreme safety implications
3. **Truthful vs misleading framing**
   - useful later, after the logging and evaluation loop is stable
4. **Context vs parametric reliance**
   - future SAE direction, inspired by SpARE

## Bottom line

If the question is, “what should we build first for Gemma 4 activation steering on this machine?”, the literature says:

- start with **HF + hooks**
- implement **ActAdd first**
- use **Ollama as a runtime baseline**, not as a metaphysically pure control
- make the repo **measurement-heavy from day one**
- leave room for **CAA, SEA, patching, and SAE-based methods** later

That is exactly the architecture this workspace should follow.
