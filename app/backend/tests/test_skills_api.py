import json

import services.skill_extractor as se
import routers.resume as resume


def _seed_skills(path, skills):
    path.write_text(json.dumps({"last_updated": "2026-01-01", "skills": skills}), encoding="utf-8")


def test_merge_endpoint_keeps_existing_edits(client, tmp_path, monkeypatch):
    skills_file = tmp_path / "skills.json"
    _seed_skills(skills_file, {"TypeScript": {"tier": 1, "evidence": "mine"}})
    monkeypatch.setattr(resume, "SKILLS", skills_file)

    r = client.post("/api/resume/skills/merge", json={
        "skills": {"TypeScript": {"tier": 4, "evidence": "guess"}, "React": {"tier": 2, "evidence": "y"}}
    })
    assert r.status_code == 200
    out = r.json()["skills"]
    assert out["TypeScript"] == {"tier": 1, "evidence": "mine"}  # kept
    assert out["React"]["tier"] == 2                              # added


def test_extract_404_without_resume(client, tmp_path, monkeypatch):
    monkeypatch.setattr(resume, "MASTER_EN", tmp_path / "none_en.md")
    monkeypatch.setattr(resume, "MASTER_DE", tmp_path / "none_de.md")
    assert client.post("/api/resume/skills/extract").status_code == 404


def test_extract_merges_into_existing(client, tmp_path, monkeypatch):
    master = tmp_path / "master.md"
    master.write_text("# Experience\nBuilt things in Python.", encoding="utf-8")
    monkeypatch.setattr(resume, "MASTER_EN", master)
    skills_file = tmp_path / "skills.json"
    _seed_skills(skills_file, {"TypeScript": {"tier": 1, "evidence": "mine"}})
    monkeypatch.setattr(resume, "SKILLS", skills_file)

    async def fake_extract(master_md, existing, model):
        return {"Python": {"tier": 3, "evidence": "side project", "needs_review": True}}
    monkeypatch.setattr(se, "extract_skills", fake_extract)

    out = client.post("/api/resume/skills/extract").json()["skills"]
    assert out["TypeScript"]["tier"] == 1          # preserved
    assert out["Python"]["needs_review"] is True   # added + flagged
    saved = json.loads(skills_file.read_text())["skills"]
    assert "Python" in saved


def test_put_skills_persists_payload_verbatim(client, tmp_path, monkeypatch):
    skills_file = tmp_path / "skills.json"
    monkeypatch.setattr(resume, "SKILLS", skills_file)
    client.put("/api/resume/skills", json={
        "skills": {"Go": {"tier": 3, "evidence": "e", "needs_review": True}}
    })
    saved = json.loads(skills_file.read_text())["skills"]
    assert saved["Go"]["needs_review"] is True  # full-replace keeps the flag the client sent
