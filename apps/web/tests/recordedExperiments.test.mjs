import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  recordedExperiments,
  missingProvenance,
  exportRecordedExperiment,
  findRecordedExperiment,
  recordNotes,
} from "../src/lib/recordedExperiments.ts";

const original = JSON.parse(
  readFileSync(
    new URL("../../../docs/showcase/use_case_showcase.json", import.meta.url),
    "utf8",
  ),
);

test("unknown deep links cannot silently substitute another experiment", () => {
  assert.equal(findRecordedExperiment("missing-experiment"), undefined);
  assert.equal(findRecordedExperiment().slug, "customer_support_empathy");
});

test("record reader retains every complete output and original intervention setting", () => {
  assert.deepEqual(recordedExperiments, original.use_cases);
  for (const record of recordedExperiments) {
    assert.deepEqual(JSON.parse(exportRecordedExperiment(record)).use_cases, [
      record,
    ]);
    assert.equal(record.apply_to, "all_tokens");
    assert.equal(record.hook_stage, "post");
    assert.equal(record.layer, 18);
  }
  assert.deepEqual(
    recordedExperiments.map((record) => record.coefficient),
    [20, 18, 18],
  );
});

test("legacy record export does not fabricate provenance or a prompt-only arm", () => {
  for (const record of recordedExperiments) {
    const exported = JSON.parse(exportRecordedExperiment(record));
    assert.equal(exported.schema_version, original.schema_version);
    assert.equal(exported.artifact_kind, original.artifact_kind);
    for (const key of [
      "model_id",
      "seed",
      "created_at_utc",
      "prompt_only",
      "diagnostics",
    ])
      assert.equal(key in exported.use_cases[0], false);
  }
  assert.equal(missingProvenance.length, 5);
});

test("tutor record preserves the previously truncated third sentence and names its constraint failure", () => {
  const tutor = findRecordedExperiment("tutor_encouragement");
  assert.match(
    tutor.steered,
    /This works because the reciprocal represents the inverse relationship/,
  );
  assert.match(
    recordNotes[tutor.slug].tradeoff,
    /three sentences despite the requested two-sentence limit/,
  );
});
