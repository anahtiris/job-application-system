"""Provider-agnostic LLM interface.

Model strings use the form 'provider/model', e.g.:
  - 'ollama/qwen3.6:latest'
  - 'anthropic/claude-sonnet-4-5'
  - 'openai/gpt-4o-mini'
  - 'perplexity/sonar'
  - 'gemini/gemini-2.5-flash'

Each provider module exports async `generate(model, prompt, system)` and
`stream(model, prompt, system)` with identical signatures to ollama.py.
"""
from typing import AsyncIterator

from services.providers import anthropic, gemini, ollama, openai, perplexity

_PROVIDERS = {
    "anthropic": anthropic,
    "gemini": gemini,
    "ollama": ollama,
    "openai": openai,
    "perplexity": perplexity,
}


def _split(slug: str) -> tuple[str, str]:
    if "/" not in slug:
        raise ValueError(
            f"Model '{slug}' must be in 'provider/model' form (e.g. 'ollama/qwen3.6:latest')."
        )
    provider, name = slug.split("/", 1)
    if provider not in _PROVIDERS:
        raise ValueError(
            f"Unknown provider '{provider}'. Configured: {sorted(_PROVIDERS)}"
        )
    return provider, name


async def generate(model: str, prompt: str, system: str = "") -> str:
    provider, name = _split(model)
    return await _PROVIDERS[provider].generate(name, prompt, system)


async def stream(model: str, prompt: str, system: str = "") -> AsyncIterator[str]:
    provider, name = _split(model)
    async for chunk in _PROVIDERS[provider].stream(name, prompt, system):
        yield chunk
