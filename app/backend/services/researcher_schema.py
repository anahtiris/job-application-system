"""Structured shape for company-tone classification (researcher.py).

Handed to providers' structured output via `generate(fmt=...)`. Mirrors the
JSON described in TONE_SYSTEM."""
from typing import Literal

from pydantic import BaseModel


class ToneClassification(BaseModel):
    tone: Literal["direct", "startup", "contractor", "agency"] = "direct"
    reasoning: str = ""
