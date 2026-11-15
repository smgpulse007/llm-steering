import artifact from "../../../../docs/showcase/use_case_showcase.json" with { type: "json" };

// The original artifact is the sole source of prompts, outputs and settings.
// Editorial observations below never supply missing experimental measurements.
export const recordedArtifact = artifact;
export type RecordedExperiment = (typeof artifact.use_cases)[number];
export const recordedExperiments: readonly RecordedExperiment[] =
  artifact.use_cases;
export const sourceRecordUrl =
  "https://github.com/smgpulse007/llm-steering/blob/5277ef6bb03602163c1b78bb12b0490134565b04/docs/showcase/use_case_showcase.json";
export const missingProvenance = [
  "prompt-only arm",
  "model ID",
  "seed",
  "timestamp",
  "diagnostics",
] as const;

export const recordNotes: Record<
  string,
  { tab: string; title: string; observation: string; tradeoff?: string }
> = {
  customer_support_empathy: {
    tab: "Customer support",
    title: "Customer support empathy",
    observation:
      "Both responses offer a replacement and request an order number. The steered version phrases the next action more directly; that is a qualitative observation, not a measured gain.",
  },
  tutor_encouragement: {
    tab: "Tutoring",
    title: "An explanation with a tradeoff",
    observation:
      "Both responses explain division through the reciprocal. The steered response adds a sentence about the inverse relationship. Whether that helps a learner needs evaluation.",
    tradeoff:
      "The steered answer uses three sentences despite the requested two-sentence limit. More explanation also means a missed instruction.",
  },
  release_risk_calibration: {
    tab: "Release planning",
    title: "Same recommendation, different framing",
    observation:
      "Both responses recommend a phased rollout. The steered response adds a recommendation heading and mentions validation, but the decision is unchanged. This is a framing change, not evidence of better risk judgment.",
  },
};

export function findRecordedExperiment(
  slug?: string,
): RecordedExperiment | undefined {
  return slug
    ? recordedExperiments.find((record) => record.slug === slug)
    : recordedExperiments[0];
}

export function exportRecordedExperiment(record: RecordedExperiment): string {
  return JSON.stringify(
    {
      schema_version: artifact.schema_version,
      artifact_kind: artifact.artifact_kind,
      use_cases: [record],
    },
    null,
    2,
  );
}
