"""Semantic search over one analysis, held in memory. No vector database needed:
for tens of thousands of rows a matrix product is fast enough."""

from __future__ import annotations

import numpy as np


def search(query_vector: np.ndarray, vectors: np.ndarray, limit: int = 20, floor: float = 0.15) -> list[tuple[int, float]]:
    scores = vectors @ query_vector.reshape(-1)
    order = np.argsort(-scores)[:limit]
    return [(int(i), float(scores[i])) for i in order if scores[i] >= floor]
