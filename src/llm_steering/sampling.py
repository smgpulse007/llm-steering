"""Scoped PyTorch sampling controls for paired CPU/CUDA comparisons."""
from __future__ import annotations

from contextlib import contextmanager
from threading import RLock
from typing import Iterator

import torch


_RNG_LOCK = RLock()
MAX_SEED = 2**32 - 1


def validate_seed(seed: int) -> None:
    if isinstance(seed, bool) or not isinstance(seed, int) or not 0 <= seed <= MAX_SEED:
        raise ValueError(f"seed must be an integer between 0 and {MAX_SEED}.")


@contextmanager
def paired_torch_seed(seed: int, *, enabled: bool = True) -> Iterator[None]:
    """Reuse a starting RNG state, restoring caller CPU/CUDA state even on failure.

    Calls through this helper are serialized because PyTorch's default RNGs are
    process-global. This does not make unrelated RNG users thread-safe or promise
    deterministic kernels, cross-device equality, or control of custom RNGs.
    """
    validate_seed(seed)
    with _RNG_LOCK:
        devices = list(range(torch.cuda.device_count())) if torch.cuda.is_available() else []
        with torch.random.fork_rng(devices=devices, device_type="cuda"):
            # Seed only the backends whose state this context saves/restores.
            if enabled:
                cpu_state = torch.Generator(device="cpu").manual_seed(seed).get_state()
                torch.random.set_rng_state(cpu_state)
                if devices:
                    torch.cuda.manual_seed_all(seed)
            yield
