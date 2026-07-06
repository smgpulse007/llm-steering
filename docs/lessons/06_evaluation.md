# Lesson 6: Evaluation

Steering needs evaluation discipline because a visible difference is not enough.

Recommended loop:

1. Run the baseline output.
2. Run a prompt-only control using the same positive/negative direction as ordinary instructions.
3. Build the steering vector.
4. Run post-activation steering.
5. Run pre-activation steering.
6. Sweep coefficient and layer.
7. Check whether the output changed in the desired way.
8. Check whether unrelated capabilities degraded.

Useful evidence:

- Reproduction command.
- Prompt pairs.
- Exact prompt-only control prompt.
- Model id and runtime source.
- Layer, coefficient, hook stage, token scope.
- Vector diagnostics.
- Baseline-to-prompt, prompt-to-steered, and baseline-to-steered output metrics.
- Human-readable interpretation.

The workbench and JSON artifacts exist so experiments can be reviewed instead of reconstructed from memory.
