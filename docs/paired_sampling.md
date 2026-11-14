# Paired sampling and complete-request replay

When sampling is enabled, output can change even with no steering intervention.
Comparing consecutive generations with different random states mixes that
sampling variation into the apparent steering effect.

The experiment API and `llm-steering run` accept a `seed` (integer from 0 through
4294967295, default 0). With `do_sample: true`, baseline, prompt-only, and
activation-steered generations each start with the same PyTorch CPU/CUDA seed.
Each generation restores the caller's RNG state on exit, including exceptions.
An outer context also preserves state during model loading and vector extraction.
Sweeps carry the same seed into every layer/coefficient combination. Greedy
generation preserves caller state without resetting it to the request seed.

Install the runtime extra and inspect the included synthetic request before
loading any model:

```text
python -m pip install -e ".[hf]"
llm-steering run --request configs/experiments/paired_sampling.json --plan-only
```

With the model and its access requirements available locally:

```text
llm-steering run --request configs/experiments/paired_sampling.json
```

The emitted result includes the complete request, all three outputs, the seed,
sampling-control metadata, and a command pointing back to the saved result.
Replay the saved request using the actual artifact path printed by the command:

```text
llm-steering run --request results/<experiment-id>.json
```

`--no-save` emits the result without writing the vector or result files. Its
reproduction command uses a request-file placeholder because no saved artifact
exists. Custom prompts and all decoding settings are retained when replaying a
saved result; they are not reconstructed from an incomplete list of CLI flags.
Inspect prompts and outputs before sharing an artifact.

Saved sweep results are also accepted as request input. Their reproduction
command retains the saved `base_request` and the layer/coefficient axes.
`normalize` and `do_sample` must be JSON booleans; strings such as `"false"` are
rejected instead of silently turning sampling on.

## What this controls

These controls isolate one source of variability. They do **not** guarantee equal
outputs across hardware, PyTorch/Transformers releases, model revisions, or
non-deterministic kernels. They do not seed custom Python/NumPy generators.
Experiment and sweep calls, including greedy runs, are serialized around the
process-global PyTorch RNGs;
unrelated threads drawing directly from those RNGs remain outside that contract.
The intended runtime backends are CPU and CUDA. Prompt-only inputs differ from
the other arms, so a shared seed is a useful control, not proof of causal effect
or quality improvement. Repeat experiments over multiple prompts and seeds and
evaluate task correctness, not just wording changes.

The CPU tests use an explicitly synthetic sampling function to check control
behavior, seed variation, exception restoration, and full-request replay. They
do not validate model quality or replace a real-model run. A separate CUDA test
runs only when CUDA is available.

See PyTorch's [RNG context documentation](https://docs.pytorch.org/docs/stable/random.html)
and [reproducibility notes](https://docs.pytorch.org/docs/stable/notes/randomness.html)
for the underlying guarantees and limitations.
