from datetime import date, datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import text
from sqlmodel import Field, Session, SQLModel, create_engine

DATABASE_URL = "sqlite:///./app.db"
engine = create_engine(DATABASE_URL)


class Setting(SQLModel, table=True):
    key: str = Field(primary_key=True)
    value: str


def get_setting(key: str, default: str = "") -> str:
    with Session(engine) as session:
        s = session.get(Setting, key)
        return s.value if s else default


def set_setting(key: str, value: str) -> None:
    with Session(engine) as session:
        s = session.get(Setting, key)
        if s:
            s.value = value
        else:
            s = Setting(key=key, value=value)
        session.add(s)
        session.commit()


class JobLead(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    company: str = ""
    job_title: str = ""
    language: str = "en"
    job_description: str = ""
    raw_text: Optional[str] = None
    source_url: Optional[str] = None
    status: str = "new"           # captured | new | analyzing | analyzed | approved | rejected
    fit_score: Optional[int] = None
    fit_verdict: Optional[str] = None   # strong | maybe | skip
    fit_analysis_json: Optional[str] = None
    company_tone: Optional[str] = None
    company_research: Optional[str] = None
    application_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    deleted_at: Optional[datetime] = None


class Application(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    company: str
    job_title: str
    language: str  # 'en' | 'de'
    status: str = "Draft"  # Draft | Applied | Interview | Offer | Rejected
    date_applied: Optional[date] = None
    job_description: str
    source_url: Optional[str] = None  # job posting URL, carried over from the lead
    company_address: Optional[str] = None
    company_tone: Optional[str] = None  # direct | contractor | agency
    resume_draft_md: Optional[str] = None
    cover_letter_draft_md: Optional[str] = None
    resume_final_md: Optional[str] = None
    cover_letter_final_md: Optional[str] = None
    review_completed: bool = False
    resume_pdf_path: Optional[str] = None
    cover_letter_pdf_path: Optional[str] = None
    resume_docx_path: Optional[str] = None
    cover_letter_docx_path: Optional[str] = None
    notes: Optional[str] = None
    cover_letter_notes: Optional[str] = None
    interview_prep_md: Optional[str] = None
    interview_debrief_md: Optional[str] = None
    interview_date: Optional[str] = None
    interview_notes_json: Optional[str] = None
    fit_analysis_json: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    deleted_at: Optional[datetime] = None


def create_db():
    SQLModel.metadata.create_all(engine)
    # Safe migration for columns added after initial schema
    with engine.connect() as conn:
        for col_def in ["resume_docx_path TEXT", "cover_letter_docx_path TEXT", "cover_letter_notes TEXT", "interview_prep_md TEXT", "interview_debrief_md TEXT", "source_url TEXT", "interview_date TEXT", "interview_notes_json TEXT", "fit_analysis_json TEXT", "deleted_at DATETIME"]:
            try:
                conn.execute(text(f"ALTER TABLE application ADD COLUMN {col_def}"))
                conn.commit()
            except Exception:
                pass
        for col_def in ["raw_text TEXT", "deleted_at DATETIME"]:
            try:
                conn.execute(text(f"ALTER TABLE joblead ADD COLUMN {col_def}"))
                conn.commit()
            except Exception:
                pass
    # Seed model settings from config.toml if not already in DB
    import tomllib
    from pathlib import Path
    cfg_path = Path(__file__).parent / "config.toml"
    if cfg_path.exists():
        with open(cfg_path, "rb") as f:
            cfg = tomllib.load(f)
        for role in ("parser", "writer", "reviewer", "research"):
            key = f"model.{role}"
            if not get_setting(key):
                set_setting(key, cfg.get("models", {}).get(role, ""))


def get_session():
    with Session(engine) as session:
        yield session
