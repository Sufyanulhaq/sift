"use client";

import { motion } from "motion/react";
import { CountUp } from "@/components/ui/count-up";
import type { Result } from "@/lib/types";

const pctFmt = (v: number) => `${Math.round(v)}%`;
const moodFmt = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(2)}`;

export function Kpis({ result }: { result: Result }) {
  const { overview, meta, topics } = result;
  const items = [
    { label: "Pieces of feedback", value: meta.rows, format: undefined, hint: meta.duplicatesRemoved ? `${meta.duplicatesRemoved} duplicates removed` : "All rows kept" },
    { label: "Average mood", value: overview.sentiment, format: moodFmt, hint: "From minus 1 to plus 1" },
    { label: "Positive", value: overview.positive * 100, format: pctFmt, hint: `${Math.round(overview.neutral * 100)}% neutral`, tone: "text-positive" },
    { label: "Negative", value: overview.negative * 100, format: pctFmt, hint: `${result.drivers[0] ? "Mostly " + topicName(result, result.drivers[0].topic) : ""}`, tone: "text-negative" },
    { label: "Topics", value: topics.length, format: undefined, hint: overview.unassigned ? `${overview.unassigned} reviews fit no topic` : "Every review placed" },
    overview.ratingAgreement !== null
      ? { label: "Agrees with stars", value: overview.ratingAgreement * 100, format: pctFmt, hint: "Mood matches the rating" }
      : { label: "Analysis time", value: meta.seconds, format: (v: number) => `${v.toFixed(1)}s`, hint: "On the server" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((k, i) => (
        <motion.div key={k.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }} className="card p-4">
          <p className="text-xs text-muted">{k.label}</p>
          <p className={`mt-2 text-2xl font-semibold tabular-nums tracking-tight ${k.tone ?? ""}`}>
            <CountUp value={k.value} format={k.format} />
          </p>
          <p className="mt-1 truncate text-xs text-muted">{k.hint}</p>
        </motion.div>
      ))}
    </div>
  );
}

function topicName(result: Result, id: number) {
  return result.topics.find((t) => t.id === id)?.name ?? "";
}

export function SentimentBar({ result }: { result: Result }) {
  const { positive, neutral, negative } = result.overview;
  const parts = [
    { label: "Positive", value: positive, color: "bg-positive" },
    { label: "Neutral", value: neutral, color: "bg-neutral" },
    { label: "Negative", value: negative, color: "bg-negative" },
  ];
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-surface-2">
        {parts.map((p, i) => (
          <motion.div
            key={p.label}
            className={p.color}
            initial={{ width: 0 }}
            animate={{ width: `${p.value * 100}%` }}
            transition={{ delay: 0.2 + i * 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          />
        ))}
      </div>
      <div className="mt-2 flex gap-4 text-xs text-muted">
        {parts.map((p) => (
          <span key={p.label} className="flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${p.color}`} />
            {p.label} {Math.round(p.value * 100)}%
          </span>
        ))}
      </div>
    </div>
  );
}
