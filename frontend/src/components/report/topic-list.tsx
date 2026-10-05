"use client";

import { AnimatePresence, motion } from "motion/react";
import { sentimentColor, signed, topicColor } from "@/lib/format";
import type { Result, Review } from "@/lib/types";

export function TopicList({ result, byId, selected, onSelect }: { result: Result; byId: Map<number, Review>; selected: number | null; onSelect: (id: number | null) => void }) {
  const max = Math.max(...result.topics.map((t) => t.share));
  return (
    <ul className="space-y-1">
      {result.topics.map((t, i) => {
        const open = selected === t.id;
        return (
          <motion.li key={t.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.04 * i }}>
            <button
              type="button"
              onClick={() => onSelect(open ? null : t.id)}
              className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors ${open ? "bg-accent-soft" : "hover:bg-surface-2"}`}
            >
              <div className="flex items-center gap-3">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: topicColor(t.id) }} />
                <span className="min-w-0 flex-1 truncate font-medium">{t.name}</span>
                <span className="font-mono text-xs tabular-nums" style={{ color: sentimentColor(t.sentiment) }}>
                  {signed(t.sentiment)}
                </span>
                <span className="w-12 text-right text-xs tabular-nums text-muted">{Math.round(t.share * 100)}%</span>
              </div>
              <div className="ml-5.5 mt-2 h-1 overflow-hidden rounded-full bg-surface-2">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: topicColor(t.id) }}
                  initial={{ width: 0 }}
                  animate={{ width: `${(t.share / max) * 100}%` }}
                  transition={{ delay: 0.3 + 0.04 * i, duration: 0.7 }}
                />
              </div>
            </button>
            <AnimatePresence initial={false}>
              {open && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="space-y-3 px-3 pb-4 pt-2 text-sm">
                    <div className="flex flex-wrap gap-1.5">
                      {t.keywords.map((k) => (
                        <span key={k} className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-muted">
                          {k}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-muted">
                      {t.size.toLocaleString("en")} reviews, {Math.round(t.negativeShare * 100)}% negative. Most typical:
                    </p>
                    {t.examples.slice(0, 3).map((id) => (
                      <blockquote key={id} className="border-l-2 pl-3 text-muted" style={{ borderColor: topicColor(t.id) }}>
                        {byId.get(id)?.text}
                      </blockquote>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.li>
        );
      })}
    </ul>
  );
}
