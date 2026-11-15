import assert from "node:assert/strict";
import test from "node:test";
import {
  modelForRegistryState,
  validateModelRegistry,
} from "../src/lib/modelRegistry.ts";
const model = {
  model_id: "fixture/model",
  display_name: "Synthetic model",
  family: "fixture",
  role: "test",
  support_status: "supported",
  steering_ready: true,
  architecture: "fixture",
  license: "fixture",
  preferred_backend: "fixture",
  context_window: "fixture",
  parameter_summary: "fixture",
  runtime_notes: "fixture",
  steering_notes: "fixture",
  source_urls: [],
  tags: [],
  default_layer: 3,
  default_coefficient: 1.5,
};

test("execution stays disabled while a registry is loading or failed, even if runtime is available", () => {
  assert.equal(modelForRegistryState(model, "checking").steering_ready, false);
  assert.equal(modelForRegistryState(model, "failed").steering_ready, false);
  assert.equal(modelForRegistryState(model, "ready").steering_ready, true);
  assert.equal(
    modelForRegistryState({ ...model, steering_ready: false }, "ready")
      .steering_ready,
    false,
  );
});

test("empty, duplicate and malformed registries fail closed before rendering", () => {
  for (const value of [
    [],
    null,
    [model, model],
    [{ ...model, model_id: "" }],
    [{ ...model, support_status: undefined }],
    [{ ...model, tags: null }],
    [{ ...model, default_coefficient: Infinity }],
  ])
    assert.throws(() => validateModelRegistry(value));
  assert.deepEqual(validateModelRegistry([model]), [model]);
});
