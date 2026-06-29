import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine


@pytest.fixture
def client(monkeypatch):
    """A TestClient backed by a fresh in-memory DB, isolated per test.

    A StaticPool keeps the single in-memory connection alive across requests so
    rows persist within a test. We override get_session rather than touching the
    real app.db, and never enter the app lifespan (which would migrate app.db).

    get_setting/set_setting (and config.model(), which calls get_setting) read the
    module-level db.engine directly rather than the injected session, so it must
    also point at the in-memory engine or those calls hit the real app.db."""
    import db  # registers JobLead/Application/Setting on SQLModel.metadata
    from main import app

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    monkeypatch.setattr(db, "engine", engine)

    def override_get_session():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[db.get_session] = override_get_session
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


@pytest.fixture
def session(client):
    """A SQLModel Session sharing the same in-memory DB as the client fixture.

    Must be requested alongside client so client runs first and patches db.engine.
    Yields a single session for direct DB manipulation in tests."""
    import db

    with Session(db.engine) as s:
        yield s
