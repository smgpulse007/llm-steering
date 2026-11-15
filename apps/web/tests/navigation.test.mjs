import assert from "node:assert/strict";
import test from "node:test";
import { parseHashRoute } from "../src/lib/navigation.ts";

test("existing documentation, section and workbench links retain their destinations", () => {
  assert.deepEqual(parseHashRoute("#docs/lesson_evaluation/controls"), {
    activeTab: "learn",
    docId: "lesson_evaluation",
    docSectionId: "controls",
  });
  assert.deepEqual(parseHashRoute("#workbench"), { activeTab: "console" });
  assert.deepEqual(parseHashRoute("#explain/controls"), {
    activeTab: "explain",
    explainTab: "controls",
  });
  assert.deepEqual(parseHashRoute("#explain/invalid"), {
    activeTab: "explain",
    explainTab: "math",
  });
});

test("record deep links identify the saved experiment and overview handles setup", () => {
  assert.deepEqual(parseHashRoute("#experiments"), {
    activeTab: "experiments",
    recordSlug: "customer_support_empathy",
  });
  assert.deepEqual(parseHashRoute("#experiments/tutor_encouragement"), {
    activeTab: "experiments",
    recordSlug: "tutor_encouragement",
  });
  assert.deepEqual(parseHashRoute("#learn"), { activeTab: "learn" });
  assert.deepEqual(parseHashRoute("#setup"), { activeTab: "overview" });
  assert.deepEqual(parseHashRoute(""), { activeTab: "overview" });
});
