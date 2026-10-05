"""Read uploaded feedback into clean rows: text, optional date and rating."""

from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass, field
from datetime import date, datetime

MAX_ROWS = 20_000
MAX_TEXT = 5_000
MIN_TEXT = 3

TEXT_HINTS = ("review", "text", "comment", "feedback", "message", "body", "content", "description")
DATE_HINTS = ("date", "created", "time", "submitted", "posted")
RATING_HINTS = ("rating", "stars", "score")


@dataclass
class Row:
    id: int
    text: str
    date: date | None = None
    rating: float | None = None


@dataclass
class Ingested:
    rows: list[Row]
    columns: list[str]
    text_column: str
    date_column: str | None
    rating_column: str | None
    dropped_empty: int = 0
    dropped_duplicates: int = 0
    truncated: bool = False
    notes: list[str] = field(default_factory=list)


class IngestError(ValueError):
    """The upload cannot be analysed; the message is safe to show the user."""


_space = re.compile(r"\s+")
_html = re.compile(r"<[^>]{1,200}>")


def clean_text(text: str) -> str:
    text = _html.sub(" ", text)
    return _space.sub(" ", text).strip()[:MAX_TEXT]


def _pick(columns: list[str], hints: tuple[str, ...], given: str | None) -> str | None:
    if given:
        if given not in columns:
            raise IngestError(f"There is no column called '{given}'.")
        return given
    lowered = {c.lower().strip(): c for c in columns}
    for hint in hints:
        for low, original in lowered.items():
            if hint == low or low.startswith(hint) or low.endswith(hint):
                return original
    return None


_DATE_FORMATS = ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d", "%d-%m-%Y", "%d %b %Y", "%b %d, %Y")


def parse_date(value: str) -> date | None:
    value = (value or "").strip()
    if not value:
        return None
    try:
        return datetime.fromisoformat(value).date()
    except ValueError:
        pass
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    return None


def parse_rating(value: str) -> float | None:
    match = re.search(r"-?\d+(\.\d+)?", value or "")
    if not match:
        return None
    number = float(match.group())
    return number if 0 <= number <= 10 else None


def _avg_len(sample: list[dict], column: str) -> float:
    return sum(len(r.get(column) or "") for r in sample) / max(1, len(sample))


def _guess_text_column(columns: list[str], sample: list[dict]) -> str:
    """The free text column: among columns whose name looks like text, the one
    with the longest values. Names alone mislead (review_id starts with review)."""
    lengths = {c: _avg_len(sample, c) for c in columns}
    named = [c for c in columns if any(h in c.lower() for h in TEXT_HINTS)]
    best_named = max(named, key=lengths.get) if named else None
    longest = max(columns, key=lengths.get)
    if best_named and lengths[best_named] >= 15 and lengths[best_named] >= lengths[longest] * 0.5:
        return best_named
    return longest


def read_csv(
    data: bytes,
    text_column: str | None = None,
    date_column: str | None = None,
    rating_column: str | None = None,
) -> Ingested:
    try:
        decoded = data.decode("utf-8-sig")
    except UnicodeDecodeError:
        decoded = data.decode("latin-1")
    try:
        dialect = csv.Sniffer().sniff(decoded[:4096], delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel
    reader = csv.DictReader(io.StringIO(decoded), dialect=dialect)
    columns = [c for c in (reader.fieldnames or []) if c is not None]
    if not columns:
        raise IngestError("The file has no header row.")

    sample = [r for _, r in zip(range(200), csv.DictReader(io.StringIO(decoded), dialect=dialect))]
    if not sample:
        raise IngestError("The file has a header but no rows.")
    text_col = text_column and _pick(columns, TEXT_HINTS, text_column)
    if not text_col:
        text_col = _guess_text_column(columns, sample)
    date_col = _pick(columns, DATE_HINTS, date_column)
    rating_col = _pick(columns, RATING_HINTS, rating_column)

    raw = []
    for record in reader:
        raw.append(
            (
                record.get(text_col) or "",
                record.get(date_col) if date_col else None,
                record.get(rating_col) if rating_col else None,
            )
        )
    return _finish(raw, columns, text_col, date_col, rating_col)


def from_texts(texts: list[str]) -> Ingested:
    return _finish([(t, None, None) for t in texts], ["text"], "text", None, None)


def _finish(raw, columns, text_col, date_col, rating_col) -> Ingested:
    rows: list[Row] = []
    seen: set[str] = set()
    empty = duplicates = 0
    truncated = len(raw) > MAX_ROWS
    for text, when, rating in raw[:MAX_ROWS]:
        cleaned = clean_text(text)
        if len(cleaned) < MIN_TEXT:
            empty += 1
            continue
        key = cleaned.lower()
        if key in seen:
            duplicates += 1
            continue
        seen.add(key)
        rows.append(
            Row(
                id=len(rows) + 1,
                text=cleaned,
                date=parse_date(when) if when is not None else None,
                rating=parse_rating(rating) if rating is not None else None,
            )
        )
    if len(rows) < 10:
        raise IngestError(f"Only {len(rows)} usable rows were found. Sift needs at least 10 to find patterns.")
    ingested = Ingested(rows, columns, text_col, date_col, rating_col, empty, duplicates, truncated)
    if truncated:
        ingested.notes.append(f"Only the first {MAX_ROWS:,} rows were analysed.")
    if date_col and not any(r.date for r in rows):
        ingested.date_column = None
        ingested.notes.append(f"The '{date_col}' column did not contain dates Sift could read, so trends are off.")
    return ingested
