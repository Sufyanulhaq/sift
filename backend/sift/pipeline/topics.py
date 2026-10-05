"""
Group feedback into topics and describe each one.

1. Cluster the embeddings. HDBSCAN finds clusters of any shape and leaves outliers
   unassigned; when it finds too little structure, k-means with the number of
   clusters picked by silhouette score is used instead.
2. Describe each cluster with class based TF-IDF (the idea behind BERTopic): words
   that are frequent in this cluster and rare in the others.
3. Project the embeddings to 2D for the topic map.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from sklearn.cluster import HDBSCAN, KMeans
from sklearn.decomposition import PCA
from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS, CountVectorizer
from sklearn.manifold import TSNE
from sklearn.metrics import silhouette_score

OUTLIER = -1


@dataclass
class TopicModel:
    labels: np.ndarray  # cluster per row, -1 for unassigned
    keywords: dict[int, list[str]]
    method: str
    coords: np.ndarray  # n x 2, scaled to 0..1


def cluster(vectors: np.ndarray, seed: int = 7) -> tuple[np.ndarray, str]:
    n = len(vectors)
    min_size = max(5, n // 60)
    labels = HDBSCAN(min_cluster_size=min_size, min_samples=max(3, min_size // 2), metric="euclidean", copy=True).fit_predict(vectors)
    found = len(set(labels) - {OUTLIER})
    noise = float(np.mean(labels == OUTLIER))
    if 3 <= found <= 30 and noise <= 0.45:
        return labels, "hdbscan"

    # Not enough structure for density clustering: choose k by silhouette, preferring
    # fewer topics. Silhouette tends to creep up with k, so take the smallest k whose
    # score is within 90 percent of the best one.
    sample = min(n, 3000)
    rng = np.random.default_rng(seed)
    idx = rng.choice(n, size=sample, replace=False) if n > sample else np.arange(n)
    fits = []
    distinct = len(np.unique(np.round(vectors, 5), axis=0))
    for k in range(min(3, distinct), min(12, max(4, n // 15), distinct) + 1):
        km = KMeans(n_clusters=k, n_init=4, random_state=seed).fit(vectors)
        fits.append((k, silhouette_score(vectors[idx], km.labels_[idx]), km.labels_))
    top = max(score for _, score, _ in fits)
    best = next(labels for k, score, labels in fits if score >= 0.9 * top)
    return np.asarray(best), "kmeans"


# Words that appear in feedback about anything, so they never describe a topic.
# The topic's mood is shown separately, which is why plain praise and blame are here too.
FILLER = {
    "also",
    "amazing",
    "arrived",
    "ask",
    "asking",
    "awful",
    "bad",
    "best",
    "better",
    "bit",
    "bought",
    "buy",
    "called",
    "came",
    "come",
    "could",
    "day",
    "days",
    "did",
    "does",
    "eight",
    "excellent",
    "feel",
    "feels",
    "felt",
    "fine",
    "five",
    "four",
    "gave",
    "get",
    "going",
    "good",
    "got",
    "great",
    "happy",
    "hour",
    "hours",
    "instead",
    "just",
    "like",
    "lot",
    "love",
    "loved",
    "lovely",
    "make",
    "made",
    "need",
    "needed",
    "nice",
    "nine",
    "one",
    "people",
    "perfect",
    "poor",
    "really",
    "right",
    "said",
    "says",
    "send",
    "sent",
    "seven",
    "six",
    "still",
    "take",
    "ten",
    "terrible",
    "thing",
    "things",
    "three",
    "time",
    "times",
    "took",
    "two",
    "way",
    "week",
    "weeks",
    "went",
    "worst",
    "worth",
    "would",
}
STOP_WORDS = sorted(ENGLISH_STOP_WORDS | FILLER)


def keywords(texts: list[str], labels: np.ndarray, top: int = 6) -> dict[int, list[str]]:
    """Class based TF-IDF: each cluster's texts joined into one document."""
    clusters = sorted(set(labels) - {OUTLIER})
    if not clusters:
        return {}
    docs = [" ".join(t for t, l in zip(texts, labels) if l == c) for c in clusters]
    vec = CountVectorizer(stop_words=STOP_WORDS, ngram_range=(1, 2), min_df=1, token_pattern=r"(?u)\b[a-zA-Z][a-zA-Z]+\b")
    counts = vec.fit_transform(docs).toarray().astype(np.float64)
    words = vec.get_feature_names_out()
    tf = counts / np.maximum(counts.sum(axis=1, keepdims=True), 1)
    avg_words = counts.sum() / len(clusters)
    idf = np.log(1 + avg_words / np.maximum(counts.sum(axis=0), 1))
    ctfidf = tf * idf
    out: dict[int, list[str]] = {}
    for row, c in enumerate(clusters):
        chosen: list[str] = []
        for i in np.argsort(-ctfidf[row]):
            if ctfidf[row, i] <= 0:
                break  # the rest of the words do not occur in this topic
            word = words[i]
            # Skip a single word already covered by a chosen phrase, and vice versa.
            if any(word in w or w in word for w in chosen):
                continue
            chosen.append(word)
            if len(chosen) == top:
                break
        out[int(c)] = chosen
    return out


def project(vectors: np.ndarray, seed: int = 7) -> np.ndarray:
    n = len(vectors)
    if n <= 3000:
        reduced = PCA(n_components=min(30, vectors.shape[1], n - 1), random_state=seed).fit_transform(vectors)
        coords = TSNE(n_components=2, perplexity=min(30, max(5, n // 20)), init="pca", random_state=seed).fit_transform(reduced)
    else:
        coords = PCA(n_components=2, random_state=seed).fit_transform(vectors)
    lo, hi = coords.min(axis=0), coords.max(axis=0)
    return ((coords - lo) / np.maximum(hi - lo, 1e-9)).astype(np.float32)


def _centroids(vectors: np.ndarray, labels: np.ndarray) -> dict[int, np.ndarray]:
    out = {}
    for c in set(labels.tolist()) - {OUTLIER}:
        centre = vectors[labels == c].mean(axis=0)
        out[c] = centre / max(np.linalg.norm(centre), 1e-9)
    return out


def merge_similar(vectors: np.ndarray, labels: np.ndarray, max_topics: int) -> np.ndarray:
    """Merge the two most similar topics (by the cosine of their centres) until at
    most `max_topics` remain. Embeddings often split one theme into several close
    clusters, such as "arrived late" and "tracking never updated"."""
    labels = labels.copy()
    while True:
        centres = _centroids(vectors, labels)
        if len(centres) <= max_topics:
            return labels
        ids = sorted(centres)
        matrix = np.array([centres[i] for i in ids])
        sims = matrix @ matrix.T
        np.fill_diagonal(sims, -2)
        a, b = np.unravel_index(int(np.argmax(sims)), sims.shape)
        keep, drop = ids[a], ids[b]
        if np.sum(labels == drop) > np.sum(labels == keep):
            keep, drop = drop, keep
        labels[labels == drop] = keep


MIN_FIT = 0.3


def assign_outliers(vectors: np.ndarray, labels: np.ndarray) -> np.ndarray:
    """Give each unassigned review to its nearest topic, but only when it is at
    least as close as that topic's outermost members (its 3rd percentile), or
    has a cosine of at least MIN_FIT with its centre. Reviews that
    fit nowhere stay unassigned rather than being forced into a topic."""
    labels = labels.copy()
    centres = _centroids(vectors, labels)
    if not centres:
        return labels
    ids = sorted(centres)
    matrix = np.array([centres[i] for i in ids])
    floors = {}
    for i in ids:
        own = vectors[labels == i] @ centres[i]
        floors[i] = min(float(np.percentile(own, 3)), MIN_FIT)
    outliers = np.where(labels == OUTLIER)[0]
    if len(outliers):
        sims = vectors[outliers] @ matrix.T
        best = np.argmax(sims, axis=1)
        for row, idx in enumerate(outliers):
            topic = ids[best[row]]
            if sims[row, best[row]] >= floors[topic]:
                labels[idx] = topic
    return labels


def build(texts: list[str], vectors: np.ndarray, seed: int = 7, max_topics: int = 10) -> TopicModel:
    labels, method = cluster(vectors, seed)
    labels = merge_similar(vectors, labels, max_topics)
    labels = assign_outliers(vectors, labels)
    # Renumber clusters by size, largest first, so topic 0 is always the biggest.
    sizes = sorted(((int(np.sum(labels == c)), int(c)) for c in set(labels) - {OUTLIER}), reverse=True)
    remap = {old: new for new, (_, old) in enumerate(sizes)}
    labels = np.array([remap.get(int(lab), OUTLIER) for lab in labels])
    return TopicModel(labels=labels, keywords=keywords(texts, labels), method=method, coords=project(vectors, seed))
