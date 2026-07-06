# Lesson 6: Evaluation

Steering needs evaluation discipline because a visible difference is not enough.

Recommended loop:

1. Run the baseline output.
2. Run a prompt-only control.
3. Build the steering vector.
4. Run post-activation steering.
5. Run pre-activation steering.
6. Sweep coefficient and layer.
7. Check whether the output changed in the desired way.
8. Check whether unrelated capabilities degraded.

Useful evidence:

- Reproduction command.
- Prompt pairs.
- Model id and runtime source.
- Layer, coefficient, hook stage, token scope.
- Vector diagnostics.
- Output metrics.
- Human-readable interpretation.

The workbench and JSON artifacts exist so experiments can be reviewed instead of reconstructed from memory.
