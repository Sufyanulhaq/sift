"""Weekly volume per topic, and spikes: a week well above that topic's usual level."""

from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta

import numpy as np


def week_start(d: date) -> date:
    return d - timedelta(days=d.weekday())


def weekly(dates: list[date | None], labels: np.ndarray, sentiment: np.ndarray) -> dict:
    points = [(week_start(d), int(l), float(s)) for d, l, s in zip(dates, labels, sentiment) if d is not None]
    if len(points) < 10:
        return {"weeks": [], "series": {}, "sentiment": [], "spikes": []}
    first = min(p[0] for p in points)
    last = max(p[0] for p in points)
    weeks = []
    cursor = first
    while cursor <= last and len(weeks) < 260:
        weeks.append(cursor)
        cursor += timedelta(days=7)
    index = {w: i for i, w in enumerate(weeks)}
    series: dict[int, list[int]] = defaultdict(lambda: [0] * len(weeks))
    sentiment_sum = [0.0] * len(weeks)
    count = [0] * len(weeks)
    for w, topic, s in points:
        if w not in index:
            continue
        i = index[w]
        series[topic][i] += 1
        sentiment_sum[i] += s
        count[i] += 1
    return {
        "weeks": [w.isoformat() for w in weeks],
        "series": {str(k): v for k, v in sorted(series.items()) if k >= 0},
        "sentiment": [round(s / c, 3) if c else None for s, c in zip(sentiment_sum, count)],
        "spikes": spikes(weeks, series),
    }


def spikes(weeks: list[date], series: dict[int, list[int]], min_count: int = 5, z: float = 2.5) -> list[dict]:
    """A week counts as a spike when it is at least `z` standard deviations above
    the topic's earlier weeks and has at least `min_count` items."""
    found = []
    for topic, counts in series.items():
        if topic < 0:
            continue
        arr = np.array(counts, dtype=float)
        for i in range(4, len(arr)):
            history = arr[max(0, i - 8) : i]
            mean, std = history.mean(), max(history.std(), 1.0)
            if arr[i] >= min_count and (arr[i] - mean) / std >= z:
                found.append({"topic": topic, "week": weeks[i].isoformat(), "count": int(arr[i]), "usual": round(float(mean), 1)})
    return sorted(found, key=lambda s: -s["count"])[:10]
