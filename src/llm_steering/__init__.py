"""Utilities for local activation steering experiments."""

from importlib import import_module
from typing import Any

__all__ = [
    "PromptPair",
    "RuntimeSettings",
    "load_environment",
    "load_prompt_pair",
    "project_root",
]

__version__ = "0.1.0"


def __getattr__(name: str) -> Any:
    if name in __all__:
        config = import_module("llm_steering.config")
        return getattr(config, name)
    raise AttributeError(f"module 'llm_steering' has no attribute {name!r}")
