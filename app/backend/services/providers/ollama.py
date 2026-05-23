"""Ollama HTTP client — blocking and streaming."""
import json
from typing import AsyncIterator

import httpx

OLLAMA_BASE = "http://localhost:11434"


async def generate(model: str, prompt: str, system: str = "") -> str:
    payload = {"model": model, "prompt": prompt, "stream": False}
    if system:
        payload["system"] = system
    async with httpx.AsyncClient(timeout=300) as client:
        r = await client.post(f"{OLLAMA_BASE}/api/generate", json=payload)
        r.raise_for_status()
        return r.json()["response"]


async def stream(model: str, prompt: str, system: str = "") -> AsyncIterator[str]:
    payload = {"model": model, "prompt": prompt, "stream": True}
    if system:
        payload["system"] = system
    async with httpx.AsyncClient(timeout=300) as client:
        async with client.stream("POST", f"{OLLAMA_BASE}/api/generate", json=payload) as r:
            r.raise_for_status()
            async for line in r.aiter_lines():
                if line:
                    data = json.loads(line)
                    yield data.get("response", "")
                    if data.get("done"):
                        break
