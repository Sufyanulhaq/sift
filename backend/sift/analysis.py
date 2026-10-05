"""Run the whole pipeline, reporting each step as it finishes."""

from __future__ import annotations

import time
from collections.abc import Callable

import numpy as np

from .pipeline import sentiment, summary, topics, trends
from .pipeline.embed import Embedder, get_embedder
from .pipeline.ingest import Ingested

STEPS = [
    ("clean", "Cleaning feedback"),
    ("sentiment", "Scoring sentiment"),
    ("embed", "Understanding meaning"),
    ("topics", "Finding topics"),
    ("trends", "Looking for trends"),
    ("summary", "Writing the summary"),
]

Report = Callable[[str, str, dict], None]


def _noop(step: str, status: str, detail: dict) -> None:
    pass


class Analysis:
    """The result, plus what search needs (the embedder and vectors), kept in memory."""

    def __init__(self, result: dict, embedder: Embedder, vectors: np.ndarray, texts: list[str]):
        self.result = result
        self.embedder = embedder
        self.vectors = vectors
        self.texts = texts


def run(data: Ingested, report: Report = _noop, embedder: Embedder | None = None, seed: int = 7) -> Analysis:
    started = time.perf_counter()
    rows = data.rows
    texts = [r.text for r in rows]
    n = len(rows)

    report("clean", "done", {"rows": n, "duplicates": data.dropped_duplicates, "empty": data.dropped_empty})

    report("sentiment", "running", {})
    sent = sentiment.analyse(texts)
    pos = float(np.mean([l == "positive" for l in sent.labels]))
    neg = float(np.mean([l == "negative" for l in sent.labels]))
    report("sentiment", "done", {"positive": round(pos, 3), "negative": round(neg, 3), "model": sent.model})

    report("embed", "running", {})
    embedder = embedder or get_embedder()
    vectors = embedder.fit_transform(texts)
    report("embed", "done", {"embedder": embedder.name, "dimensions": int(vectors.shape[1])})

    report("topics", "running", {})
    tm = topics.build(texts, vectors, seed)
    topic_ids = sorted(set(tm.labels.tolist()) - {topics.OUTLIER})
    report("topics", "done", {"topics": len(topic_ids), "method": tm.method})

    report("trends", "running", {})
    trend = trends.weekly([r.date for r in rows], tm.labels, sent.scores) if data.date_column else None
    report("trends", "done", {"weeks": len(trend["weeks"]) if trend else 0})

    report("summary", "running", {})
    facts = []
    for t in topic_ids:
        idx = np.where(tm.labels == t)[0]
        # Examples: the reviews closest to the topic's centre.
        centre = vectors[idx].mean(axis=0)
        closest = idx[np.argsort(-(vectors[idx] @ centre))[:5]]
        facts.append(
            summary.TopicFacts(
                id=t,
                keywords=tm.keywords.get(t, []),
                size=len(idx),
                share=len(idx) / n,
                sentiment=float(sent.scores[idx].mean()),
                negative_share=float(np.mean([sent.labels[i] == "negative" for i in idx])),
                examples=[(rows[i].id, rows[i].text) for i in closest],
            )
        )
    written = summary.write(facts, n, float(sent.scores.mean()), pos, neg)
    report("summary", "done", {"mode": written["mode"]})

    ratings = [(r.rating, s) for r, s in zip(rows, sent.scores) if r.rating is not None]
    agreement = None
    if len(ratings) >= 20:
        top = max(r for r, _ in ratings)
        scale = 10 if top > 5 else 5
        mid = scale / 2 + 0.5 if scale == 5 else scale / 2
        pairs = [(r > mid, s > 0) for r, s in ratings if abs(r - mid) >= 0.5 or scale == 10]
        if pairs:
            agreement = round(float(np.mean([a == b for a, b in pairs])), 3)

    topic_list = [
        {
            "id": f.id,
            "name": written["names"][f.id],
            "keywords": f.keywords,
            "size": f.size,
            "share": round(f.share, 4),
            "sentiment": round(f.sentiment, 3),
            "negativeShare": round(f.negative_share, 3),
            "examples": [rid for rid, _ in f.examples],
        }
        for f in facts
    ]
    drivers = sorted(
        (
            {"topic": f.id, "negative": round(f.negative_share * f.size), "share": round(f.negative_share * f.size / max(1, neg * n), 3)}
            for f in facts
        ),
        key=lambda d: -d["negative"],
    )

    result = {
        "meta": {
            "rows": n,
            "columns": data.columns,
            "textColumn": data.text_column,
            "dateColumn": data.date_column,
            "ratingColumn": data.rating_column,
            "duplicatesRemoved": data.dropped_duplicates,
            "emptyRemoved": data.dropped_empty,
            "notes": data.notes,
            "sentimentModel": sent.model,
            "embedder": embedder.name,
            "clustering": tm.method,
            "summaryMode": written["mode"],
            "seconds": round(time.perf_counter() - started, 2),
        },
        "overview": {
            "sentiment": round(float(sent.scores.mean()), 3),
            "positive": round(pos, 3),
            "negative": round(neg, 3),
            "neutral": round(1 - pos - neg, 3),
            "ratingAgreement": agreement,
            "unassigned": int(np.sum(tm.labels == topics.OUTLIER)),
        },
        "summary": {"text": written["text"], "citations": written["citations"]},
        "topics": topic_list,
        "drivers": drivers,
        "trends": trend,
        "reviews": [
            {
                "id": r.id,
                "text": r.text,
                "date": r.date.isoformat() if r.date else None,
                "rating": r.rating,
                "sentiment": round(float(s), 3),
                "label": l,
                "topic": int(t),
                "x": round(float(c[0]), 4),
                "y": round(float(c[1]), 4),
            }
            for r, s, l, t, c in zip(rows, sent.scores, sent.labels, tm.labels, tm.coords)
        ],
    }
    return Analysis(result, embedder, vectors, texts)
