"use client";

import { motion } from "motion/react";
import { useMemo, useState } from "react";
import * as api from "@/lib/api";
import { sentimentColor, signed, topicColor } from "@/lib/format";
import type { Label, Result, Review } from "@/lib/types";

type Sort = "relevance" | "newest" | "negative" | "positive";

const PAGE = 25;

/** Ranks by shared words when the server can no longer run a meaning search. */
function keywordSearch(reviews: Review[], query: string) {
  const words = query.toLowerCase().match(/[a-z0-9']+/g) ?? [];
  if (!words.length) return new Map<number, number>();
  const scores = new Map<number, number>();
  for (const r of reviews) {
    const text = r.text.toLowerCase();
    const hits = words.filter((w) => text.includes(w)).length;
    if (hits) scores.set(r.id, hits / words.length);
  }
  return scores;
}

export function Explorer({ result, jobId, topic, onTopic }: { result: Result; jobId: string | null; topic: number | null; onTopic: (id: number | null) => void }) {
  const [query, setQuery] = useState("");
  const [scores, setScores] = useState<Map<number, number> | null>(null);
  const [searchMode, setSearchMode] = useState<"meaning" | "keywords" | null>(null);
  const [busy, setBusy] = useState(false);
  const [labels, setLabels] = useState<Set<Label>>(new Set());
  const [sort, setSort] = useState<Sort>("newest");
  const [canMeaning, setCanMeaning] = useState(Boolean(jobId));
  const names = useMemo(() => new Map(result.topics.map((t) => [t.id, t.name])), [result.topics]);

  // Any change of filter starts the list from the top again.
  const filterKey = `${topic}|${[...labels].join()}|${sort}|${query && scores ? scores.size : ""}`;
  const [page, setPage] = useState({ key: filterKey, shown: PAGE });
  const shown = page.key === filterKey ? page.shown : PAGE;

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) {
      setScores(null);
      setSearchMode(null);
      setSort("newest");
      return;
    }
    setBusy(true);
    try {
      if (jobId && canMeaning) {
        try {
          const res = await api.search(jobId, q, 50);
          setScores(new Map(res.results.map((r) => [r.id, r.score])));
          setSearchMode("meaning");
          setSort("relevance");
          return;
        } catch (err) {
          if (err instanceof api.ApiError && (err.status === 404 || err.status === 0)) setCanMeaning(false);
          else throw err;
        }
      }
      setScores(keywordSearch(result.reviews, q));
      setSearchMode("keywords");
      setSort("relevance");
    } finally {
      setBusy(false);
    }
  }

  const rows = useMemo(() => {
    let list = result.reviews.filter((r) => (topic === null || r.topic === topic) && (labels.size === 0 || labels.has(r.label)));
    if (scores) list = list.filter((r) => scores.has(r.id));
    const by: Record<Sort, (a: Review, b: Review) => number> = {
      relevance: (a, b) => (scores?.get(b.id) ?? 0) - (scores?.get(a.id) ?? 0),
      newest: (a, b) => (b.date ?? "").localeCompare(a.date ?? "") || b.id - a.id,
      negative: (a, b) => a.sentiment - b.sentiment,
      positive: (a, b) => b.sentiment - a.sentiment,
    };
    return [...list].sort(by[sort]);
  }, [result.reviews, topic, labels, scores, sort]);

  const toggle = (l: Label) =>
    setLabels((s) => {
      const next = new Set(s);
      if (next.has(l)) next.delete(l);
      else next.add(l);
      return next;
    });

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-semibold">Explore the feedback</h2>
          <p className="mt-1 text-sm text-muted">
            {jobId && canMeaning
              ? "Search by meaning: “late delivery” also finds “took three weeks to arrive”."
              : "Search by keyword. Meaning search works while the server still holds this analysis (30 minutes)."}
          </p>
        </div>
      </div>

      <form onSubmit={runSearch} className="mt-4 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Try: refund taking forever"
          className="min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm outline-none focus:border-accent"
        />
        <button type="submit" disabled={busy} className="rounded-xl bg-accent px-5 text-sm font-medium text-white disabled:opacity-60">
          {busy ? "Searching" : "Search"}
        </button>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        <select
          value={topic ?? ""}
          onChange={(e) => onTopic(e.target.value === "" ? null : Number(e.target.value))}
          className="rounded-lg border border-line bg-surface px-2.5 py-1.5"
          aria-label="Filter by topic"
        >
          <option value="">All topics</option>
          {result.topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
          {result.overview.unassigned > 0 && <option value={-1}>No topic</option>}
        </select>
        {(["positive", "neutral", "negative"] as Label[]).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => toggle(l)}
            className={`rounded-lg border px-2.5 py-1.5 capitalize transition-colors ${labels.has(l) ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-ink"}`}
          >
            {l}
          </button>
        ))}
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="ml-auto rounded-lg border border-line bg-surface px-2.5 py-1.5" aria-label="Sort">
          {scores && <option value="relevance">Best match</option>}
          <option value="newest">Newest</option>
          <option value="negative">Most negative</option>
          <option value="positive">Most positive</option>
        </select>
      </div>

      <p className="mt-4 text-xs text-muted">
        {rows.length.toLocaleString("en")} reviews
        {searchMode && ` matching “${query.trim()}” by ${searchMode}`}
        {scores && (
          <button
            type="button"
            className="ml-2 underline underline-offset-2 hover:text-ink"
            onClick={() => {
              setQuery("");
              setScores(null);
              setSearchMode(null);
              setSort("newest");
            }}
          >
            clear search
          </button>
        )}
      </p>

      <ul className="mt-2 divide-y divide-line">
          {rows.slice(0, shown).map((r) => (
          <motion.li key={r.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="py-3">
              <p className="text-sm leading-relaxed">{r.text}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                <button type="button" onClick={() => onTopic(r.topic)} className="flex items-center gap-1.5 hover:text-ink">
                  <span className="size-2 rounded-full" style={{ background: topicColor(r.topic) }} />
                  {names.get(r.topic) ?? "No topic"}
                </button>
                <span className="font-mono" style={{ color: sentimentColor(r.sentiment) }}>
                  {signed(r.sentiment)}
                </span>
                {r.rating !== null && <span>{r.rating} stars</span>}
                {r.date && <span>{r.date}</span>}
                {scores?.has(r.id) && searchMode === "meaning" && <span>match {Math.round((scores.get(r.id) ?? 0) * 100)}%</span>}
                <span className="ml-auto">R{r.id}</span>
              </div>
            </motion.li>
          ))}
      </ul>
      {shown < rows.length && (
        <button type="button" onClick={() => setPage({ key: filterKey, shown: shown + PAGE * 2 })} className="mt-4 w-full rounded-xl border border-line py-2.5 text-sm text-muted hover:text-ink">
          Show more ({(rows.length - shown).toLocaleString("en")} left)
        </button>
      )}
    </section>
  );
}
