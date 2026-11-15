import assert from "node:assert/strict";
import test from "node:test";
import {
  describeDraft,
  numericInputValue,
  parseNumericInput,
  parseSweepNumbers,
  selectDraftModel,
  validateExperimentDraft,
} from "../src/lib/experimentDraft.ts";
const base = () => ({
  model_id: "fixture/a",
  system_prompt: "",
  user_prompt: "A synthetic request",
  prompt_pairs: [{ positive: "clear", negative: "vague" }],
  layer: 3,
  coefficient: 0,
  apply_to: "last_token",
  hook_stage: "post",
  normalize: true,
  max_new_tokens: 16,
  do_sample: false,
  temperature: 0,
  top_p: 1,
  top_k: 0,
  seed: 0,
});

test("clearing a numeric field stays missing while an explicit zero remains valid", () => {
  const draft = base();
  assert.deepEqual(validateExperimentDraft(draft), {});
  draft.coefficient = parseNumericInput("");
  assert.ok(validateExperimentDraft(draft).coefficient);
  assert.equal(numericInputValue(draft.coefficient), "");
  draft.coefficient = parseNumericInput("0");
  assert.deepEqual(validateExperimentDraft(draft), {});
});

test("invalid or unbounded draft values are rejected before a model request", () => {
  const draft = {
    ...base(),
    layer: -1,
    coefficient: Infinity,
    max_new_tokens: 1.5,
    temperature: 0,
    do_sample: true,
    top_p: 1.1,
    top_k: -1,
    seed: 4294967296,
    user_prompt: " ",
    prompt_pairs: [],
  };
  assert.deepEqual(Object.keys(validateExperimentDraft(draft)).sort(), [
    "coefficient",
    "layer",
    "max_new_tokens",
    "prompt_pairs",
    "seed",
    "temperature",
    "top_k",
    "top_p",
    "user_prompt",
  ]);
  assert.throws(() => parseSweepNumbers("1 Infinity", "coefficient"));
  assert.throws(() => parseSweepNumbers("-1 3.5", "layer"));
  assert.deepEqual(parseSweepNumbers("-2, 0, 2", "coefficient"), [-2, 0, 2]);
});

test("model selection returns its identity and defaults together, preserving task inputs", () => {
  const before = base();
  const next = selectDraftModel(before, {
    model_id: "fixture/b",
    default_layer: 12,
    default_coefficient: 1.5,
  });
  assert.deepEqual(
    [next.model_id, next.layer, next.coefficient],
    ["fixture/b", 12, 1.5],
  );
  assert.equal(next.user_prompt, before.user_prompt);
  assert.equal(before.model_id, "fixture/a");
});

test("edited runs carry a custom label while unchanged presets retain their name", () => {
  const draft = base();
  const { model_id, ...payload } = draft;
  const preset = { name: "Fixture behavior", payload };
  assert.equal(describeDraft(draft, preset), "Fixture behavior");
  assert.equal(
    describeDraft({ ...draft, seed: 41 }, preset),
    "Custom (started from Fixture behavior)",
  );
  assert.equal(
    describeDraft({ ...draft, user_prompt: "Edited" }, preset),
    "Custom (started from Fixture behavior)",
  );
});
