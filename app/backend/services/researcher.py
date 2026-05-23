"""Scrape company website for address and tone classification."""
import re

import httpx
from bs4 import BeautifulSoup

from services.llm import generate

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; JobAppBot/1.0)"}

TONE_SYSTEM = """You are classifying a company based on their website text.

Respond with a JSON object only — no explanation, no markdown:
{
  "tone": "direct" | "startup" | "contractor" | "agency",
  "reasoning": "one sentence"
}

Definitions:
- direct: established product/service company hiring for their own team
- startup: small/early-stage company (small team, recent founding, seed/Series A/B language, "we're building", informal copy). Subset of direct, but warrants a calmer, hands-on, no-corporate-fluff tone.
- contractor: IT consulting or contracting firm that places engineers at clients
- agency: recruiting or staffing agency placing candidates at client companies"""


async def _fetch_page(url: str) -> str:
    async with httpx.AsyncClient(timeout=15, headers=HEADERS, follow_redirects=True) as client:
        r = await client.get(url)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "lxml")
        for tag in soup(["script", "style", "nav", "footer"]):
            tag.decompose()
        return soup.get_text(separator=" ", strip=True)[:4000]


def _impressum_candidates(company_name: str, base_url: str | None) -> list[str]:
    urls = []
    if base_url:
        base = base_url.rstrip("/")
        urls += [f"{base}/impressum", f"{base}/imprint", f"{base}/contact", f"{base}/kontakt"]
    slug = company_name.lower().replace(" ", "-")
    slug2 = company_name.lower().replace(" ", "")
    urls += [
        f"https://www.{slug}.de/impressum",
        f"https://www.{slug2}.de/impressum",
        f"https://www.{slug}.com/impressum",
    ]
    return urls


def _about_candidates(company_name: str, base_url: str | None) -> list[str]:
    urls = []
    if base_url:
        base = base_url.rstrip("/")
        urls += [f"{base}/about", f"{base}/ueber-uns", f"{base}/about-us"]
    slug = company_name.lower().replace(" ", "-")
    urls += [
        f"https://www.{slug}.de/ueber-uns",
        f"https://www.{slug}.de/about",
        f"https://www.{slug}.com/about",
    ]
    return urls


async def _find_address(company_name: str, base_url: str | None) -> str | None:
    for url in _impressum_candidates(company_name, base_url):
        try:
            text = await _fetch_page(url)
            match = re.search(
                r"[\w\s\-]+(?:straße|strasse|str\.|weg|platz|allee|gasse|ring|damm)[^\n]{0,80}",
                text,
                re.IGNORECASE,
            )
            if match:
                return match.group(0).strip()
        except Exception:
            continue
    return None


async def _classify_tone(company_name: str, base_url: str | None, model: str) -> dict:
    page_text = ""
    for url in _about_candidates(company_name, base_url):
        try:
            page_text = await _fetch_page(url)
            break
        except Exception:
            continue

    prompt = f"Company: {company_name}\n\nWebsite text:\n{page_text or '(no page found)'}"
    import json
    raw = await generate(model, prompt, system=TONE_SYSTEM)
    try:
        return json.loads(raw.strip())
    except Exception:
        return {"tone": "direct", "reasoning": "Could not determine — defaulting to direct."}


async def research_company(company_name: str, model: str, company_url: str = "") -> dict:
    base_url = company_url.strip() or None
    address = await _find_address(company_name, base_url)
    tone_result = await _classify_tone(company_name, base_url, model)
    return {
        "company": company_name,
        "address": address or "",
        "tone": tone_result.get("tone", "direct"),
        "tone_reasoning": tone_result.get("reasoning", ""),
    }
