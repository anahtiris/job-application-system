"""OpenAI-compatible provider — works for OpenAI and Perplexity (same API shape)."""
import json
import os
from typing import AsyncIterator

import httpx

_BASES = {
    "openai": "https://api.openai.com/v1",
    "perplexity": "https://api.perplexity.ai",
}

_KEY_ENV = {
    "openai": "OPENAI_API_KEY",
    "perplexity": "PERPLEXITY_API_KEY",
}


def _headers(provider: str) -> dict:
    env_var = _KEY_ENV[provider]
    key = os.environ.get(env_var, "")
    if not key:
        raise RuntimeError(f"{env_var} is not set.")
    return {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


def _payload(model: str, prompt: str, system: str, stream: bool, fmt: dict | None = None) -> dict:
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    body: dict = {"model": model, "messages": messages, "stream": stream}
    # Structured output: ask for JSON adhering to the caller's schema. strict
    # is left off so Pydantic-generated schemas (with $defs, optional fields)
    # are accepted; the response is still forced to valid JSON of this shape.
    if fmt and not stream:
        body["response_format"] = {
            "type": "json_schema",
            "json_schema": {"name": "result", "schema": fmt, "strict": False},
        }
    return body


async def _generate(provider: str, model: str, prompt: str, system: str, fmt: dict | None = None) -> str:
    async with httpx.AsyncClient(timeout=300) as client:
        r = await client.post(
            f"{_BASES[provider]}/chat/completions",
            headers=_headers(provider),
            json=_payload(model, prompt, system, stream=False, fmt=fmt),
        )
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]


async def _stream(provider: str, model: str, prompt: str, system: str) -> AsyncIterator[str]:
    async with httpx.AsyncClient(timeout=300) as client:
        async with client.stream(
            "POST",
            f"{_BASES[provider]}/chat/completions",
            headers=_headers(provider),
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
                delta = event["choices"][0]["delta"]
                yield delta.get("content", "")


# llm.py calls generate(model, prompt, system) directly on this module.
# We expose thin wrappers; provider is encoded in the model slug prefix
# handled by llm._split(), so here `model` is already the bare model name.
# We default to openai — perplexity registers its own module alias.

async def generate(model: str, prompt: str, system: str = "", fmt: dict | None = None) -> str:
    return await _generate("openai", model, prompt, system, fmt=fmt)


async def stream(model: str, prompt: str, system: str = "") -> AsyncIterator[str]:
    async for chunk in _stream("openai", model, prompt, system):
        yield chunk
