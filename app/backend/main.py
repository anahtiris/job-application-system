import tomllib
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from db import create_db
from routers import application, leads, resume, settings, tracker, trash

BASE_DIR = Path(__file__).parent.parent.parent  # repo root

with open(Path(__file__).parent / "config.toml", "rb") as f:
    config = tomllib.load(f)


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db()
    yield


app = FastAPI(title="Job Application System", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3003"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(resume.router, prefix="/api/resume", tags=["resume"])
app.include_router(application.router, prefix="/api/application", tags=["application"])
app.include_router(tracker.router, prefix="/api/tracker", tags=["tracker"])
app.include_router(settings.router, prefix="/api/settings", tags=["settings"])
app.include_router(leads.router, prefix="/api/leads", tags=["leads"])
app.include_router(trash.router, prefix="/api/trash", tags=["trash"])


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    origin = request.headers.get("origin", "")
    headers = {}
    if origin:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
    return JSONResponse(status_code=500, content={"detail": str(exc)}, headers=headers)

# Serve generated PDFs as static files
pdf_dir = BASE_DIR / config["paths"]["applications_dir"]
pdf_dir.mkdir(parents=True, exist_ok=True)
app.mount("/files", StaticFiles(directory=str(pdf_dir)), name="files")


@app.get("/api/health")
def health():
    return {"status": "ok"}
