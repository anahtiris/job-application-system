"""Integration tests for the leads funnel and soft-delete/trash behavior.

These hit the real routers through a TestClient against an in-memory DB; only
the LLM-driven endpoints (extract/analyze) are left out as they need a model."""


def test_from_text_creates_captured_lead(client):
    r = client.post("/api/leads/from-text", json={"text": "A job posting", "source_url": "u/1"})
    assert r.status_code == 200
    lead_id = r.json()["id"]

    leads = client.get("/api/leads/").json()
    assert [l["id"] for l in leads] == [lead_id]
    assert leads[0]["status"] == "captured"


def test_from_text_dedupes_by_source_url(client):
    body = {"text": "posting", "source_url": "u/1"}
    first = client.post("/api/leads/from-text", json=body).json()
    second = client.post("/api/leads/from-text", json=body).json()

    assert second.get("duplicate") is True
    assert second["id"] == first["id"]
    assert len(client.get("/api/leads/").json()) == 1


def test_soft_delete_hides_from_list_but_keeps_in_trash(client):
    lead_id = client.post("/api/leads/from-text", json={"text": "x", "source_url": "u/1"}).json()["id"]

    client.delete(f"/api/leads/{lead_id}")

    assert client.get("/api/leads/").json() == []
    trash = client.get("/api/trash/").json()
    assert any(l["id"] == lead_id for l in trash["leads"])


def test_restore_brings_a_soft_deleted_lead_back(client):
    lead_id = client.post("/api/leads/from-text", json={"text": "x", "source_url": "u/1"}).json()["id"]
    client.delete(f"/api/leads/{lead_id}")

    client.post(f"/api/trash/leads/{lead_id}/restore")

    assert any(l["id"] == lead_id for l in client.get("/api/leads/").json())


def test_rejected_lead_does_not_block_recapturing_same_url(client):
    first = client.post("/api/leads/from-text", json={"text": "x", "source_url": "u/1"}).json()["id"]
    client.post(f"/api/leads/{first}/reject")

    second = client.post("/api/leads/from-text", json={"text": "y", "source_url": "u/1"}).json()

    assert second.get("duplicate") is not True
    assert second["id"] != first


def test_approve_creates_linked_application_and_is_idempotent(client):
    lead = client.post(
        "/api/leads/",
        json={
            "company": "Acme",
            "job_title": "Engineer",
            "language": "en",
            "job_description": "Build things",
            "source_url": "u/1",
        },
    ).json()

    app_id = client.post(f"/api/leads/{lead['id']}/approve").json()["application_id"]
    assert app_id

    refreshed = client.get(f"/api/leads/{lead['id']}").json()
    assert refreshed["status"] == "approved"
    assert refreshed["application_id"] == app_id

    # Re-approving returns the same application rather than creating a second one.
    assert client.post(f"/api/leads/{lead['id']}/approve").json()["application_id"] == app_id

    application = client.get(f"/api/tracker/{app_id}").json()
    assert application["company"] == "Acme"
    assert application["status"] == "New"
