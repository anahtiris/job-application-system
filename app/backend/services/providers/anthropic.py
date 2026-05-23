"""Anthropic provider — blocking and streaming via the Messages API."""
import os
from typing import AsyncIterator

import httpx

_BASE = "https://api.anthropic.com/v1"
_API_VERSION = "2023-06-01"


def _headers() -> dict:
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set.")
    return {
        "x-api-key": key,
        "anthropic-version": _API_VERSION,
        "content-type": "application/json",
    }


def _payload(model: str, prompt: str, system: str, stream: bool) -> dict:
    body: dict = {
        "model": model,
        "max_tokens": 8192,
        "messages": [{"role": "user", "content": prompt}],
        "stream": stream,
    }
    if system:
        body["system"] = system
    return body


async def generate(model: str, prompt: str, system: str = "") -> str:
    async with httpx.AsyncClient(timeout=300) as client:
        r = await client.post(
            f"{_BASE}/messages",
            headers=_headers(),
            json=_payload(model, prompt, system, stream=False),
        )
        r.raise_for_status()
        data = r.json()
        return data["content"][0]["text"]


async def stream(model: str, prompt: str, system: str = "") -> AsyncIterator[str]:
    async with httpx.AsyncClient(timeout=300) as client:
        async with client.stream(
            "POST",
            f"{_BASE}/messages",
            headers=_headers(),
            json=_payload(model, prompt, system, stream=True),
        ) as r:
            r.raise_for_status()
            async for line in r.aiter_lines():
                if not line.startswith("data:"):
                    continue
                raw = line[5:].strip()
                if raw in ("", "[DONE]"):
                    continue
                import json
                event = json.loads(raw)
                if event.get("type") == "content_block_delta":
                    yield event["delta"].get("text", "")
