from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Literal


SupportStatus = Literal["supported", "needs_validation", "generation_only", "experimental"]


@dataclass(frozen=True, slots=True)
class ModelRegistryEntry:
    model_id: str
    display_name: str
    family: str
    role: str
    support_status: SupportStatus
    steering_ready: bool
    architecture: str
    license: str
    preferred_backend: str
    context_window: str
    parameter_summary: str
    runtime_notes: str
    steering_notes: str
    source_urls: tuple[str, ...]
    tags: tuple[str, ...] = ()
    default_layer: int | None = None
    default_coefficient: float | None = None

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


MODEL_REGISTRY: tuple[ModelRegistryEntry, ...] = (
    ModelRegistryEntry(
        model_id="google/gemma-4-E2B-it",
        display_name="Gemma 4 E2B IT",
        family="Gemma 4",
        role="Verified local steering baseline",
        support_status="supported",
        steering_ready=True,
        architecture="gemma4",
        license="Gemma Terms",
        preferred_backend="huggingface-local",
        context_window="See official Gemma 4 model card",
        parameter_summary="E2B small instruction-tuned checkpoint",
        runtime_notes="Default local Hugging Face path used by the current CLI and showcase flow.",
        steering_notes="Validated in this repo for hidden-state extraction, pre-hooks, post-hooks, and greedy baseline-vs-steered generation.",
        source_urls=(
            "https://ai.google.dev/gemma/docs/core/model_card_4",
            "https://ai.google.dev/gemma/docs/core/huggingface_inference",
        ),
        tags=("verified", "local", "actadd", "gemma"),
        default_layer=18,
        default_coefficient=1.5,
    ),
    ModelRegistryEntry(
        model_id="google/gemma-4-E4B-it",
        display_name="Gemma 4 E4B IT",
        family="Gemma 4",
        role="Next small Gemma steering target",
        support_status="needs_validation",
        steering_ready=False,
        architecture="gemma4",
        license="Gemma Terms",
        preferred_backend="huggingface-local",
        context_window="See official Gemma 4 model card",
        parameter_summary="E4B small instruction-tuned checkpoint",
        runtime_notes="Expected to use the same Gemma 4 Hugging Face path after local download.",
        steering_notes="Enable steering only after layer discovery, hidden-state extraction, and hook smoke tests pass.",
        source_urls=("https://ai.google.dev/gemma/docs/core/model_card_4",),
        tags=("gemma", "candidate"),
    ),
    ModelRegistryEntry(
        model_id="google/gemma-4-12B-it",
        display_name="Gemma 4 12B IT",
        family="Gemma 4",
        role="Stronger Gemma quality target",
        support_status="needs_validation",
        steering_ready=False,
        architecture="gemma4",
        license="Gemma Terms",
        preferred_backend="huggingface-local-or-vllm",
        context_window="See official Gemma 4 model card",
        parameter_summary="12B instruction-tuned checkpoint",
        runtime_notes="Hardware and memory footprint must be validated before use in the workbench.",
        steering_notes="Treat as a Gemma-family candidate until hook compatibility is measured.",
        source_urls=("https://ai.google.dev/gemma/docs/core/model_card_4",),
        tags=("gemma", "candidate", "larger"),
    ),
    ModelRegistryEntry(
        model_id="google/gemma-4-26B-it",
        display_name="Gemma 4 26B IT",
        family="Gemma 4",
        role="High-quality Gemma comparison for DiffusionGemma",
        support_status="needs_validation",
        steering_ready=False,
        architecture="gemma4",
        license="Gemma Terms",
        preferred_backend="vllm-or-sglang",
        context_window="See official Gemma 4 model card",
        parameter_summary="26B instruction-tuned checkpoint",
        runtime_notes="Best treated as a served model target on typical workstations.",
        steering_notes="Do not claim local steering support until direct hidden-state hooks are validated.",
        source_urls=("https://ai.google.dev/gemma/docs/core/model_card_4",),
        tags=("gemma", "candidate", "served"),
    ),
    ModelRegistryEntry(
        model_id="google/diffusiongemma-26B-A4B-it",
        display_name="DiffusionGemma 26B A4B IT",
        family="DiffusionGemma",
        role="Public diffusion-generation target",
        support_status="generation_only",
        steering_ready=False,
        architecture="diffusion_gemma",
        license="Apache 2.0",
        preferred_backend="vllm-or-sglang",
        context_window="Up to 256K tokens",
        parameter_summary="25B-class MoE, about 3.8B active parameters",
        runtime_notes="Uses block diffusion/discrete diffusion with canvas-style denoising instead of ordinary left-to-right decoding.",
        steering_notes="Expose generation and introspection first. Steering requires diffusion-phase adapter research and hook validation.",
        source_urls=(
            "https://huggingface.co/google/diffusiongemma-26B-A4B-it",
            "https://blog.google/innovation-and-ai/technology/developers-tools/diffusion-gemma-faster-text-generation/",
            "https://developers.googleblog.com/en/diffusiongemma-the-developer-guide/",
        ),
        tags=("diffusion", "multimodal", "generation-only", "experimental"),
    ),
    ModelRegistryEntry(
        model_id="microsoft/Phi-4-mini-instruct",
        display_name="Phi-4 Mini Instruct",
        family="Phi-4",
        role="Small causal-LM steering candidate",
        support_status="needs_validation",
        steering_ready=False,
        architecture="phi3",
        license="MIT",
        preferred_backend="huggingface-local",
        context_window="128K-token class context in official model notes",
        parameter_summary="3.8B parameter instruction model",
        runtime_notes="Good near-term candidate because the model card supports Transformers and AutoModelForCausalLM loading.",
        steering_notes="Validate trust_remote_code loading, hidden-state availability, and layer path before enabling controls.",
        source_urls=("https://huggingface.co/microsoft/Phi-4-mini-instruct",),
        tags=("phi", "candidate", "small", "causal-lm"),
    ),
    ModelRegistryEntry(
        model_id="mistralai/Ministral-3-3B-Instruct-2512",
        display_name="Ministral 3 3B Instruct",
        family="Ministral 3",
        role="Small edge-oriented steering candidate",
        support_status="needs_validation",
        steering_ready=False,
        architecture="mistral3",
        license="Apache 2.0",
        preferred_backend="huggingface-local-or-vllm",
        context_window="256K-token class context in official model notes",
        parameter_summary="3.4B language model plus 0.4B vision encoder",
        runtime_notes="Promising small candidate, but the official FP8/vision packaging needs loader validation.",
        steering_notes="Validate Transformers class, BF16 conversion path, text-only prompt formatting, and hookable layer discovery.",
        source_urls=("https://huggingface.co/mistralai/Ministral-3-3B-Instruct-2512",),
        tags=("mistral", "candidate", "small", "multimodal"),
    ),
    ModelRegistryEntry(
        model_id="meta-llama/Llama-4-Scout-17B-16E-Instruct",
        display_name="Llama 4 Scout 17B 16E Instruct",
        family="Llama 4",
        role="MoE/multimodal validation target",
        support_status="needs_validation",
        steering_ready=False,
        architecture="llama4_moe",
        license="Llama 4 Community License",
        preferred_backend="served",
        context_window="10M-token class context in official model notes",
        parameter_summary="17B active, 109B total MoE",
        runtime_notes="Important open model family to track, but too large and architecturally complex for the next local support target.",
        steering_notes="Validate license fit, served/runtime path, MoE layer layout, and hidden-state hooks before enabling steering.",
        source_urls=(
            "https://huggingface.co/meta-llama/Llama-4-Scout-17B-16E-Instruct",
            "https://ai.meta.com/blog/llama-4-multimodal-intelligence/",
        ),
        tags=("llama", "candidate", "moe", "multimodal", "served"),
    ),
    ModelRegistryEntry(
        model_id="Qwen/Qwen3.6-27B",
        display_name="Qwen3.6 27B",
        family="Qwen3.6",
        role="Current general Qwen steering target",
        support_status="needs_validation",
        steering_ready=False,
        architecture="qwen3_5",
        license="Apache 2.0",
        preferred_backend="huggingface-local-or-served",
        context_window="Default 262K-token class context in official model notes",
        parameter_summary="27B-class Qwen3.6 checkpoint",
        runtime_notes="Likely processor-aware and multimodal; validate prompt formatting and hidden states.",
        steering_notes="Enable controls only after layer discovery and hook smoke tests pass.",
        source_urls=("https://huggingface.co/Qwen/Qwen3.6-27B", "https://github.com/QwenLM/Qwen3.6"),
        tags=("qwen", "candidate", "multimodal"),
    ),
    ModelRegistryEntry(
        model_id="Qwen/Qwen3.6-27B-FP8",
        display_name="Qwen3.6 27B FP8",
        family="Qwen3.6",
        role="Practical Qwen serving target",
        support_status="needs_validation",
        steering_ready=False,
        architecture="qwen3_5",
        license="Apache 2.0",
        preferred_backend="served",
        context_window="Default 262K-token class context in official model notes",
        parameter_summary="FP8 quantized 27B-class Qwen3.6 checkpoint",
        runtime_notes="Useful for practical serving, but direct in-process activation hooks may not be available.",
        steering_notes="Prefer generation and metric comparison until a hookable runtime path is confirmed.",
        source_urls=("https://huggingface.co/Qwen/Qwen3.6-27B-FP8", "https://github.com/QwenLM/Qwen3.6"),
        tags=("qwen", "candidate", "fp8", "served"),
    ),
    ModelRegistryEntry(
        model_id="Qwen/Qwen3.6-35B-A3B",
        display_name="Qwen3.6 35B A3B",
        family="Qwen3.6",
        role="Qwen MoE target",
        support_status="needs_validation",
        steering_ready=False,
        architecture="qwen3_5_moe",
        license="Apache 2.0",
        preferred_backend="served",
        context_window="Default 262K-token class context in official model notes",
        parameter_summary="35B-class MoE, about 3B active parameters",
        runtime_notes="Validate MoE layer layout before adding steering controls.",
        steering_notes="Needs MoE-aware layer discovery and hook smoke testing.",
        source_urls=("https://huggingface.co/Qwen/Qwen3.6-35B-A3B", "https://github.com/QwenLM/Qwen3.6"),
        tags=("qwen", "candidate", "moe"),
    ),
    ModelRegistryEntry(
        model_id="Qwen/Qwen3.6-35B-A3B-FP8",
        display_name="Qwen3.6 35B A3B FP8",
        family="Qwen3.6",
        role="Practical Qwen MoE serving target",
        support_status="needs_validation",
        steering_ready=False,
        architecture="qwen3_5_moe",
        license="Apache 2.0",
        preferred_backend="served",
        context_window="Default 262K-token class context in official model notes",
        parameter_summary="FP8 quantized 35B-class MoE Qwen3.6 checkpoint",
        runtime_notes="Serving-first option for the Qwen MoE path.",
        steering_notes="Do not enable direct steering until a hookable runtime is proven.",
        source_urls=("https://huggingface.co/Qwen/Qwen3.6-35B-A3B-FP8", "https://github.com/QwenLM/Qwen3.6"),
        tags=("qwen", "candidate", "moe", "fp8", "served"),
    ),
    ModelRegistryEntry(
        model_id="Qwen/Qwen3-Coder-Next",
        display_name="Qwen3-Coder-Next",
        family="Qwen3-Coder",
        role="Coding and agentic behavior steering target",
        support_status="experimental",
        steering_ready=False,
        architecture="qwen3_next",
        license="Apache 2.0",
        preferred_backend="served",
        context_window="256K-token class context in official model notes",
        parameter_summary="80B total parameter class, about 3B active parameters",
        runtime_notes="Hybrid DeltaNet/attention/MoE architecture; direct layer assumptions are high risk.",
        steering_notes="Architecture-specific adapter required before steering can be honestly claimed.",
        source_urls=("https://huggingface.co/Qwen/Qwen3-Coder-Next",),
        tags=("qwen", "coder", "agent", "experimental"),
    ),
)


def list_models() -> list[ModelRegistryEntry]:
    return list(MODEL_REGISTRY)


def list_model_dicts() -> list[dict[str, object]]:
    return [entry.to_dict() for entry in MODEL_REGISTRY]


def get_model_entry(model_id: str) -> ModelRegistryEntry:
    for entry in MODEL_REGISTRY:
        if entry.model_id == model_id:
            return entry
    raise KeyError(f"Unknown model id: {model_id}")


def is_steering_ready(model_id: str) -> bool:
    return get_model_entry(model_id).steering_ready
