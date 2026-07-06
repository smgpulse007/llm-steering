# Lesson 3: Activation Steering

Activation steering changes model behavior by editing internal activations at inference time.

Instead of saying "be more empathetic" in the prompt, the system estimates a direction in activation space and adds it to a chosen layer while the model generates text.

The simplest version looks like this:

```text
steered_hidden = hidden + coefficient * steering_vector
```

The model weights stay frozen. The edit happens during the forward pass.

## Why It Matters

Activation steering is useful when a behavior direction appears to be represented inside the model and can be nudged without fine-tuning. It is not magic. Some behaviors are not linearly steerable, and visible wording changes do not automatically prove deep causal control.
