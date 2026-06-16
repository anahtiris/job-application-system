"""Ollama HTTP client — blocking and streaming."""
import json
from typing import AsyncIterator

import httpx

OLLAMA_BASE = "http://localhost:11434"


def _build_payload(model: str, prompt: str, system: str, fmt: dict | None, stream: bool = False) -> dict:
    payload: dict = {"model": model, "prompt": prompt, "stream": stream}
    if system:
        payload["system"] = system
    if fmt:
        payload["format"] = fmt
    return payload


async def generate(model: str, prompt: str, system: str = "", fmt: dict | None = None) -> str:
    payload = _build_payload(model, prompt, system, fmt, stream=False)
    async with httpx.AsyncClient(timeout=300) as client:
        r = await client.post(f"{OLLAMA_BASE}/api/generate", json=payload)
        r.raise_for_status()
        return r.json()["response"]


async def stream(model: str, prompt: str, system: str = "") -> AsyncIterator[str]:
    payload = _build_payload(model, prompt, system, None, stream=True)
    async with httpx.AsyncClient(timeout=300) as client:
        async with client.stream("POST", f"{OLLAMA_BASE}/api/generate", json=payload) as r:
            r.raise_for_status()
            async for line in r.aiter_lines():
                if line:
                    data = json.loads(line)
                    yield data.get("response", "")
                    if data.get("done"):
                        break
