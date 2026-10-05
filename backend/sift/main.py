"""Sift API: upload feedback, follow the analysis live, then search it."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from . import analysis
from .jobs import JobStore
from .pipeline import search as search_mod
from .pipeline import sentiment
from .pipeline.embed import get_embedder
from .pipeline.ingest import IngestError, from_texts, read_csv

log = logging.getLogger("sift")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

MAX_UPLOAD = 5 * 1024 * 1024
MAX_RUNNING = int(os.environ.get("SIFT_MAX_RUNNING", "2"))
SAMPLES = Path(os.environ.get("SIFT_SAMPLES", Path(__file__).resolve().parents[2] / "samples"))


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Load the models once at start, not during the first visitor's analysis.
    sentiment.get_model()
    get_embedder()
    yield


app = FastAPI(
    title="Sift API",
    version="1.0.0",
    description="Customer feedback analysis: sentiment, topics, trends and grounded summaries.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.environ.get("SIFT_ALLOWED_ORIGINS", "http://localhost:3000").split(",") if o.strip()],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)
jobs = JobStore(ttl_seconds=int(os.environ.get("SIFT_JOB_TTL", "1800")))


# A small per address limiter: enough to stop one visitor hogging a free server.
_hits: dict[str, deque] = defaultdict(deque)


def _limit(request: Request, per_minute: int) -> None:
    key = (request.client.host if request.client else "unknown") + request.url.path.split("/")[2]
    now = time.time()
    q = _hits[key]
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= per_minute:
        raise HTTPException(429, "Too many requests. Wait a minute and try again.")
    q.append(now)


def limit(per_minute: int):
    """As a dependency, the limit is checked before the body is read or validated,
    so a flood of invalid requests is limited too."""

    def check(request: Request) -> None:
        _limit(request, per_minute)

    return Depends(check)


@app.exception_handler(IngestError)
async def ingest_error(_: Request, err: IngestError):
    return JSONResponse(status_code=400, content={"detail": str(err)})


class TextsIn(BaseModel):
    texts: list[str] = Field(min_length=10, max_length=20_000)


class SearchIn(BaseModel):
    query: str = Field(min_length=2, max_length=200)
    limit: int = Field(20, ge=1, le=100)


@app.get("/api/health")
def health():
    model = sentiment.get_model()
    return {"ok": True, "sentimentModel": model.name, "summary": "claude" if os.environ.get("ANTHROPIC_API_KEY") else "offline"}


@app.get("/api/model")
def model_card():
    """What the sentiment model is, how it was trained and how well it scores."""
    model = sentiment.get_model()
    info = getattr(model, "info", None)
    return {"name": model.name, "info": info}


@app.get("/api/samples")
def samples():
    return {"samples": sorted(p.name for p in SAMPLES.glob("*.csv"))}


async def _start(request: Request, ingested) -> dict:
    if jobs.running() >= MAX_RUNNING:
        raise HTTPException(503, "The server is busy with other analyses. Try again in a minute.")
    job = jobs.create(asyncio.get_running_loop())

    def report(step: str, status: str, detail: dict) -> None:
        job.emit({"type": "step", "step": step, "status": status, "detail": detail})

    def work() -> None:
        try:
            job.analysis = analysis.run(ingested, report)
            job.status = "done"
            job.emit({"type": "done"})
        except Exception:  # reported to the client, logged in full
            log.exception("analysis failed")
            job.status = "failed"
            job.error = "The analysis failed. Check the file and try again."
            job.emit({"type": "error", "message": job.error})

    asyncio.get_running_loop().run_in_executor(None, work)
    return {"jobId": job.id, "steps": [{"id": s, "label": label} for s, label in analysis.STEPS], "notes": ingested.notes}


@app.post("/api/analyze", status_code=202)
async def analyze_upload(
    request: Request,
    _: None = limit(6),
    file: UploadFile = File(...),
    text_column: str | None = Form(None),
    date_column: str | None = Form(None),
    rating_column: str | None = Form(None),
):
    data = await file.read(MAX_UPLOAD + 1)
    if len(data) > MAX_UPLOAD:
        raise HTTPException(413, "The file is larger than 5 MB.")
    ingested = read_csv(data, text_column or None, date_column or None, rating_column or None)
    return await _start(request, ingested)


@app.post("/api/analyze/texts", status_code=202)
async def analyze_texts(request: Request, body: TextsIn, _: None = limit(6)):
    return await _start(request, from_texts(body.texts))


@app.post("/api/analyze/sample/{name}", status_code=202)
async def analyze_sample(request: Request, name: str, _: None = limit(6)):
    path = SAMPLES / name
    if path.parent != SAMPLES or not path.name.endswith(".csv") or not path.exists():
        raise HTTPException(404, "No sample with that name.")
    return await _start(request, read_csv(path.read_bytes()))


def _job(job_id: str):
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(404, "That analysis has expired or does not exist. Run it again.")
    return job


@app.get("/api/jobs/{job_id}/events")
async def events(job_id: str):
    """Server sent events: one message per finished step, then done or error."""
    job = _job(job_id)

    async def stream():
        sent = 0
        while True:
            while sent < len(job.events):
                yield f"data: {json.dumps(job.events[sent])}\n\n"
                sent += 1
            if job.status != "running" and sent >= len(job.events):
                return
            job.changed.clear()
            try:
                await asyncio.wait_for(job.changed.wait(), timeout=15)
            except TimeoutError:
                yield ": keep alive\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.get("/api/jobs/{job_id}")
def result(job_id: str):
    job = _job(job_id)
    if job.status == "running":
        return JSONResponse(status_code=202, content={"status": "running", "events": job.events})
    if job.status == "failed":
        raise HTTPException(500, job.error)
    return job.analysis.result


@app.post("/api/jobs/{job_id}/search")
def search(job_id: str, body: SearchIn, _: None = limit(60)):
    job = _job(job_id)
    if job.status != "done":
        raise HTTPException(409, "The analysis has not finished yet.")
    a = job.analysis
    hits = search_mod.search(a.embedder.transform([body.query])[0], a.vectors, body.limit)
    reviews = a.result["reviews"]
    return {"query": body.query, "results": [{"id": reviews[i]["id"], "score": round(s, 3)} for i, s in hits]}
