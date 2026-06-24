"""Anthropic provider — blocking and streaming via the Messages API."""
import json
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


# Name of the synthetic tool used to force structured (schema-valid) output.
_SCHEMA_TOOL = "emit_result"


def _payload(model: str, prompt: str, system: str, stream: bool, fmt: dict | None = None) -> dict:
    body: dict = {
        "model": model,
        "max_tokens": 8192,
        "messages": [{"role": "user", "content": prompt}],
        "stream": stream,
    }
    if system:
        body["system"] = system
    # Structured output: force a single tool call whose input_schema is the
    # caller's JSON schema. The model cannot return free text, so the result
    # is guaranteed schema-valid JSON. Tool use is incompatible with streaming.
    if fmt and not stream:
        body["tools"] = [
            {
                "name": _SCHEMA_TOOL,
                "description": "Return the result as structured JSON.",
                "input_schema": fmt,
            }
        ]
        body["tool_choice"] = {"type": "tool", "name": _SCHEMA_TOOL}
    return body


async def generate(model: str, prompt: str, system: str = "", fmt: dict | None = None) -> str:
    async with httpx.AsyncClient(timeout=300) as client:
        r = await client.post(
            f"{_BASE}/messages",
            headers=_headers(),
            json=_payload(model, prompt, system, stream=False, fmt=fmt),
        )
        r.raise_for_status()
        data = r.json()
        if fmt:
            for block in data["content"]:
                if block.get("type") == "tool_use":
                    return json.dumps(block["input"])
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
                event = json.loads(raw)
                if event.get("type") == "content_block_delta":
                    yield event["delta"].get("text", "")
