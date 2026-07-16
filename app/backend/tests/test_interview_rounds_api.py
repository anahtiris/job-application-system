def _make_app(client):
    r = client.post("/api/tracker/", json={
        "company": "Co", "job_title": "Eng", "language": "en",
        "job_description": "JD here",
    })
    assert r.status_code == 200
    return r.json()["id"]


def test_add_round_creates_empty_round_and_returns_list(client):
    app_id = _make_app(client)
    r = client.post(f"/api/tracker/{app_id}/interview-rounds", json={"round_type": "Screening"})
    assert r.status_code == 200
    body = r.json()
    assert len(body["rounds"]) == 1
    assert body["rounds"][0]["round_type"] == "Screening"
    assert body["rounds"][0]["prep"]["common_questions"] == []
    assert body["interview_date"] is None


def test_add_round_with_date_updates_derived_interview_date(client):
    app_id = _make_app(client)
    r = client.post(f"/api/tracker/{app_id}/interview-rounds", json={
        "round_type": "Screening", "date": "2026-08-01T10:00",
    })
    assert r.json()["interview_date"] == "2026-08-01T10:00"
    app = client.get(f"/api/tracker/{app_id}").json()
    assert app["interview_date"] == "2026-08-01T10:00"


def test_patch_round_updates_date_and_recomputes_interview_date(client):
    app_id = _make_app(client)
    add = client.post(f"/api/tracker/{app_id}/interview-rounds", json={
        "round_type": "Screening", "date": "2026-08-01T10:00",
    }).json()
    round_id = add["rounds"][0]["id"]
    r = client.patch(
        f"/api/tracker/{app_id}/interview-rounds/{round_id}",
        json={"date": "2026-09-01T10:00"},
    )
    assert r.status_code == 200
    assert r.json()["rounds"][0]["date"] == "2026-09-01T10:00"
    assert r.json()["interview_date"] == "2026-09-01T10:00"


def test_patch_round_notes_replaces_notes_for_that_round_only(client):
    app_id = _make_app(client)
    add = client.post(f"/api/tracker/{app_id}/interview-rounds", json={"round_type": "Screening"}).json()
    r1 = add["rounds"][0]["id"]
    add2 = client.post(f"/api/tracker/{app_id}/interview-rounds", json={"round_type": "Technical"}).json()
    r2 = add2["rounds"][1]["id"]

    notes = {"overview": "o", "red_flags": [], "salary": {"ask": "", "market": "", "floor": "", "notes": ""}, "notes": "n1", "my_q_state": {}}
    r = client.patch(f"/api/tracker/{app_id}/interview-rounds/{r1}/notes", json={"notes": notes})
    assert r.status_code == 200

    rounds = {x["id"]: x for x in r.json()["rounds"]}
    assert rounds[r1]["notes"]["notes"] == "n1"
    assert rounds[r2]["notes"]["notes"] == ""  # untouched


def test_delete_round_removes_it_and_recomputes_interview_date(client):
    app_id = _make_app(client)
    add = client.post(f"/api/tracker/{app_id}/interview-rounds", json={
        "round_type": "Screening", "date": "2026-08-01T10:00",
    }).json()
    round_id = add["rounds"][0]["id"]
    r = client.delete(f"/api/tracker/{app_id}/interview-rounds/{round_id}")
    assert r.status_code == 200
    assert r.json()["rounds"] == []
    assert r.json()["interview_date"] is None


def test_round_endpoints_404_for_missing_application(client):
    assert client.post("/api/tracker/nope/interview-rounds", json={"round_type": "Screening"}).status_code == 404
    assert client.patch("/api/tracker/nope/interview-rounds/x", json={"date": None}).status_code == 404
    assert client.delete("/api/tracker/nope/interview-rounds/x").status_code == 404


def test_patch_missing_round_id_404s(client):
    app_id = _make_app(client)
    r = client.patch(f"/api/tracker/{app_id}/interview-rounds/missing", json={"date": None})
    assert r.status_code == 404


def test_get_application_migrates_legacy_interview_data(client):
    app_id = _make_app(client)
    # Simulate a pre-rounds application: write legacy fields directly via the
    # DB, bypassing the API (no endpoint writes these fields anymore).
    from db import Application, engine
    from sqlmodel import Session
    import json
    with Session(engine) as session:
        app = session.get(Application, app_id)
        app.interview_prep_json = json.dumps({"salary": "90k", "common_questions": []})
        app.interview_notes_json = json.dumps({"notes": "legacy note"})
        app.interview_date = "2026-05-01T10:00"
        session.add(app)
        session.commit()

    r = client.get(f"/api/tracker/{app_id}")
    assert r.status_code == 200
    body = r.json()
    assert body["interview_rounds_json"] is not None
    rounds = json.loads(body["interview_rounds_json"])
    assert len(rounds) == 1
    assert rounds[0]["round_type"] == "Technical"
    assert rounds[0]["prep"]["salary"] == "90k"
    assert rounds[0]["notes"]["notes"] == "legacy note"

    # Migration must persist — a second GET (or the list endpoint) must see
    # the same round without needing legacy fields anymore.
    r2 = client.get("/api/tracker/")
    matching = next(a for a in r2.json() if a["id"] == app_id)
    assert matching["interview_rounds_json"] is not None
    assert json.loads(matching["interview_rounds_json"])[0]["prep"]["salary"] == "90k"
