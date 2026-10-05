"""
Sentiment for each piece of feedback, as a score from -1 (negative) to 1 (positive)
and a label.

The main model is trained by ml/train_sentiment.py (TF-IDF features and logistic
regression) and saved to models/sentiment.joblib. Until that file exists, or if it
fails to load, VADER, a well known rule based analyser, is used instead. The
response always says which one produced the scores.
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from pathlib import Path

import numpy as np

log = logging.getLogger(__name__)

MODEL_DIR = Path(os.environ.get("SIFT_MODEL_DIR", Path(__file__).resolve().parents[2] / "models"))
NEUTRAL_BAND = 0.2  # scores between -0.2 and 0.2 are labelled neutral


@dataclass
class SentimentResult:
    scores: np.ndarray  # -1..1
    labels: list[str]
    model: str


def label_for(score: float) -> str:
    if score > NEUTRAL_BAND:
        return "positive"
    if score < -NEUTRAL_BAND:
        return "negative"
    return "neutral"


class TrainedModel:
    def __init__(self, path: Path):
        import joblib

        self.pipeline = joblib.load(path)
        meta = path.with_suffix(".json")
        self.info = json.loads(meta.read_text()) if meta.exists() else {}
        self.name = f"trained:{self.info.get('version', 'local')}"

    def score(self, texts: list[str]) -> np.ndarray:
        proba = self.pipeline.predict_proba(texts)[:, list(self.pipeline.classes_).index(1)]
        return (proba * 2 - 1).astype(np.float32)


class VaderModel:
    name = "vader"

    def __init__(self):
        from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

        self.analyzer = SentimentIntensityAnalyzer()

    def score(self, texts: list[str]) -> np.ndarray:
        return np.array([self.analyzer.polarity_scores(t)["compound"] for t in texts], dtype=np.float32)


_model = None


def get_model():
    global _model
    if _model is None:
        path = MODEL_DIR / "sentiment.joblib"
        if path.exists():
            try:
                _model = TrainedModel(path)
            except Exception as err:  # noqa: BLE001  a broken model file must not stop analyses
                log.warning("Could not load the trained model, using VADER: %s", err)
        if _model is None:
            _model = VaderModel()
    return _model


def reset_model() -> None:
    global _model
    _model = None


def analyse(texts: list[str]) -> SentimentResult:
    model = get_model()
    scores = np.clip(model.score(texts), -1, 1)
    return SentimentResult(scores=scores, labels=[label_for(float(s)) for s in scores], model=model.name)
