from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import torch
from transformers import AutoModelForCausalLM, AutoProcessor, AutoTokenizer

try:
    from transformers import AutoModelForImageTextToText
except ImportError:  # pragma: no cover - compatibility fallback
    AutoModelForImageTextToText = None  # type: ignore[assignment]

from .config import RuntimeSettings


@dataclass(slots=True)
class LoadedHFModel:
    model_id: str
    source: str
    model: torch.nn.Module
    tokenizer: Any | None
    processor: Any | None
    device: torch.device

    @property
    def decoder(self) -> Any:
        if self.processor is not None and hasattr(self.processor, "tokenizer"):
            return self.processor.tokenizer
        if self.tokenizer is None:
            raise RuntimeError("No tokenizer/decoder is available for this loaded model.")
        return self.tokenizer


def resolve_torch_dtype() -> torch.dtype:
    if torch.cuda.is_available():
        if torch.cuda.is_bf16_supported():
            return torch.bfloat16
        return torch.float16
    return torch.float32


def resolve_model_source(model_id: str, local_dir: Path | None = None) -> str:
    if local_dir is not None and local_dir.exists() and any(local_dir.iterdir()):
        return str(local_dir)
    return model_id


def _try_apply_chat_template(apply_fn: Any, messages: list[dict[str, Any]]) -> Any:
    attempts = [
        {
            "tokenize": True,
            "add_generation_prompt": True,
            "return_dict": True,
            "return_tensors": "pt",
        },
        {
            "tokenize": True,
            "add_generation_prompt": True,
            "return_tensors": "pt",
        },
    ]
    for kwargs in attempts:
        try:
            return apply_fn(messages, **kwargs)
        except TypeError:
            continue
    return apply_fn(messages)


def _move_batch_to_device(batch: Any, device: torch.device) -> dict[str, torch.Tensor]:
    if hasattr(batch, "to"):
        moved = batch.to(device)
        if isinstance(moved, dict):
            return dict(moved)
        if hasattr(moved, "items"):
            return dict(moved.items())

    if isinstance(batch, torch.Tensor):
        return {"input_ids": batch.to(device)}

    if isinstance(batch, dict):
        return {
            key: value.to(device) if isinstance(value, torch.Tensor) else value
            for key, value in batch.items()
        }

    raise TypeError(f"Unsupported batch type: {type(batch)!r}")


def format_messages(system_prompt: str, user_prompt: str) -> list[dict[str, Any]]:
    messages: list[dict[str, Any]] = []
    if system_prompt.strip():
        messages.append(
            {
                "role": "system",
                "content": [{"type": "text", "text": system_prompt.strip()}],
            }
        )
    messages.append(
        {
            "role": "user",
            "content": [{"type": "text", "text": user_prompt.strip()}],
        }
    )
    return messages


def load_hf_model(
    settings: RuntimeSettings,
    *,
    model_id: str | None = None,
    local_dir: Path | None = None,
) -> LoadedHFModel:
    chosen_model_id = model_id or settings.hf_model_id
    chosen_local_dir = local_dir or settings.hf_model_local_dir
    source = resolve_model_source(chosen_model_id, chosen_local_dir)
    token = settings.hf_token or None

    tokenizer = None
    processor = None

    common_kwargs = {"token": token, "trust_remote_code": True}

    try:
        processor = AutoProcessor.from_pretrained(source, **common_kwargs)
        if hasattr(processor, "tokenizer"):
            tokenizer = processor.tokenizer
    except Exception:
        processor = None

    if tokenizer is None:
        tokenizer = AutoTokenizer.from_pretrained(source, **common_kwargs)

    if getattr(tokenizer, "pad_token_id", None) is None and getattr(tokenizer, "eos_token_id", None) is not None:
        tokenizer.pad_token = tokenizer.eos_token

    model_kwargs: dict[str, Any] = {
        "token": token,
        "trust_remote_code": True,
        "dtype": resolve_torch_dtype(),
    }
    if torch.cuda.is_available():
        model_kwargs["device_map"] = "auto"

    load_errors: list[str] = []
    candidate_classes = []
    if AutoModelForImageTextToText is not None:
        candidate_classes.append(AutoModelForImageTextToText)
    candidate_classes.append(AutoModelForCausalLM)

    model = None
    for model_cls in candidate_classes:
        try:
            model = model_cls.from_pretrained(source, **model_kwargs)
            break
        except Exception as exc:  # pragma: no cover - depends on external model class support
            load_errors.append(f"{model_cls.__name__}: {exc}")

    if model is None:
        joined = "\n".join(load_errors)
        raise RuntimeError(f"Unable to load Hugging Face model from {source}. Tried:\n{joined}")

    model.eval()
    device = next(model.parameters()).device
    return LoadedHFModel(
        model_id=chosen_model_id,
        source=source,
        model=model,
        tokenizer=tokenizer,
        processor=processor,
        device=device,
    )


def prepare_text_inputs(loaded: LoadedHFModel, system_prompt: str, user_prompt: str) -> dict[str, torch.Tensor]:
    messages = format_messages(system_prompt, user_prompt)

    if loaded.processor is not None and hasattr(loaded.processor, "apply_chat_template"):
        encoded = _try_apply_chat_template(loaded.processor.apply_chat_template, messages)
        return _move_batch_to_device(encoded, loaded.device)

    if loaded.tokenizer is not None and hasattr(loaded.tokenizer, "apply_chat_template"):
        encoded = _try_apply_chat_template(loaded.tokenizer.apply_chat_template, messages)
        return _move_batch_to_device(encoded, loaded.device)

    prompt = ""
    if system_prompt.strip():
        prompt += f"System: {system_prompt.strip()}\n"
    prompt += f"User: {user_prompt.strip()}\nAssistant:"
    encoded = loaded.decoder(prompt, return_tensors="pt")
    return _move_batch_to_device(encoded, loaded.device)


def generate_text(
    loaded: LoadedHFModel,
    *,
    system_prompt: str,
    user_prompt: str,
    max_new_tokens: int,
    do_sample: bool = False,
    temperature: float = 1.0,
    top_p: float = 0.95,
    top_k: int = 64,
) -> str:
    inputs = prepare_text_inputs(loaded, system_prompt, user_prompt)
    input_ids = inputs.get("input_ids")
    prompt_length = input_ids.shape[-1] if isinstance(input_ids, torch.Tensor) else 0

    generation_kwargs: dict[str, Any] = {
        "max_new_tokens": max_new_tokens,
        "do_sample": do_sample,
        "pad_token_id": getattr(loaded.decoder, "pad_token_id", None),
        "eos_token_id": getattr(loaded.decoder, "eos_token_id", None),
    }
    if do_sample:
        generation_kwargs.update(
            {
                "temperature": temperature,
                "top_p": top_p,
                "top_k": top_k,
            }
        )

    with torch.no_grad():
        outputs = loaded.model.generate(**inputs, **generation_kwargs)

    generated = outputs[:, prompt_length:] if prompt_length else outputs
    decoded = loaded.decoder.batch_decode(generated, skip_special_tokens=True)
    return decoded[0].strip()
