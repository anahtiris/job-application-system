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
