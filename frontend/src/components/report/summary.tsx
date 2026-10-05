"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { Result, Review } from "@/lib/types";
import { SentimentBar } from "./kpis";

export function Summary({ result, byId }: { result: Result; byId: Map<number, Review> }) {
  const [open, setOpen] = useState<number | null>(null);
  const parts = result.summary.text.split(/(\[R\d+\])/g);
  const mode = result.meta.summaryMode;
  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Summary</h2>
        <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted">
          {mode === "claude" ? "Written by Claude, every claim cited" : mode === "offline_fallback" ? "Written offline (Claude was unavailable)" : "Written offline from the numbers"}
        </span>
      </div>
      <p className="mt-4 leading-relaxed">
        {parts.map((part, i) => {
          const m = part.match(/^\[R(\d+)\]$/);
          if (!m) return <span key={i}>{part}</span>;
          const id = Number(m[1]);
          const review = byId.get(id);
          return (
            <span key={i} className="relative inline-block">
              <button
                type="button"
                onClick={() => setOpen(open === i ? null : i)}
                onMouseEnter={() => setOpen(i)}
                onMouseLeave={() => setOpen(null)}
                className="mx-0.5 rounded-md bg-accent-soft px-1.5 py-0.5 align-baseline font-mono text-xs text-accent"
              >
                R{id}
              </button>
              <AnimatePresence>
                {open === i && review && (
                  <motion.span
                    initial={{ opacity: 0, y: 4, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4 }}
                    className="absolute bottom-full left-1/2 z-30 mb-2 block w-72 -translate-x-1/2 rounded-xl border border-line bg-surface p-3 text-left text-sm shadow-card"
                  >
                    <span className="block text-ink">“{review.text}”</span>
                    <span className="mt-2 block text-xs text-muted">
                      Review {review.id}
                      {review.date ? `, ${review.date}` : ""}
                      {review.rating !== null ? `, ${review.rating} stars` : ""}
                    </span>
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
          );
        })}
      </p>
      <div className="mt-6">
        <SentimentBar result={result} />
      </div>
    </section>
  );
}
