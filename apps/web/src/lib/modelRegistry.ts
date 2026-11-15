import type { ModelRegistryEntry } from "./types";

export type RegistryState = "checking" | "ready" | "failed";

export function validateModelRegistry(value: unknown): ModelRegistryEntry[] {
  if (!Array.isArray(value) || !value.length)
    throw new Error("The model registry is empty.");
  const ids = new Set<string>();
  const strings = [
    "model_id",
    "display_name",
    "family",
    "role",
    "support_status",
    "architecture",
    "license",
    "preferred_backend",
    "context_window",
    "parameter_summary",
    "runtime_notes",
    "steering_notes",
  ];
  for (const model of value) {
    if (
      !model ||
      strings.some((key) => typeof model[key] !== "string") ||
      !model.model_id.trim() ||
      !model.display_name.trim() ||
      ids.has(model.model_id) ||
      typeof model.steering_ready !== "boolean" ||
      ![
        "supported",
        "needs_validation",
        "generation_only",
        "experimental",
      ].includes(model.support_status) ||
      ![model.tags, model.source_urls].every(
        (list) =>
          Array.isArray(list) && list.every((item) => typeof item === "string"),
      ) ||
      (model.default_layer != null &&
        (!Number.isSafeInteger(model.default_layer) ||
          model.default_layer < 0)) ||
      (model.default_coefficient != null &&
        !Number.isFinite(model.default_coefficient))
    )
      throw new Error(
        "The model registry contains an invalid or duplicate entry.",
      );
    ids.add(model.model_id);
  }
  return value;
}

export function modelForRegistryState(
  model: ModelRegistryEntry,
  state: RegistryState,
): ModelRegistryEntry {
  return state === "ready" ? model : { ...model, steering_ready: false };
}
