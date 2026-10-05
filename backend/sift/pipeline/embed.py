"""
Turn texts into vectors. Two interchangeable embedders:

* OnnxEmbedder: a small pretrained sentence model (all-MiniLM-L6-v2) run with
  ONNX on the CPU through fastembed. Best quality; needs the model files.
* LsaEmbedder: TF-IDF followed by truncated SVD (latent semantic analysis),
  fitted on the uploaded texts. No download, works anywhere.

Both return L2 normalised float32 vectors, so a dot product is cosine similarity.
"""

from __future__ import annotations

import logging
import os
from typing import Protocol

import numpy as np
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer

log = logging.getLogger(__name__)


def _normalise(x: np.ndarray) -> np.ndarray:
    x = np.asarray(x, dtype=np.float32)
    norms = np.linalg.norm(x, axis=1, keepdims=True)
    norms[norms == 0] = 1
    return x / norms


class Embedder(Protocol):
    name: str

    def fit_transform(self, texts: list[str]) -> np.ndarray: ...

    def transform(self, texts: list[str]) -> np.ndarray: ...


class LsaEmbedder:
    name = "lsa"

    def __init__(self, dims: int = 128, seed: int = 7):
        self.dims = dims
        self.seed = seed
        self.vectorizer: TfidfVectorizer | None = None
        self.svd: TruncatedSVD | None = None

    def fit_transform(self, texts: list[str]) -> np.ndarray:
        self.vectorizer = TfidfVectorizer(
            stop_words="english", ngram_range=(1, 2), min_df=2 if len(texts) >= 50 else 1, sublinear_tf=True, max_features=30_000
        )
        tfidf = self.vectorizer.fit_transform(texts)
        dims = max(2, min(self.dims, tfidf.shape[1] - 1, len(texts) - 1))
        self.svd = TruncatedSVD(n_components=dims, random_state=self.seed)
        return _normalise(self.svd.fit_transform(tfidf))

    def transform(self, texts: list[str]) -> np.ndarray:
        if self.vectorizer is None or self.svd is None:
            raise RuntimeError("fit_transform must run first")
        return _normalise(self.svd.transform(self.vectorizer.transform(texts)))


class OnnxEmbedder:
    name = "minilm"

    def __init__(self, model: str = "sentence-transformers/all-MiniLM-L6-v2"):
        from fastembed import TextEmbedding  # optional dependency

        self.model = TextEmbedding(model_name=model, cache_dir=os.environ.get("SIFT_MODEL_CACHE"))

    def fit_transform(self, texts: list[str]) -> np.ndarray:
        return self.transform(texts)

    def transform(self, texts: list[str]) -> np.ndarray:
        return _normalise(np.array(list(self.model.embed(texts, batch_size=64))))


_onnx: OnnxEmbedder | None = None
_onnx_failed = False


def get_embedder(prefer: str | None = None) -> Embedder:
    """The ONNX model when it is installed and loads, otherwise LSA."""
    global _onnx, _onnx_failed
    choice = (prefer or os.environ.get("SIFT_EMBEDDER", "auto")).lower()
    if choice in ("auto", "minilm") and not _onnx_failed:
        try:
            if _onnx is None:
                _onnx = OnnxEmbedder()
            return _onnx
        except Exception as err:  # noqa: BLE001  any failure means fall back to LSA
            _onnx_failed = True
            log.warning("ONNX embedder unavailable, using LSA: %s", err)
    return LsaEmbedder()
