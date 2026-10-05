import numpy as np

from sift.pipeline import trends
from sift.pipeline.embed import LsaEmbedder
from sift.pipeline.search import search
from sift.pipeline.sentiment import label_for
from sift.pipeline.topics import keywords


def test_whole_pipeline_on_the_sample(sample_analysis):
    r = sample_analysis.result
    assert r["meta"]["rows"] == 1400
    assert 3 <= len(r["topics"]) <= 30
    assert len(r["reviews"]) == 1400
    assert all(0 <= x["x"] <= 1 and 0 <= x["y"] <= 1 for x in r["reviews"])
    # Topics are numbered by size, largest first.
    sizes = [t["size"] for t in r["topics"]]
    assert sizes == sorted(sizes, reverse=True)
    # Shares of positive, negative and neutral add up to one.
    o = r["overview"]
    assert abs(o["positive"] + o["negative"] + o["neutral"] - 1) < 0.01
    # Star ratings in the sample follow the mood, so most should agree.
    assert o["ratingAgreement"] > 0.6


def test_finds_the_planted_app_crash_spike(sample_analysis):
    r = sample_analysis.result
    spike = r["trends"]["spikes"][0]
    assert spike["week"] == "2026-07-06"
    topic = next(t for t in r["topics"] if t["id"] == spike["topic"])
    assert "app" in " ".join(topic["keywords"])


def test_summary_only_cites_example_reviews(sample_analysis):
    r = sample_analysis.result
    allowed = {rid for t in r["topics"] for rid in t["examples"]}
    assert r["summary"]["citations"]
    assert set(r["summary"]["citations"]) <= allowed
    assert r["meta"]["summaryMode"] == "offline"


def test_semantic_search_finds_relevant_reviews(sample_analysis):
    a = sample_analysis
    hits = search(a.embedder.transform(["refund still not received"])[0], a.vectors, limit=10)
    texts = [a.texts[i].lower() for i, _ in hits]
    assert len(texts) >= 5
    assert sum("refund" in t for t in texts) >= 4


def test_lsa_vectors_are_unit_length():
    vectors = LsaEmbedder(dims=8).fit_transform([f"chair {i} is comfy" for i in range(10)] + [f"late delivery {i}" for i in range(10)])
    assert np.allclose(np.linalg.norm(vectors, axis=1), 1, atol=1e-5)


def test_keywords_prefer_words_distinctive_to_each_topic():
    texts = ["late delivery again", "delivery was late", "slow late delivery", "lovely oak table", "solid oak table", "oak table is lovely"]
    kw = keywords(texts, np.array([0, 0, 0, 1, 1, 1]))
    assert "delivery" in " ".join(kw[0]) and "oak" in " ".join(kw[1])
    assert "oak" not in " ".join(kw[0])


def test_neutral_band():
    assert label_for(0.5) == "positive"
    assert label_for(-0.5) == "negative"
    assert label_for(0.1) == "neutral"


def test_spike_detection_needs_history_and_volume():
    from datetime import date, timedelta

    weeks = [date(2026, 1, 5) + timedelta(weeks=i) for i in range(10)]
    quiet = {0: [2, 3, 2, 2, 3, 2, 2, 3, 2, 2]}
    assert trends.spikes(weeks, quiet) == []
    burst = {0: [2, 3, 2, 2, 3, 2, 2, 3, 20, 2]}
    found = trends.spikes(weeks, burst)
    assert found and found[0]["week"] == weeks[8].isoformat()
