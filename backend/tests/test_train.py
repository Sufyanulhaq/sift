import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "ml"))

import train_sentiment

POS = ["great", "lovely", "excellent", "perfect", "fantastic", "brilliant", "amazing", "wonderful"]
NEG = ["awful", "broken", "terrible", "useless", "horrible", "faulty", "dreadful", "poor"]


def toy_rows():
    rows = []
    for source in ("amazon", "yelp", "imdb"):
        for i in range(40):
            rows.append((f"this {source} item is {POS[i % 8]} and {POS[(i + 3) % 8]} {i}", 1, source))
            rows.append((f"this {source} item is {NEG[i % 8]} and {NEG[(i + 3) % 8]} {i}", 0, source))
    return rows


def test_parse_skips_bad_lines():
    rows = train_sentiment.parse(["Good stuff\t1", "no tab here", "Bad stuff\t0", "Odd\t7"], "amazon")
    assert rows == [("Good stuff", 1, "amazon"), ("Bad stuff", 0, "amazon")]


def test_train_and_report_on_a_toy_set(tmp_path):
    _model, _search, (x_te, y_te, s_te, pred), n_train = train_sentiment.train(toy_rows(), folds=3)
    report = train_sentiment.report(y_te, pred, s_te)
    assert n_train == 192
    assert report["accuracy"] > 0.9
    assert set(report["bySource"]) == {"amazon", "yelp", "imdb"}
    assert sum(map(sum, report["confusion"])) == len(x_te)


def test_main_writes_model_and_card(tmp_path, monkeypatch):
    monkeypatch.setattr(train_sentiment, "load", lambda _: toy_rows())
    monkeypatch.setattr(sys, "argv", ["train", "--out", str(tmp_path)])
    train_sentiment.main()
    card = json.loads((tmp_path / "sentiment.json").read_text())
    assert (tmp_path / "sentiment.joblib").exists()
    assert card["data"]["license"] == "CC BY 4.0"
    assert card["test"]["accuracy"] > 0.9
    assert "baseline" in card and card["baseline"]["name"].startswith("VADER")

    # The app picks up the trained model.
    from sift.pipeline import sentiment

    monkeypatch.setattr(sentiment, "MODEL_DIR", tmp_path)
    sentiment.reset_model()
    try:
        model = sentiment.get_model()
        assert model.name.startswith("trained:")
        result = sentiment.analyse(["this amazon item is excellent and perfect", "this amazon item is broken and awful"])
        assert result.labels == ["positive", "negative"]
    finally:
        sentiment.reset_model()
