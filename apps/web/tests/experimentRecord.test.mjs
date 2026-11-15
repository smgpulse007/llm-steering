import assert from "node:assert/strict";
import test from "node:test";
import {
  artifactPreviewForRun,
  captureRequest,
  completeRun,
  draftDiffersFromRun,
  reportForModel,
  runRecordJson,
  vectorMetadataJson,
} from "../src/lib/experimentRecord.ts";

// Synthetic API fixtures for state-provenance tests; no model is invoked.
const request = () => ({
  model_id: "fixture/model-a",
  system_prompt: "Fixture system",
  user_prompt: "Fixture prompt",
  prompt_pairs: [{ positive: "clear", negative: "vague" }],
  layer: 3,
  coefficient: 1.5,
  apply_to: "last_token",
  hook_stage: "post",
  normalize: true,
  max_new_tokens: 32,
  do_sample: false,
  temperature: 0.8,
  top_p: 0.95,
  top_k: 64,
  seed: 41,
});
const result = (id = "fixture-run-a") => ({
  experiment_id: id,
  created_at_utc: "2026-01-01T00:00:00Z",
  baseline: "Fixture baseline",
  prompt_only: "Fixture control",
  steered: "Fixture steered",
  prompt_control: { strategy: "fixture", system_prompt: "Fixture control" },
  diagnostics: {
    vector_norm: 1,
    pair_count: 1,
    pairwise_cosine_mean: null,
    pairwise_cosine_min: null,
    separability_score: null,
    reliability_label: "fixture-only",
  },
  output_delta: {
    changed: true,
    baseline_chars: 1,
    steered_chars: 2,
    char_delta: 1,
    word_jaccard: 0,
  },
  control_delta: {
    changed: true,
    baseline_chars: 1,
    steered_chars: 2,
    char_delta: 1,
    word_jaccard: 0,
  },
  steering_delta: {
    changed: true,
    baseline_chars: 1,
    steered_chars: 2,
    char_delta: 1,
    word_jaccard: 0,
  },
  vector_path: null,
  artifact_path: null,
  reproduce_command: "fixture-command",
});

test("edits made while a request is in flight cannot relabel the completed run", () => {
  const draft = request();
  const submitted = captureRequest(draft);
  draft.model_id = "fixture/model-b";
  draft.layer = 9;
  draft.prompt_pairs[0].positive = "edited while waiting";
  const record = completeRun(submitted, result(), "Original preset");
  assert.equal(record.request.model_id, "fixture/model-a");
  assert.equal(record.request.layer, 3);
  assert.equal(record.request.prompt_pairs[0].positive, "clear");
  assert.equal(draftDiffersFromRun(record, draft), true);
});

test("result and vector exports preserve the same submitted configuration after later edits", () => {
  const submitted = request();
  const response = result();
  const record = completeRun(submitted, response, "Original preset");
  const before = runRecordJson(record);
  submitted.coefficient = 20;
  submitted.seed = 99;
  submitted.prompt_pairs.push({ positive: "new", negative: "old" });
  response.diagnostics.vector_norm = 99;
  const vector = JSON.parse(vectorMetadataJson(record));
  assert.equal(runRecordJson(record), before);
  assert.equal(vector.coefficient, 1.5);
  assert.equal(vector.prompt_pair_count, 1);
  assert.equal(vector.diagnostics.vector_norm, 1);
  assert.equal(vector.created_at_utc, "2026-01-01T00:00:00Z");
  assert.equal(JSON.parse(before).artifact_kind, "console_run_record");
  assert.equal(JSON.parse(before).request.seed, 41);
});

test("a delayed artifact response cannot appear beneath a newer run", () => {
  const first = completeRun(request(), result(), "A");
  const second = completeRun(request(), result("fixture-run-b"), "B");
  const oldArtifact = {
    experimentId: first.result.experiment_id,
    text: "fixture artifact A",
  };
  assert.equal(artifactPreviewForRun(first, oldArtifact), "fixture artifact A");
  assert.equal(artifactPreviewForRun(second, oldArtifact), "");
  assert.equal(artifactPreviewForRun(null, oldArtifact), "");
});

test("an untouched draft matches its run and the initial console has no artifact", () => {
  const draft = request();
  assert.equal(draftDiffersFromRun(null, draft), false);
  assert.equal(artifactPreviewForRun(null, null), "");
  assert.equal(
    draftDiffersFromRun(completeRun(draft, result(), "A"), draft),
    false,
  );
});

test("late validation reports cannot validate a different selected model", () => {
  const oldReport = {
    model_id: "fixture/model-a",
    hook_compatible: true,
    status: "fixture",
  };
  assert.equal(reportForModel("fixture/model-b", oldReport), null);
  assert.equal(reportForModel("fixture/model-b", null), null);
  assert.equal(reportForModel("fixture/model-a", oldReport), oldReport);
});
