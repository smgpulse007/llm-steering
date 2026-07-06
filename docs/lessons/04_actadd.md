# Lesson 4: ActAdd

Activation Addition, or ActAdd, is the first method implemented in this repo.

The method uses a positive prompt and a negative prompt:

```text
v = hidden(positive_prompt) - hidden(negative_prompt)
```

That vector becomes a behavioral direction. During generation, the vector is added at a selected layer with a selected coefficient.

Example contrast:

- Positive: "Write a calm, accountable support reply with clear next steps."
- Negative: "Write a curt, defensive support reply with no next step."

The contrast should isolate the target behavior. If the positive and negative prompts differ in topic, length, or factual content, the vector can mix the desired behavior with unrelated features.

## Tuning Knobs

- Layer controls where the edit enters the model.
- Coefficient controls strength.
- Hook stage controls whether the edit happens before or after a block.
- Token scope controls whether the edit applies to the last token or all tokens.
