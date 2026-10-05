"""
Analyses held in memory, never in a database. Each job lives for a fixed time and
the oldest are dropped when there are too many. The browser keeps its own copy of
the result, so a server restart only loses search for that analysis.
"""

from __future__ import annotations

import asyncio
import secrets
import threading
import time
from dataclasses import dataclass, field

from .analysis import Analysis


@dataclass
class Job:
    id: str
    created: float
    events: list[dict] = field(default_factory=list)
    status: str = "running"  # running | done | failed
    error: str | None = None
    analysis: Analysis | None = None
    changed: asyncio.Event | None = None
    loop: asyncio.AbstractEventLoop | None = None

    def emit(self, event: dict) -> None:
        self.events.append(event)
        if self.changed is not None and self.loop is not None:
            self.loop.call_soon_threadsafe(self.changed.set)


class JobStore:
    def __init__(self, ttl_seconds: int = 1800, max_jobs: int = 50):
        self.ttl = ttl_seconds
        self.max_jobs = max_jobs
        self._jobs: dict[str, Job] = {}
        self._lock = threading.Lock()

    def create(self, loop: asyncio.AbstractEventLoop | None = None) -> Job:
        self.sweep()
        job = Job(id=secrets.token_urlsafe(12), created=time.time(), changed=asyncio.Event() if loop else None, loop=loop)
        with self._lock:
            if len(self._jobs) >= self.max_jobs:
                oldest = min(self._jobs.values(), key=lambda j: j.created)
                self._jobs.pop(oldest.id, None)
            self._jobs[job.id] = job
        return job

    def get(self, job_id: str) -> Job | None:
        with self._lock:
            job = self._jobs.get(job_id)
        if job and time.time() - job.created > self.ttl:
            with self._lock:
                self._jobs.pop(job_id, None)
            return None
        return job

    def sweep(self) -> None:
        now = time.time()
        with self._lock:
            for job_id in [j.id for j in self._jobs.values() if now - j.created > self.ttl]:
                self._jobs.pop(job_id, None)

    def running(self) -> int:
        with self._lock:
            return sum(1 for j in self._jobs.values() if j.status == "running")
