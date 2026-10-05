"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import type { Step } from "@/lib/types";

export type StepState = { status: "waiting" | "running" | "done"; detail?: Record<string, unknown> };

function describe(id: string, d: Record<string, unknown> | undefined): string | null {
  if (!d) return null;
  switch (id) {
    case "clean":
      return `${Number(d.rows).toLocaleString("en")} rows kept, ${d.duplicates} duplicates and ${d.empty} empty removed`;
    case "sentiment":
      return `${Math.round(Number(d.positive) * 100)}% positive, ${Math.round(Number(d.negative) * 100)}% negative`;
    case "embed":
      return `${d.embedder === "minilm" ? "MiniLM sentence model" : "Latent semantic model"}, ${d.dimensions} dimensions`;
    case "topics":
      return `${d.topics} topics found with ${String(d.method).toUpperCase()}`;
    case "trends":
      return Number(d.weeks) ? `${d.weeks} weeks charted` : "No dates, so no trends";
    case "summary":
      return d.mode === "claude" ? "Written by Claude with citations" : "Written offline from the numbers";
    default:
      return null;
  }
}

export function Progress({ steps, states, failed }: { steps: Step[]; states: Record<string, StepState>; failed?: string | null }) {
  const [started] = useState(() => Date.now());
  const [now, setNow] = useState(started);
  const done = steps.filter((s) => states[s.id]?.status === "done").length;
  const finished = done === steps.length;
  useEffect(() => {
    if (finished || failed) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [finished, failed]);

  return (
    <div className="card overflow-hidden">
      <div className="h-1 bg-surface-2">
        <motion.div
          className="h-full bg-accent"
          animate={{ width: `${(done / steps.length) * 100}%` }}
          transition={{ type: "spring", stiffness: 80, damping: 20 }}
        />
      </div>
      <div className="flex items-center justify-between px-6 pt-5 text-sm text-muted">
        <span>{failed ? "Stopped" : finished ? "Finished" : "Working"}</span>
        <span className="font-mono tabular-nums">{((now - started) / 1000).toFixed(1)}s</span>
      </div>
      <ol className="space-y-1 p-4">
        {steps.map((step, i) => {
          const state = states[step.id] ?? { status: "waiting" };
          const detail = describe(step.id, state.detail);
          return (
            <motion.li
              key={step.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className={`flex items-start gap-4 rounded-xl px-3 py-3 transition-colors ${state.status === "running" ? "bg-accent-soft" : ""}`}
            >
              <Dot status={state.status} />
              <div className="min-w-0">
                <p className={`font-medium ${state.status === "waiting" ? "text-muted" : ""}`}>{step.label}</p>
                <AnimatePresence>
                  {detail && state.status === "done" && (
                    <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="text-sm text-muted">
                      {detail}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </motion.li>
          );
        })}
      </ol>
      {failed && <p className="border-t border-line px-6 py-4 text-sm text-negative">{failed}</p>}
    </div>
  );
}

function Dot({ status }: { status: StepState["status"] }) {
  return (
    <span className="relative mt-0.5 grid size-6 shrink-0 place-items-center">
      {status === "running" && <span className="absolute inset-0 animate-ping rounded-full bg-accent/40" />}
      <motion.span
        layout
        className={`relative grid size-6 place-items-center rounded-full border ${status === "done" ? "border-accent bg-accent text-white" : status === "running" ? "border-accent bg-surface" : "border-line bg-surface"}`}
      >
        {status === "done" && (
          <motion.svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <motion.path d="M5 12l5 5L19 7" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3 }} />
          </motion.svg>
        )}
        {status === "running" && <span className="size-2 rounded-full bg-accent" />}
      </motion.span>
    </span>
  );
}
