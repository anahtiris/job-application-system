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
