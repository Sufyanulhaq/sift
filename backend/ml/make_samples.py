"""
Build the sample dataset: reviews for Hearth & Oak, an invented online furniture shop.

The company, customers and reviews are all made up. The generator is seeded, so the
file is identical every time. Reviews are assembled from varied phrases per topic,
with ratings that follow the mood, and a burst of app crash complaints in one week
so the trends view has something real to find.
"""

from __future__ import annotations

import csv
import random
from datetime import date, timedelta
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / "samples" / "hearth-and-oak-reviews.csv"

TOPICS = {
    "delivery_late": (
        0.16,
        -0.7,
        [
            "My order arrived {n} days later than promised",
            "Delivery was delayed {n} times without any warning",
            "The courier missed the delivery slot twice",
            "Waited all day at home and the van never came",
            "Tracking said out for delivery for {n} days straight",
            "Estimated delivery kept moving back week after week",
            "It took {n} weeks to arrive when the site said 5 days",
        ],
        [
            "Nobody told me why.",
            "I had to take another day off work.",
            "Really frustrating experience.",
            "The table itself is fine once it finally arrived.",
            "Please sort out your delivery partner.",
        ],
    ),
    "damaged": (
        0.11,
        -0.8,
        [
            "The sofa arrived with a torn cushion",
            "One of the chair legs was cracked in the box",
            "The wardrobe door came scratched and dented",
            "Glass top of the coffee table was shattered on arrival",
            "Packaging was crushed and the bookshelf was split",
            "Drawer front was chipped right out of the box",
        ],
        [
            "Clearly packed badly.",
            "I had to send it back.",
            "Very disappointing for the price.",
            "Still waiting for a replacement part.",
        ],
    ),
    "quality": (
        0.2,
        0.75,
        [
            "Beautiful solid oak dining table, really sturdy",
            "The bed frame feels solid and well made",
            "Gorgeous finish on the sideboard, looks expensive",
            "Very comfortable sofa, the fabric feels premium",
            "Lovely craftsmanship on the desk, no wobble at all",
            "The bookcase is heavy and properly built",
            "Great quality wood, much better than flat pack brands",
        ],
        [
            "Would buy again.",
            "Exactly like the photos.",
            "Worth every penny.",
            "Friends keep asking where it is from.",
            "Really happy with it.",
        ],
    ),
    "service": (
        0.13,
        0.5,
        [
            "Customer service sorted my problem in one call",
            "The support team were friendly and quick to reply",
            "Sarah in customer care was incredibly helpful",
            "Live chat agent arranged a replacement the same day",
            "Support answered my email within an hour",
        ],
        [
            "Great service.",
            "Made up for the earlier problem.",
            "Could not ask for more.",
            "Really reassuring.",
        ],
    ),
    "refunds": (
        0.09,
        -0.6,
        [
            "Still waiting for my refund after {n} weeks",
            "Returned the chair but the refund never came through",
            "Had to chase my refund {n} times by email",
            "They charged a restocking fee nobody mentioned",
            "Refund took over a month to appear on my card",
        ],
        [
            "Very poor.",
            "I will not order again.",
            "Not good enough.",
            "Eventually sorted but it took far too long.",
        ],
    ),
    "assembly": (
        0.12,
        -0.25,
        [
            "Assembly instructions were confusing and missing steps",
            "Took {n} hours to put together the wardrobe",
            "A few screws were missing from the assembly pack",
            "The diagrams in the manual did not match the parts",
            "Assembly was easy and took about an hour",
            "Clear instructions, the bed went together quickly",
        ],
        [
            "Needed two people.",
            "Fine in the end.",
            "Would pay for assembly next time.",
            "A video guide would help.",
        ],
    ),
    "app": (
        0.08,
        -0.65,
        [
            "The app crashes every time I open my basket",
            "Checkout on the app keeps freezing at payment",
            "App logged me out and lost my saved items",
            "Website kept showing an error when I tried to pay",
            "The app crashed during checkout and charged me twice",
        ],
        [
            "Had to order on a laptop instead.",
            "Please fix the app.",
            "Very annoying.",
            "Gave up and called instead.",
        ],
    ),
    "value": (
        0.11,
        0.35,
        [
            "Good value for solid wood furniture",
            "Prices are fair compared to the high street",
            "Bit pricey but the quality justifies it",
            "Great sale prices, saved a lot on the sofa",
            "Expensive for what you get honestly",
        ],
        [
            "Keep an eye on the sales.",
            "Happy overall.",
            "Would recommend.",
            "Not sure it is worth full price.",
        ],
    ),
}

ITEMS = ["dining table", "sofa", "bed frame", "wardrobe", "desk", "bookcase", "armchair", "sideboard", "coffee table", "chest of drawers"]


def make(n: int = 1400, seed: int = 11) -> list[dict]:
    rng = random.Random(seed)
    start = date(2026, 3, 2)
    spike_week = start + timedelta(weeks=18)
    weights = [w for w, *_ in TOPICS.values()]
    names = list(TOPICS)
    rows = []
    seen = set()
    while len(rows) < n:
        day = start + timedelta(days=rng.randint(0, 7 * 26 - 1))
        topic = rng.choices(names, weights)[0]
        # The app crash burst: extra app complaints in one week.
        if spike_week <= day < spike_week + timedelta(days=7) and rng.random() < 0.55:
            topic = "app"
        _, mood, openers, closers = TOPICS[topic]
        text = rng.choice(openers).format(n=rng.randint(2, 9))
        if rng.random() < 0.35:
            text += f" for the {rng.choice(ITEMS)}"
        text += ". " + rng.choice(closers)
        if text in seen:
            continue
        seen.add(text)
        mood_here = mood + rng.uniform(-0.35, 0.35)
        rating = max(1, min(5, round(3 + mood_here * 2.2 + rng.uniform(-0.6, 0.6))))
        rows.append({"review_id": f"HO-{10000 + len(rows)}", "date": day.isoformat(), "rating": rating, "review": text})
    rows.sort(key=lambda r: r["date"])
    return rows


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    rows = make()
    with OUT.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["review_id", "date", "rating", "review"])
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {len(rows)} reviews to {OUT}")


if __name__ == "__main__":
    main()
