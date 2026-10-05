"""Run the sample through the full pipeline and print the topics, for checking
clustering quality with whichever embedder is available (set SIFT_EMBEDDER).

With --write PATH the full result is also saved as JSON, which is how the
frontend demo report is built."""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sift.analysis import run
from sift.pipeline.ingest import read_csv

SAMPLE = Path(__file__).resolve().parents[2] / "samples" / "hearth-and-oak-reviews.csv"

result = run(read_csv(SAMPLE.read_bytes())).result
meta = result["meta"]
print(f"embedder={meta['embedder']} clustering={meta['clustering']} sentiment={meta['sentimentModel']} seconds={meta['seconds']}")
print(f"rating agreement={result['overview']['ratingAgreement']} unassigned={result['overview']['unassigned']}")
for t in result["topics"]:
    print(f"{t['id']:>2} {t['size']:>4} {t['sentiment']:+.2f}  {t['name']:<28} {', '.join(t['keywords'][:5])}")
print("spikes:", result["trends"]["spikes"][:3])

if "--write" in sys.argv:
    out = Path(sys.argv[sys.argv.index("--write") + 1])
    out.write_text(json.dumps(result, separators=(",", ":")))
    print(f"wrote {out}")
print("summary:", result["summary"]["text"])
