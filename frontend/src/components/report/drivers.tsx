"use client";

import { motion } from "motion/react";
import { topicColor } from "@/lib/format";
import type { Result } from "@/lib/types";

/** Which topics account for the negative feedback. */
export function Drivers({ result, onSelect }: { result: Result; onSelect: (id: number) => void }) {
  const names = new Map(result.topics.map((t) => [t.id, t.name]));
  const rows = result.drivers.filter((d) => d.negative > 0).slice(0, 6);
  const max = Math.max(...rows.map((d) => d.share), 0.01);
  return (
    <section className="card p-6">
      <h2 className="font-semibold">What drives negative feedback</h2>
      <p className="mt-1 text-sm text-muted">Share of all negative reviews that fall in each topic.</p>
      <ul className="mt-5 space-y-3">
        {rows.map((d, i) => (
          <li key={d.topic}>
            <button type="button" onClick={() => onSelect(d.topic)} className="group w-full text-left">
              <div className="flex justify-between text-sm">
                <span className="truncate group-hover:text-accent">{names.get(d.topic)}</span>
                <span className="tabular-nums text-muted">
                  {Math.round(d.share * 100)}% <span className="text-xs">({d.negative})</span>
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: topicColor(d.topic) }}
                  initial={{ width: 0 }}
                  whileInView={{ width: `${(d.share / max) * 100}%` }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
