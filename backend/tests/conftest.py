import os
from pathlib import Path

import pytest

# Tests use the LSA embedder so they run offline, fast and the same everywhere.
os.environ.setdefault("SIFT_EMBEDDER", "lsa")
os.environ.pop("ANTHROPIC_API_KEY", None)

SAMPLE = Path(__file__).resolve().parents[2] / "samples" / "hearth-and-oak-reviews.csv"


@pytest.fixture(scope="session")
def sample_bytes() -> bytes:
    return SAMPLE.read_bytes()


@pytest.fixture(scope="session")
def sample_analysis(sample_bytes):
    from sift.analysis import run
    from sift.pipeline.embed import LsaEmbedder
    from sift.pipeline.ingest import read_csv

    return run(read_csv(sample_bytes), embedder=LsaEmbedder())
