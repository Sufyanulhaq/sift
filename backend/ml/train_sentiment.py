"""
Train Sift's sentiment model and write an honest report card.

Data: "Sentiment Labelled Sentences" (Kotzias et al., 2015), UCI Machine Learning
Repository, CC BY 4.0. 3,000 sentences from Amazon, Yelp and IMDb reviews, half
positive and half negative.

Model: TF-IDF word and word pair features with logistic regression. The strength of
regularisation is chosen by 5 fold cross validation on the training split only.

Evaluation: a held out 20 percent test split, stratified by source and label, and
the same test split scored by VADER (a well known rule based analyser) as a baseline.

Usage:
    uv run python ml/train_sentiment.py              downloads the data
    uv run python ml/train_sentiment.py --data DIR   uses a local copy of the folder
"""

from __future__ import annotations

import argparse
import io
import json
import time
import urllib.request
import zipfile
from datetime import UTC, datetime
from pathlib import Path

import joblib
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_recall_fscore_support,
)
from sklearn.model_selection import GridSearchCV, train_test_split
from sklearn.pipeline import Pipeline

URL = "https://archive.ics.uci.edu/static/public/331/sentiment+labelled+sentences.zip"
FILES = {"amazon": "amazon_cells_labelled.txt", "yelp": "yelp_labelled.txt", "imdb": "imdb_labelled.txt"}
OUT = Path(__file__).resolve().parents[1] / "models"
SEED = 13


def parse(lines: list[str], source: str) -> list[tuple[str, int, str]]:
    rows = []
    for line in lines:
        line = line.strip()
        if "\t" not in line:
            continue
        text, label = line.rsplit("\t", 1)
        if label.strip() in ("0", "1") and text.strip():
            rows.append((text.strip(), int(label), source))
    return rows


def load(data_dir: Path | None) -> list[tuple[str, int, str]]:
    rows: list[tuple[str, int, str]] = []
    if data_dir:
        for source, name in FILES.items():
            path = next(data_dir.rglob(name))
            rows += parse(path.read_text(encoding="utf-8", errors="replace").splitlines(), source)
        return rows
    with urllib.request.urlopen(URL, timeout=60) as resp:
        archive = zipfile.ZipFile(io.BytesIO(resp.read()))
    for source, name in FILES.items():
        member = next(m for m in archive.namelist() if m.endswith(name) and "__MACOSX" not in m)
        rows += parse(archive.read(member).decode("utf-8", errors="replace").splitlines(), source)
    return rows


def train(rows: list[tuple[str, int, str]], folds: int = 5):
    texts = [r[0] for r in rows]
    labels = np.array([r[1] for r in rows])
    sources = [r[2] for r in rows]
    strata = [f"{s}:{l}" for s, l in zip(sources, labels)]
    x_tr, x_te, y_tr, y_te, _s_tr, s_te = train_test_split(texts, labels, sources, test_size=0.2, random_state=SEED, stratify=strata)
    pipe = Pipeline(
        [
            ("tfidf", TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, min_df=1, token_pattern=r"(?u)\b\w[\w']*\b")),
            ("clf", LogisticRegression(max_iter=2000, class_weight="balanced")),
        ]
    )
    search = GridSearchCV(pipe, {"clf__C": [0.5, 1, 2, 4, 8, 16]}, cv=folds, scoring="f1", n_jobs=1)
    search.fit(x_tr, y_tr)
    model = search.best_estimator_
    pred = model.predict(x_te)
    return model, search, (x_te, y_te, s_te, pred), len(x_tr)


def vader_baseline(x_te: list[str]) -> np.ndarray:
    from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

    analyzer = SentimentIntensityAnalyzer()
    return np.array([1 if analyzer.polarity_scores(t)["compound"] >= 0 else 0 for t in x_te])


def report(y_te, pred, s_te) -> dict:
    p, r, f, _ = precision_recall_fscore_support(y_te, pred, labels=[0, 1], zero_division=0)
    return {
        "accuracy": round(float(accuracy_score(y_te, pred)), 4),
        "f1": round(float(f1_score(y_te, pred)), 4),
        "perClass": {
            "negative": {"precision": round(float(p[0]), 4), "recall": round(float(r[0]), 4), "f1": round(float(f[0]), 4)},
            "positive": {"precision": round(float(p[1]), 4), "recall": round(float(r[1]), 4), "f1": round(float(f[1]), 4)},
        },
        "confusion": confusion_matrix(y_te, pred, labels=[0, 1]).tolist(),
        "bySource": {
            src: round(float(accuracy_score(np.array(y_te)[[s == src for s in s_te]], np.array(pred)[[s == src for s in s_te]])), 4)
            for src in sorted(set(s_te))
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=Path, default=None)
    parser.add_argument("--out", type=Path, default=OUT)
    args = parser.parse_args()

    started = time.time()
    rows = load(args.data)
    model, search, (x_te, y_te, s_te, pred), n_train = train(rows)
    trained = report(y_te, pred, s_te)
    baseline = report(y_te, vader_baseline(x_te), s_te)

    # The examples the model gets wrong, so the report card shows real weaknesses.
    proba = model.predict_proba(x_te)[:, 1]
    wrong = [i for i in range(len(x_te)) if pred[i] != y_te[i]]
    wrong.sort(key=lambda i: -abs(proba[i] - 0.5))
    mistakes = [{"text": x_te[i], "label": int(y_te[i]), "confidence": round(float(max(proba[i], 1 - proba[i])), 3)} for i in wrong[:8]]

    version = datetime.now(UTC).strftime("%Y%m%d")
    info = {
        "version": version,
        "trainedAt": datetime.now(UTC).isoformat(timespec="seconds"),
        "algorithm": "TF-IDF (words and word pairs) + logistic regression",
        "chosenC": search.best_params_["clf__C"],
        "crossValidationF1": round(float(search.best_score_), 4),
        "data": {
            "name": "Sentiment Labelled Sentences",
            "citation": "Kotzias, D., Denil, M., de Freitas, N. and Smyth, P. (2015). From Group to Individual Labels using Deep Features. KDD.",
            "source": "UCI Machine Learning Repository",
            "license": "CC BY 4.0",
            "url": "https://archive.ics.uci.edu/dataset/331/sentiment+labelled+sentences",
            "rows": len(rows),
            "train": n_train,
            "test": len(x_te),
        },
        "test": trained,
        "baseline": {"name": "VADER (rule based)", **baseline},
        "mistakes": mistakes,
        "limitations": [
            "Trained on short single sentences; long reviews mixing praise and complaints get an averaged score.",
            "English only.",
            "Learned from 2,400 sentences, so rare words and new slang carry little signal.",
            "Labels are positive or negative; Sift calls scores near the middle neutral.",
        ],
        "seconds": round(time.time() - started, 1),
    }
    args.out.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, args.out / "sentiment.joblib", compress=3)
    (args.out / "sentiment.json").write_text(json.dumps(info, indent=2))
    print(json.dumps({"test": trained, "baseline": {k: baseline[k] for k in ("accuracy", "f1")}}, indent=2))


if __name__ == "__main__":
    main()
