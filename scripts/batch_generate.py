#!/usr/bin/env python3
"""Batch pipeline: research → generate → save drafts → review, for New applications.

Usage:
  python scripts/batch_generate.py              # process all New apps
  python scripts/batch_generate.py <app_id>     # process a specific app
"""

import sys
import json
import time
import requests

BASE = "http://localhost:8000"


def get_new_apps() -> list[dict]:
    r = requests.get(f"{BASE}/api/tracker/", timeout=10)
    r.raise_for_status()
    return [a for a in r.json() if a["status"] == "New"]


def get_app(app_id: str) -> dict:
    r = requests.get(f"{BASE}/api/tracker/{app_id}", timeout=10)
    r.raise_for_status()
    return r.json()


def research(company: str, company_url: str = "") -> dict:
    r = requests.post(
        f"{BASE}/api/application/research",
        json={"company": company, "company_url": company_url},
        timeout=60,
    )
    r.raise_for_status()
    return r.json()


def generate(app: dict, company_address: str) -> tuple[str, str]:
    """Stream SSE generation; return (resume_md, cl_md)."""
    body = {
        "application_id": app["id"],
        "job_description": app["job_description"],
        "company": app["company"],
        "company_tone": app["company_tone"],
        "company_address": company_address,
        "language": app["language"],
    }
    resume_md = ""
    cl_md = ""
    with requests.post(
        f"{BASE}/api/application/generate",
        json=body,
        stream=True,
        timeout=600,
    ) as resp:
        resp.raise_for_status()
        for raw in resp.iter_lines():
            if not raw:
                continue
            line = raw.decode("utf-8") if isinstance(raw, bytes) else raw
            if not line.startswith("data: "):
                continue
            payload = line[6:].strip()
            try:
                event = json.loads(payload)
            except json.JSONDecodeError:
                continue
            t = event.get("type")
            if t == "resume_done":
                resume_md = event.get("markdown", "")
                print("  ✓ resume draft done", flush=True)
            elif t == "cl_done":
                cl_md = event.get("markdown", "")
                print("  ✓ cover letter draft done", flush=True)
            elif t == "done":
                print("  ✓ generation complete", flush=True)
                break
            elif t == "error":
                raise RuntimeError(f"Generation error: {event.get('message')}")
    return resume_md, cl_md


def save_drafts(app_id: str, resume_md: str, cl_md: str) -> None:
    r = requests.put(
        f"{BASE}/api/application/drafts",
        json={"application_id": app_id, "resume_md": resume_md, "cover_letter_md": cl_md},
        timeout=30,
    )
    r.raise_for_status()


def review(app_id: str) -> dict:
    r = requests.post(
        f"{BASE}/api/application/review",
        json={"application_id": app_id},
        timeout=600,
    )
    r.raise_for_status()
    return r.json()


def run(app_id: str) -> None:
    print(f"\n{'='*60}", flush=True)
    app = get_app(app_id)
    print(f"Processing: {app['company']} — {app['job_title']}", flush=True)

    # 1. Research
    print("→ Researching company…", flush=True)
    res = research(app["company"])
    address = res.get("address", "")
    tone = res.get("tone", app["company_tone"])
    print(f"  address: {address or '(none found)'}", flush=True)
    print(f"  tone:    {tone}", flush=True)

    # 2. Generate
    print("→ Generating documents…", flush=True)
    t0 = time.time()
    resume_md, cl_md = generate(app, address)
    print(f"  generation took {time.time()-t0:.0f}s", flush=True)

    if not resume_md or not cl_md:
        # Fall back to reading from DB (generate saves them)
        print("  (reading drafts from DB…)", flush=True)
        app = get_app(app_id)
        resume_md = app.get("resume_draft_md", "")
        cl_md = app.get("cover_letter_draft_md", "")

    # 3. Save drafts / promote status → Draft
    print("→ Saving drafts…", flush=True)
    save_drafts(app_id, resume_md, cl_md)

    # 4. Review
    print("→ Running review…", flush=True)
    t0 = time.time()
    review(app_id)
    print(f"  review took {time.time()-t0:.0f}s", flush=True)
    print(f"✓ Done: {app['company']}", flush=True)


if __name__ == "__main__":
    if len(sys.argv) >= 2:
        run(sys.argv[1])
    else:
        apps = get_new_apps()
        if not apps:
            print("No New applications found.")
            sys.exit(0)
        print(f"Found {len(apps)} New application(s):")
        for a in apps:
            print(f"  • {a['company']} — {a['job_title']}")
        for a in apps:
            run(a["id"])
