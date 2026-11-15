import type { ExperimentPayload, ModelRegistryEntry } from "./types";

export function parseNumericInput(value: string): number {
  return value.trim() === "" ? Number.NaN : Number(value);
}

export function numericInputValue(value: number): number | "" {
  return Number.isFinite(value) ? value : "";
}

export function selectDraftModel(
  draft: ExperimentPayload,
  model: ModelRegistryEntry,
): ExperimentPayload {
  return {
    ...draft,
    model_id: model.model_id,
    layer: model.default_layer ?? draft.layer,
    coefficient: model.default_coefficient ?? draft.coefficient,
  };
}

export function validateExperimentDraft(
  draft: ExperimentPayload,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!draft.user_prompt.trim()) errors.user_prompt = "Enter a user prompt.";
  if (
    !draft.prompt_pairs.length ||
    draft.prompt_pairs.some(
      (pair) => !pair.positive.trim() || !pair.negative.trim(),
    )
  )
    errors.prompt_pairs =
      "Each contrast pair needs positive and negative text.";
  if (!Number.isSafeInteger(draft.layer) || draft.layer < 0)
    errors.layer = "Layer must be a nonnegative whole number.";
  if (!Number.isFinite(draft.coefficient))
    errors.coefficient = "Coefficient must be a finite number.";
  if (!Number.isSafeInteger(draft.max_new_tokens) || draft.max_new_tokens < 1)
    errors.max_new_tokens = "Max tokens must be a positive whole number.";
  if (
    !Number.isFinite(draft.temperature) ||
    draft.temperature < 0 ||
    (draft.do_sample && draft.temperature === 0)
  )
    errors.temperature =
      "Temperature must be nonnegative, and positive when sampling.";
  if (!Number.isFinite(draft.top_p) || draft.top_p <= 0 || draft.top_p > 1)
    errors.top_p = "Top-p must be greater than 0 and at most 1.";
  if (!Number.isSafeInteger(draft.top_k) || draft.top_k < 0)
    errors.top_k = "Top-k must be a nonnegative whole number.";
  const seed = draft.seed ?? 0;
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 4294967295)
    errors.seed = "Seed must be a whole number from 0 to 4294967295.";
  return errors;
}

export function describeDraft(
  draft: ExperimentPayload,
  preset: { name: string; payload: Omit<ExperimentPayload, "model_id"> },
): string {
  const expected = { ...preset.payload, seed: preset.payload.seed ?? 0 };
  return Object.entries(expected).every(
    ([key, value]) =>
      JSON.stringify(draft[key as keyof ExperimentPayload]) ===
      JSON.stringify(value),
  )
    ? preset.name
    : `Custom (started from ${preset.name})`;
}

export function parseSweepNumbers(
  value: string,
  kind: "layer" | "coefficient",
): number[] {
  const values = value
    .split(/[,\s]+/)
    .filter(Boolean)
    .map(Number);
  if (!values.length || values.some((item) => !Number.isFinite(item)))
    throw new Error(`Enter finite ${kind} values.`);
  if (
    kind === "layer" &&
    values.some((item) => !Number.isSafeInteger(item) || item < 0)
  )
    throw new Error("Layers must be nonnegative whole numbers.");
  return values;
}
