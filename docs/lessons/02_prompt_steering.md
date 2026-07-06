# Lesson 2: Prompt Steering

Prompt steering changes model behavior by changing the text given to the model.

Examples:

- A system prompt can ask for a calm tone.
- A few-shot prompt can show examples of desired answers.
- A rubric can ask the model to check for risk before answering.

Prompt steering is easy to use and should usually be the first baseline. It is also limited: the model may ignore instructions, overfit to wording, or mix the instruction with the user task in brittle ways.

This repo keeps prompt steering in the evaluation loop because activation steering is only meaningful when compared against simpler controls.

## Practical Baseline

For every activation steering experiment, keep at least three outputs:

1. Baseline model output.
2. Prompt-only control output.
3. Activation-steered output.
