"""Perplexity provider — OpenAI-compatible API with web-grounded responses."""
from typing import AsyncIterator

from services.providers.openai import _generate, _stream


async def generate(model: str, prompt: str, system: str = "") -> str:
    return await _generate("perplexity", model, prompt, system)


async def stream(model: str, prompt: str, system: str = "") -> AsyncIterator[str]:
    async for chunk in _stream("perplexity", model, prompt, system):
        yield chunk
