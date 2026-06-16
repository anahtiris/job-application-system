"""One-time legacy conversion of `interview_prep_md` markdown into the
structured `InterviewPrep` shape. NOT used on any generation path."""
import re
from uuid import uuid4


def _section(md: str, heading: str) -> str:
    esc = re.escape(heading)
    m = re.search(rf"##\s*{esc}[^\n]*\n(.*?)(?=\n##\s|\Z)", md, re.S)
    return m.group(1).strip() if m else ""


def _qid() -> str:
    return uuid4().hex


def _parse_qa_bold(body: str) -> list[dict]:
    """Bold question line, then following lines accumulate into the answer."""
    items: list[dict] = []
    cur: dict | None = None
    for raw in body.splitlines():
        line = raw.strip()
        if not line:
            continue
        m = re.match(r"^(?:\d+\.\s*)?\*\*(.+?)\*\*:?\s*(.*)$", line)
        if m:
            if cur:
                items.append(cur)
            cur = {"id": _qid(), "q": m.group(1).strip(), "a": m.group(2).strip()}
        elif cur is not None:
            cur["a"] = (cur["a"] + " " + line).strip()
    if cur:
        items.append(cur)
    return items


def _parse_numbered(body: str) -> list[dict]:
    items: list[dict] = []
    for line in body.splitlines():
        m = re.match(r"^\s*\d+\.\s+(.*)$", line)
        if m:
            q = re.sub(r"\*\*", "", m.group(1)).strip()
            if q:
                items.append({"id": _qid(), "q": q, "a": ""})
    return items


def _parse_weak(body: str) -> list[dict]:
    items: list[dict] = []
    for chunk in re.split(r"(?=\*\*Likely probe:?\*\*)", body):
        pm = re.search(r"\*\*Likely probe:?\*\*\s*\"?(.+?)\"?\s*(?=\n|\*\*Honest)", chunk, re.S)
        if not pm:
            continue
        am = re.search(r"\*\*Honest answer:?\*\*\s*\"?(.+?)\"?\s*$", chunk.strip(), re.S)
        items.append({
            "id": _qid(),
            "q": pm.group(1).strip(),
            "a": am.group(1).strip() if am else "",
        })
    return items


def _parse_bullets(body: str) -> list[dict]:
    items: list[dict] = []
    for line in body.splitlines():
        m = re.match(r"^\s*[-*]\s+(.*)$", line)
        if m:
            t = re.sub(r"\*\*", "", m.group(1)).strip()
            if t:
                items.append({"id": _qid(), "text": t})
    return items


def md_to_prep(md: str) -> dict:
    md = md or ""
    return {
        "company_analysis": _section(md, "Company Analysis"),
        "introduction_script": _section(md, "Introduction Script"),
        "common_questions": _parse_qa_bold(_section(md, "Common Questions")),
        "job_specific_questions": _parse_numbered(_section(md, "Job-Specific Questions")),
        "weak_spots": _parse_weak(_section(md, "Weak Spots")),
        "questions_to_ask": _parse_bullets(_section(md, "Questions to Ask")),
        "salary": _section(md, "Salary & Negotiation"),
    }
