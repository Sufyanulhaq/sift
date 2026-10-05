import csv
import io

import pytest

from sift.pipeline.ingest import IngestError, clean_text, from_texts, parse_date, parse_rating, read_csv


def csv_bytes(rows, header="id,review,date,stars", sep=","):
    out = io.StringIO()
    writer = csv.writer(out, delimiter=sep)
    writer.writerow(header.split(sep))
    writer.writerows(rows)
    return out.getvalue().encode()


ROWS = [(f"R{i}", f"Great product number {i}, works well", "2026-05-0" + str(1 + i % 9), str(1 + i % 5)) for i in range(20)]


def test_picks_the_text_column_not_an_id_that_shares_its_name():
    data = csv_bytes([(f"x{i}", f"The delivery was very slow, order {i}") for i in range(12)], header="review_id,review")
    assert read_csv(data).text_column == "review"


def test_guesses_the_longest_column_when_no_name_matches():
    data = csv_bytes([(str(i), f"Lovely sofa, arrived on time, order {i}") for i in range(12)], header="n,what_they_said")
    assert read_csv(data).text_column == "what_they_said"


def test_finds_date_and_rating_columns():
    result = read_csv(csv_bytes(ROWS))
    assert (result.date_column, result.rating_column) == ("date", "stars")
    assert result.rows[0].date.isoformat() == "2026-05-01"
    assert result.rows[0].rating == 1.0


def test_respects_chosen_columns_and_rejects_unknown_ones():
    assert read_csv(csv_bytes(ROWS), text_column="review").text_column == "review"
    with pytest.raises(IngestError):
        read_csv(csv_bytes(ROWS), text_column="nope")


def test_removes_duplicates_empty_rows_and_html():
    texts = ["Fine table, good value"] * 3 + ["", "  ", "<b>Great</b>   chair"] + [f"Unique review {i}" for i in range(10)]
    result = from_texts(texts)
    assert result.dropped_duplicates == 2
    assert result.dropped_empty == 2
    assert any(r.text == "Great chair" for r in result.rows)


def test_reads_semicolon_files_and_latin1():
    data = (
        csv_bytes([(str(i), f"Caf\xe9 table number {i} is lovely") for i in range(12)], header="id;comment", sep=";")
        .decode()
        .encode("latin-1")
    )
    result = read_csv(data)
    assert result.text_column == "comment"
    assert "Café" in result.rows[0].text


def test_needs_at_least_ten_rows():
    with pytest.raises(IngestError, match="at least 10"):
        from_texts([f"Review {i}" for i in range(5)])


def test_turns_off_trends_when_dates_are_unreadable():
    rows = [(str(i), f"Nice chair number {i}", "soon", "5") for i in range(12)]
    result = read_csv(csv_bytes(rows))
    assert result.date_column is None
    assert any("dates" in n for n in result.notes)


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("2026-07-06", "2026-07-06"),
        ("06/07/2026", "2026-07-06"),
        ("2026-07-06T10:00:00Z", "2026-07-06"),
        ("Jul 06, 2026", "2026-07-06"),
        ("nope", None),
    ],
)
def test_parse_date(value, expected):
    parsed = parse_date(value)
    assert (parsed.isoformat() if parsed else None) == expected


def test_parse_rating():
    assert parse_rating("4 stars") == 4
    assert parse_rating("4.5/5") == 4.5
    assert parse_rating("excellent") is None
    assert parse_rating("50") is None


def test_clean_text_limits_length():
    assert len(clean_text("a" * 10_000)) == 5000
