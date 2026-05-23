"""Google Gemini provider via the generateContent REST API."""
import json
import os
from typing import AsyncIterator

import httpx

_BASE = "https://generativelanguage.googleapis.com/v1beta"


def _key() -> str:
    key = os.environ.get("GEMINI_API_KEY", "")
    if not key:
        raise RuntimeError("GEMINI_API_KEY is not set.")
    return key


def _payload(prompt: str, system: str) -> dict:
    body: dict = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"maxOutputTokens": 8192},
    }
    if system:
        body["systemInstruction"] = {"parts": [{"text": system}]}
    return body


async def generate(model: str, prompt: str, system: str = "") -> str:
    url = f"{_BASE}/models/{model}:generateContent?key={_key()}"
    async with httpx.AsyncClient(timeout=300) as client:
        r = await client.post(url, json=_payload(prompt, system))
        r.raise_for_status()
        data = r.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]


async def stream(model: str, prompt: str, system: str = "") -> AsyncIterator[str]:
    url = f"{_BASE}/models/{model}:streamGenerateContent?alt=sse&key={_key()}"
    async with httpx.AsyncClient(timeout=300) as client:
        async with client.stream("POST", url, json=_payload(prompt, system)) as r:
            r.raise_for_status()
            async for line in r.aiter_lines():
                if not line.startswith("data:"):
                    continue
                raw = line[5:].strip()
                if not raw:
                    continue
                event = json.loads(raw)
                try:
                    yield event["candidates"][0]["content"]["parts"][0]["text"]
                except (KeyError, IndexError):
                    continue
