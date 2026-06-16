from services.interview_schema import (
    InterviewPrep, GenInterviewPrep, with_ids, ensure_ids,
)


def test_gen_schema_omits_ids():
    schema = GenInterviewPrep.model_json_schema()
    qa = schema["$defs"]["GenQA"]["properties"]
    assert set(qa) == {"q", "a"}  # no id in the generation schema


def test_with_ids_assigns_ids_to_every_list_item():
    gen = {
        "company_analysis": "c", "introduction_script": "i",
        "common_questions": [{"q": "q1", "a": "a1"}],
        "job_specific_questions": [{"q": "q2", "a": "a2"}],
        "weak_spots": [{"q": "p", "a": "h"}],
        "questions_to_ask": [{"text": "t1"}],
        "salary": "s",
    }
    out = with_ids(gen)
    assert out["common_questions"][0]["id"]
    assert out["job_specific_questions"][0]["id"]
    assert out["weak_spots"][0]["id"]
    assert out["questions_to_ask"][0]["id"]
    assert out["common_questions"][0]["q"] == "q1"
    assert out["salary"] == "s"


def test_ensure_ids_fills_only_blank_ids():
    prep = InterviewPrep(
        common_questions=[{"id": "keep", "q": "q", "a": "a"}, {"id": "", "q": "q2", "a": ""}],
        questions_to_ask=[{"id": "", "text": "t"}],
    ).model_dump()
    out = ensure_ids(prep)
    assert out["common_questions"][0]["id"] == "keep"
    assert out["common_questions"][1]["id"]
    assert out["questions_to_ask"][0]["id"]


from services.providers.ollama import _build_payload


def test_build_payload_includes_format_when_given():
    p = _build_payload("m", "prompt", "sys", {"type": "object"})
    assert p["format"] == {"type": "object"}
    assert p["model"] == "m" and p["prompt"] == "prompt" and p["system"] == "sys"
    assert p["stream"] is False


def test_build_payload_omits_format_and_empty_system():
    p = _build_payload("m", "prompt", "", None)
    assert "format" not in p
    assert "system" not in p


from services.interview_parse import md_to_prep

SAMPLE_MD = """## Company Analysis
- Builds X
- Stage: Series A

## Introduction Script
Hi, I shipped Y.

## Common Questions
**Tell me about yourself**
I built Y at Z. It shipped to prod.
**Why this company**
You build X which I admire.

## Job-Specific Questions
1. How would you design a queue?
2. Explain GDPR handling.

## Weak Spots
**Likely probe:** "Do you know Kubernetes?"
**Honest answer:** "I've explored it recently in a side project."

## Questions to Ask
- What does the first 90 days look like?
- How are decisions made?

## Salary & Negotiation
Rough estimate €60-70k. I'd say: my range is 60-70k.
"""


def test_md_to_prep_parses_all_sections():
    p = md_to_prep(SAMPLE_MD)
    assert "Builds X" in p["company_analysis"]
    assert p["introduction_script"].startswith("Hi, I shipped Y")

    assert [q["q"] for q in p["common_questions"]] == ["Tell me about yourself", "Why this company"]
    assert "built Y at Z" in p["common_questions"][0]["a"]

    assert [q["q"] for q in p["job_specific_questions"]] == [
        "How would you design a queue?", "Explain GDPR handling.",
    ]
    assert all(q["a"] == "" for q in p["job_specific_questions"])

    assert p["weak_spots"][0]["q"] == "Do you know Kubernetes?"
    assert "explored it recently" in p["weak_spots"][0]["a"]

    assert [q["text"] for q in p["questions_to_ask"]] == [
        "What does the first 90 days look like?", "How are decisions made?",
    ]
    assert "Rough estimate" in p["salary"]
    for key in ("common_questions", "job_specific_questions", "weak_spots", "questions_to_ask"):
        assert all(item["id"] for item in p[key])


def test_md_to_prep_empty_input():
    p = md_to_prep("")
    assert p["common_questions"] == [] and p["company_analysis"] == ""


import json
import pytest


def _make_app(client):
    r = client.post("/api/tracker/", json={
        "company": "Co", "job_title": "Eng", "language": "en",
        "job_description": "JD here",
    })
    assert r.status_code == 200
    return r.json()["id"]


def test_put_interview_prep_stores_json_and_fills_ids(client):
    app_id = _make_app(client)
    body = {
        "company_analysis": "c", "introduction_script": "i",
        "common_questions": [{"id": "", "q": "q1", "a": "a1"}],
        "job_specific_questions": [], "weak_spots": [],
        "questions_to_ask": [{"id": "", "text": "t"}], "salary": "s",
    }
    r = client.put(f"/api/application/{app_id}/interview-prep", json=body)
    assert r.status_code == 200
    prep = r.json()["prep"]
    assert prep["common_questions"][0]["id"]
    assert prep["questions_to_ask"][0]["id"]

    app = client.get(f"/api/tracker/{app_id}").json()
    assert app["interview_prep_md"] is None
    assert json.loads(app["interview_prep_json"])["salary"] == "s"


def test_post_interview_prep_persists_generated_dict(client, monkeypatch, tmp_path):
    import services.interview as interview
    import routers.application as app_router

    async def fake_gen(**kwargs):
        return {
            "company_analysis": "c", "introduction_script": "i",
            "common_questions": [{"id": "x", "q": "q1", "a": "a1"}],
            "job_specific_questions": [], "weak_spots": [],
            "questions_to_ask": [], "salary": "s",
        }

    master = tmp_path / "m.md"
    master.write_text("# CV", encoding="utf-8")
    monkeypatch.setattr(interview, "generate_interview_prep", fake_gen)
    monkeypatch.setattr(app_router, "_master", lambda lang: master)

    app_id = _make_app(client)
    r = client.post("/api/application/interview-prep", json={
        "application_id": app_id, "interview_round": "Technical",
        "interviewer_type": "Hiring Manager", "focus_skills": "",
    })
    assert r.status_code == 200
    assert r.json()["common_questions"][0]["q"] == "q1"

    stored = json.loads(client.get(f"/api/tracker/{app_id}").json()["interview_prep_json"])
    assert stored["salary"] == "s"


@pytest.mark.asyncio
async def test_generate_interview_prep_returns_dict_with_ids(tmp_path, monkeypatch):
    import services.interview as interview

    captured = {}

    async def fake_generate(model, prompt, system="", fmt=None):
        captured["fmt"] = fmt
        return json.dumps({
            "company_analysis": "c",
            "introduction_script": "i",
            "common_questions": [{"q": "q1", "a": "a1"}],
            "job_specific_questions": [{"q": "q2", "a": "- bullet"}],
            "weak_spots": [{"q": "p", "a": "h"}],
            "questions_to_ask": [{"text": "t1"}],
            "salary": "s",
        })

    monkeypatch.setattr(interview, "generate", fake_generate)
    master = tmp_path / "resume_master.md"
    master.write_text("# CV", encoding="utf-8")

    prep = await interview.generate_interview_prep(
        master_path=master, job_description="JD", company_name="Co",
        company_tone="direct", language="en", interview_round="Technical",
        interviewer_type="Hiring Manager", focus_skills="", model="ollama/x",
    )

    assert captured["fmt"]["type"] == "object"
    assert prep["common_questions"][0]["id"]
    assert prep["job_specific_questions"][0]["a"] == "- bullet"
    assert prep["salary"] == "s"


def test_get_application_converts_legacy_md(client):
    app_id = _make_app(client)
    # seed legacy markdown directly via the in-memory engine
    import db
    from sqlmodel import Session
    from db import Application
    with Session(db.engine) as s:
        row = s.get(Application, app_id)
        row.interview_prep_md = SAMPLE_MD
        s.add(row)
        s.commit()

    app = client.get(f"/api/tracker/{app_id}").json()
    assert app["interview_prep_md"] is None
    prep = json.loads(app["interview_prep_json"])
    assert [q["q"] for q in prep["common_questions"]] == ["Tell me about yourself", "Why this company"]

    # list endpoint also returns converted json
    listed = next(a for a in client.get("/api/tracker/").json() if a["id"] == app_id)
    assert listed["interview_prep_json"] is not None
