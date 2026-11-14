import type { ExperimentPayload, ExperimentResult } from "./types";

export type RunRecord = {
  request: ExperimentPayload;
  result: ExperimentResult;
  presetName: string;
};

export type ArtifactPreview = { experimentId: string; text: string };

export function captureRequest(request: ExperimentPayload): ExperimentPayload {
  return structuredClone(request);
}

export function completeRun(request: ExperimentPayload, result: ExperimentResult, presetName: string): RunRecord {
  return { request: captureRequest(request), result: structuredClone(result), presetName };
}

export function draftDiffersFromRun(record: RunRecord | null, draft: ExperimentPayload): boolean {
  return record !== null && JSON.stringify(record.request) !== JSON.stringify(draft);
}

export function artifactPreviewForRun(record: RunRecord | null, preview: ArtifactPreview | null): string {
  return record && preview?.experimentId === record.result.experiment_id ? preview.text : "";
}

export function runRecordJson(record: RunRecord): string {
  return JSON.stringify({
    schema_version: "console-run.v1",
    artifact_kind: "console_run_record",
    provenance: "local_api_response_with_submitted_request",
    ...record,
  }, null, 2);
}

export function vectorMetadataJson(record: RunRecord): string {
  const { result, request } = record;
  return JSON.stringify({
    artifact_kind: "vector_metadata",
    experiment_id: result.experiment_id,
    created_at_utc: result.created_at_utc,
    model_id: request.model_id,
    vector_path: result.vector_path,
    layer: request.layer,
    coefficient: request.coefficient,
    hook_stage: request.hook_stage,
    apply_to: request.apply_to,
    normalize: request.normalize,
    prompt_pair_count: request.prompt_pairs.length,
    prompt_control: result.prompt_control,
    diagnostics: result.diagnostics,
    artifact_path: result.artifact_path,
    reproduce_command: result.reproduce_command,
  }, null, 2);
}
