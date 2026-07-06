# Lesson 5: CAA-Style Mean Difference Vectors

Single prompt pairs are easy to understand but can be noisy. Contrastive Activation Addition style workflows use multiple positive and negative examples.

This repo already supports mean-difference vectors:

```text
v = mean_i(hidden(positive_i) - hidden(negative_i))
```

More pairs can make a direction more stable when the examples agree. Poorly matched examples can make things worse.

## Good Prompt Pairs

Use examples that differ mainly in the desired behavior:

- calm vs defensive support
- scaffolded vs terse tutoring
- risk-aware vs overconfident launch advice

Avoid pairs where the positive and negative sides also change the task, facts, audience, or format.
