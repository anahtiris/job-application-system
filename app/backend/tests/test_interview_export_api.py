import routers.application as app_router


def _make_app(client):
    r = client.post("/api/tracker/", json={
        "company": "Acme", "job_title": "Engineer", "language": "en",
        "job_description": "Build things.",
    })
    assert r.status_code == 200
    return r.json()["id"]


def test_export_streams_pdf(client, monkeypatch, tmp_path):
    def fake_render(app, out_dir):
        p = tmp_path / "interview_prep.pdf"
        p.write_bytes(b"%PDF-1.4 fake body")
        return p

    monkeypatch.setattr(app_router, "render_interview_pdf", fake_render)

    app_id = _make_app(client)
    r = client.get(f"/api/application/{app_id}/interview-export.pdf")
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert "attachment" in r.headers["content-disposition"]
    assert r.content.startswith(b"%PDF")


def test_export_404_for_missing_app(client):
    r = client.get("/api/application/nope/interview-export.pdf")
    assert r.status_code == 404
