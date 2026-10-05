"use client";

import { download, toCsv } from "@/lib/csv";
import type { StoredReport } from "@/lib/types";

export function ExportMenu({ report }: { report: StoredReport }) {
  const { result } = report;
  const slug = report.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/ /g, "_") || "sift_report";
  const names = new Map(result.topics.map((t) => [t.id, t.name]));

  const reviewsCsv = () =>
    download(
      `${slug}_reviews.csv`,
      toCsv(
        ["id", "text", "date", "rating", "sentiment", "label", "topic"],
        result.reviews.map((r) => [r.id, r.text, r.date, r.rating, r.sentiment, r.label, names.get(r.topic) ?? ""]),
      ),
      "text/csv",
    );
  const topicsCsv = () =>
    download(
      `${slug}_topics.csv`,
      toCsv(
        ["topic", "reviews", "share", "sentiment", "negative_share", "keywords"],
        result.topics.map((t) => [t.name, t.size, t.share, t.sentiment, t.negativeShare, t.keywords.join(" ")]),
      ),
      "text/csv",
    );
  const json = () => download(`${slug}.json`, JSON.stringify(result, null, 2), "application/json");

  const btn = "rounded-lg border border-line px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-ink";
  return (
    <div className="no-print flex flex-wrap gap-2">
      <button type="button" className={btn} onClick={reviewsCsv}>
        Reviews CSV
      </button>
      <button type="button" className={btn} onClick={topicsCsv}>
        Topics CSV
      </button>
      <button type="button" className={btn} onClick={json}>
        JSON
      </button>
      <button type="button" className={btn} onClick={() => window.print()}>
        PDF
      </button>
    </div>
  );
}
