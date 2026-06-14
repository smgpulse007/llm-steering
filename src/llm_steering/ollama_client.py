from __future__ import annotations

from dataclasses import dataclass
import json
from typing import Any
from urllib import request


@dataclass(slots=True)
class OllamaClient:
    base_url: str
    model: str
    timeout_seconds: float = 120.0

    def generate(self, prompt: str, *, system_prompt: str = "") -> str:
        payload: dict[str, Any] = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
        }
        if system_prompt.strip():
            payload["system"] = system_prompt.strip()

        endpoint = f"{self.base_url.rstrip('/')}/api/generate"
        body = json.dumps(payload).encode("utf-8")
        http_request = request.Request(
            endpoint,
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with request.urlopen(http_request, timeout=self.timeout_seconds) as response:
            result = json.loads(response.read().decode("utf-8"))
        return str(result.get("response", "")).strip()
