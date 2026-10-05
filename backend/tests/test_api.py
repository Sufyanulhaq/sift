import json

import pytest
from fastapi.testclient import TestClient

from sift import main


@pytest.fixture(scope="module")
def client():
    with TestClient(main.app) as c:
        yield c


@pytest.fixture(autouse=True)
def reset_limits():
    main._hits.clear()


def follow(client, job_id):
    events = []
    with client.stream("GET", f"/api/jobs/{job_id}/events") as resp:
        assert resp.headers["content-type"].startswith("text/event-stream")
        for line in resp.iter_lines():
            if line.startswith("data: "):
                event = json.loads(line[6:])
                events.append(event)
                if event["type"] in ("done", "error"):
                    break
    return events


def test_health_and_samples(client):
    assert client.get("/api/health").json()["ok"] is True
    assert "hearth-and-oak-reviews.csv" in client.get("/api/samples").json()["samples"]


def test_sample_analysis_streams_steps_then_result_then_search(client):
    start = client.post("/api/analyze/sample/hearth-and-oak-reviews.csv")
    assert start.status_code == 202
    job = start.json()
    assert [s["id"] for s in job["steps"]] == ["clean", "sentiment", "embed", "topics", "trends", "summary"]

    events = follow(client, job["jobId"])
    done_steps = [e["step"] for e in events if e.get("status") == "done"]
    assert done_steps == ["clean", "sentiment", "embed", "topics", "trends", "summary"]
    assert events[-1]["type"] == "done"

    result = client.get(f"/api/jobs/{job['jobId']}").json()
    assert result["meta"]["rows"] == 1400 and result["topics"]

    found = client.post(f"/api/jobs/{job['jobId']}/search", json={"query": "app keeps crashing at checkout"}).json()
    ids = {r["id"] for r in found["results"]}
    texts = [r["text"].lower() for r in result["reviews"] if r["id"] in ids]
    assert sum("app" in t or "checkout" in t for t in texts) >= len(texts) * 0.6


def test_upload_and_texts(client):
    rows = "\n".join(f"{i},The chair {i} arrived broken and late" if i % 2 else f"{i},Lovely oak chair {i}, very sturdy" for i in range(40))
    up = client.post("/api/analyze", files={"file": ("f.csv", "id,comment\n" + rows, "text/csv")})
    assert up.status_code == 202
    assert follow(client, up.json()["jobId"])[-1]["type"] == "done"

    texts = client.post("/api/analyze/texts", json={"texts": [f"Great table number {i}" for i in range(12)]})
    assert texts.status_code == 202


def test_bad_input_gets_clear_errors(client):
    assert client.post("/api/analyze", files={"file": ("f.csv", "id,comment\n1,hi\n", "text/csv")}).status_code == 400
    big = "text\n" + ("x" * 100 + "\n") * 60_000
    assert client.post("/api/analyze", files={"file": ("f.csv", big, "text/csv")}).status_code == 413
    assert client.post("/api/analyze/texts", json={"texts": ["one"]}).status_code == 422
    assert client.post("/api/analyze/sample/..%2F..%2Fsift%2Fmain.py").status_code == 404
    assert client.post("/api/analyze/sample/nope.csv").status_code == 404
    assert client.get("/api/jobs/missing").status_code == 404


def test_rate_limit(client):
    codes = [client.post("/api/analyze/texts", json={"texts": ["x"]}).status_code for _ in range(8)]
    assert 429 in codes


def test_model_card_endpoint(client):
    body = client.get("/api/model").json()
    assert body["name"]
