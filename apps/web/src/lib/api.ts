import type {
  ExperimentPayload,
  ExperimentResult,
  IntrospectionReport,
  LocalDoc,
  LocalDocContent,
  ModelRegistryEntry,
  RuntimeStatus,
  SweepPlan,
  VectorBuildResult
} from "./types";

export const fallbackModels: ModelRegistryEntry[] = [
  {
    model_id: "google/gemma-4-E2B-it",
    display_name: "Gemma 4 E2B IT",
    family: "Gemma 4",
    role: "Verified local steering baseline",
    support_status: "supported",
    steering_ready: true,
    architecture: "gemma4",
    license: "Gemma Terms",
    preferred_backend: "huggingface-local",
    context_window: "See official Gemma 4 model card",
    parameter_summary: "E2B instruction-tuned checkpoint",
    runtime_notes: "Default local Hugging Face path used by the CLI and showcase flow.",
    steering_notes: "Validated for hidden-state extraction, pre-hooks, post-hooks, and greedy generation.",
    source_urls: ["https://ai.google.dev/gemma/docs/core/model_card_4"],
    tags: ["verified", "local", "actadd"],
    default_layer: 18,
    default_coefficient: 1.5
  },
  {
    model_id: "google/diffusiongemma-26B-A4B-it",
    display_name: "DiffusionGemma 26B A4B IT",
    family: "DiffusionGemma",
    role: "Public diffusion-generation target",
    support_status: "generation_only",
    steering_ready: false,
    architecture: "diffusion_gemma",
    license: "Apache 2.0",
    preferred_backend: "vllm-or-sglang",
    context_window: "Up to 256K tokens",
    parameter_summary: "25B-class MoE, about 3.8B active parameters",
    runtime_notes: "Uses block diffusion with canvas-style denoising, not ordinary left-to-right decoding.",
    steering_notes: "Generation and introspection first. Steering requires diffusion-phase adapter research.",
    source_urls: ["https://huggingface.co/google/diffusiongemma-26B-A4B-it"],
    tags: ["diffusion", "generation-only", "experimental"]
  },
  {
    model_id: "Qwen/Qwen3.6-27B",
    display_name: "Qwen3.6 27B",
    family: "Qwen3.6",
    role: "Current general Qwen target",
    support_status: "needs_validation",
    steering_ready: false,
    architecture: "qwen3_5",
    license: "Apache 2.0",
    preferred_backend: "huggingface-local-or-served",
    context_window: "Default 262K-token class context in official notes",
    parameter_summary: "27B-class Qwen3.6 checkpoint",
    runtime_notes: "Validate processor formatting, hidden states, and layer paths.",
    steering_notes: "Enable controls only after layer discovery and hook smoke tests pass.",
    source_urls: ["https://huggingface.co/Qwen/Qwen3.6-27B"],
    tags: ["qwen", "candidate"]
  },
  {
    model_id: "microsoft/Phi-4-mini-instruct",
    display_name: "Phi-4 Mini Instruct",
    family: "Phi-4",
    role: "Small causal-LM steering candidate",
    support_status: "needs_validation",
    steering_ready: false,
    architecture: "phi3",
    license: "MIT",
    preferred_backend: "huggingface-local",
    context_window: "128K-token class context",
    parameter_summary: "3.8B instruction model",
    runtime_notes: "Near-term candidate because the model card supports Transformers and AutoModelForCausalLM loading.",
    steering_notes: "Validate trust_remote_code loading, hidden states, and layer path before enabling controls.",
    source_urls: ["https://huggingface.co/microsoft/Phi-4-mini-instruct"],
    tags: ["phi", "candidate", "small"]
  },
  {
    model_id: "mistralai/Ministral-3-3B-Instruct-2512",
    display_name: "Ministral 3 3B Instruct",
    family: "Ministral 3",
    role: "Small edge-oriented steering candidate",
    support_status: "needs_validation",
    steering_ready: false,
    architecture: "mistral3",
    license: "Apache 2.0",
    preferred_backend: "huggingface-local-or-vllm",
    context_window: "256K-token class context",
    parameter_summary: "3.4B LM plus 0.4B vision encoder",
    runtime_notes: "Promising small candidate, but FP8/vision packaging needs loader validation.",
    steering_notes: "Validate Transformers class, text-only formatting, and hookable layer discovery.",
    source_urls: ["https://huggingface.co/mistralai/Ministral-3-3B-Instruct-2512"],
    tags: ["mistral", "candidate", "small"]
  },
  {
    model_id: "Qwen/Qwen3-Coder-Next",
    display_name: "Qwen3-Coder-Next",
    family: "Qwen3-Coder",
    role: "Coding and agentic behavior target",
    support_status: "experimental",
    steering_ready: false,
    architecture: "qwen3_next",
    license: "Apache 2.0",
    preferred_backend: "served",
    context_window: "256K-token class context",
    parameter_summary: "80B total parameter class, about 3B active parameters",
    runtime_notes: "Hybrid architecture; direct layer assumptions are high risk.",
    steering_notes: "Architecture-specific adapter required before steering can be honestly claimed.",
    source_urls: ["https://huggingface.co/Qwen/Qwen3-Coder-Next"],
    tags: ["qwen", "coder", "experimental"]
  }
];

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchModels(): Promise<ModelRegistryEntry[]> {
  try {
    const payload = await requestJson<{ models: ModelRegistryEntry[] }>("/api/models");
    return payload.models;
  } catch {
    return fallbackModels;
  }
}

export async function introspectModel(modelId: string): Promise<IntrospectionReport> {
  return requestJson<IntrospectionReport>("/api/models/introspect", {
    method: "POST",
    body: JSON.stringify({ model_id: modelId })
  });
}

export async function runExperiment(payload: ExperimentPayload): Promise<ExperimentResult> {
  return requestJson<ExperimentResult>("/api/experiments/run", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function fetchRuntimeStatus(): Promise<RuntimeStatus> {
  return requestJson<RuntimeStatus>("/api/runtime/status");
}

export async function buildVector(payload: ExperimentPayload): Promise<VectorBuildResult> {
  return requestJson<VectorBuildResult>("/api/vectors/build", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function planSweep(
  payload: ExperimentPayload,
  layers: number[],
  coefficients: number[]
): Promise<SweepPlan> {
  return requestJson<SweepPlan>("/api/experiments/sweep", {
    method: "POST",
    body: JSON.stringify({ ...payload, layers, coefficients })
  });
}

export async function fetchExperiment(experimentId: string): Promise<ExperimentResult> {
  return requestJson<ExperimentResult>(`/api/experiments/${experimentId}`);
}

export async function fetchDocs(): Promise<LocalDoc[]> {
  const payload = await requestJson<{ docs: LocalDoc[] }>("/api/docs");
  return payload.docs;
}

export async function fetchDoc(docId: string): Promise<LocalDocContent> {
  return requestJson<LocalDocContent>(`/api/docs/${docId}`);
}
