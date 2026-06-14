export type SupportStatus = "supported" | "needs_validation" | "generation_only" | "experimental";

export type ModelRegistryEntry = {
  model_id: string;
  display_name: string;
  family: string;
  role: string;
  support_status: SupportStatus;
  steering_ready: boolean;
  architecture: string;
  license: string;
  preferred_backend: string;
  context_window: string;
  parameter_summary: string;
  runtime_notes: string;
  steering_notes: string;
  source_urls: string[];
  tags: string[];
  default_layer?: number | null;
  default_coefficient?: number | null;
};

export type IntrospectionReport = {
  model_id: string;
  architecture: string;
  registry_status: string;
  steering_ready_by_registry: boolean;
  hook_compatible: boolean;
  status: string;
  warnings: string[];
};

export type ExperimentPayload = {
  model_id: string;
  system_prompt: string;
  user_prompt: string;
  prompt_pairs: Array<{ positive: string; negative: string }>;
  layer: number;
  coefficient: number;
  apply_to: "last_token" | "all_tokens";
  hook_stage: "post" | "pre";
  normalize: boolean;
  max_new_tokens: number;
  do_sample: boolean;
  temperature: number;
  top_p: number;
  top_k: number;
};

export type ExperimentResult = {
  experiment_id: string;
  created_at_utc: string;
  baseline: string;
  steered: string;
  diagnostics: {
    vector_norm: number;
    pair_count: number;
    pairwise_cosine_mean: number | null;
    pairwise_cosine_min: number | null;
    separability_score: number | null;
    reliability_label: string;
  };
  output_delta: {
    changed: boolean;
    baseline_chars: number;
    steered_chars: number;
    char_delta: number;
    word_jaccard: number;
  };
  vector_path: string | null;
  artifact_path: string | null;
  reproduce_command: string;
};

export type RuntimeStatus = {
  hf_model_id: string;
  hf_model_local_dir: string;
  ollama_model: string;
  ollama_base_url: string;
  default_layer: number;
  default_coefficient: number;
  max_new_tokens: number;
};

export type VectorBuildResult = {
  vector_id: string;
  model_id: string;
  method: string;
  metadata: Record<string, unknown>;
  diagnostics: ExperimentResult["diagnostics"];
  vector_path: string | null;
};

export type SweepPlan = {
  status: string;
  count: number;
  runs: Array<{
    model_id: string;
    layer: number;
    coefficient: number;
    hook_stage: string;
    apply_to: string;
  }>;
};

export type LocalDoc = {
  doc_id: string;
  title: string;
  path: string;
  summary: string;
  category: string;
};

export type LocalDocContent = {
  doc: LocalDoc;
  content: string;
};
