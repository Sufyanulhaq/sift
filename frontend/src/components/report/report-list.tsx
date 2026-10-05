"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { ago } from "@/lib/format";
import { deleteReport, listReports } from "@/lib/store";
import type { StoredReport } from "@/lib/types";

export function ReportList() {
  const [reports, setReports] = useState<StoredReport[] | null>(null);
  useEffect(() => {
    listReports()
      .then(setReports)
      .catch(() => setReports([]));
  }, []);

  if (reports === null) return <div className="h-24 animate-pulse rounded-2xl bg-surface-2" />;
  if (!reports.length)
    return (
      <div className="card p-10 text-center">
        <p className="font-medium">No reports yet</p>
        <p className="mt-2 text-sm text-muted">Run an analysis and it will appear here.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/analyze" className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white">
            Analyse feedback
          </Link>
          <Link href="/report/sample" className="rounded-xl border border-line px-5 py-2.5 text-sm">
            Open the demo
          </Link>
        </div>
      </div>
    );

  return (
    <ul className="space-y-3">
      <AnimatePresence>
        {reports.map((r) => (
          <motion.li key={r.id} layout exit={{ opacity: 0, x: -20 }} className="card flex items-center gap-4 p-4">
            <Link href={`/report/${r.id}`} className="min-w-0 flex-1">
              <p className="truncate font-medium hover:text-accent">{r.name}</p>
              <p className="mt-1 text-xs text-muted">
                {r.result.meta.rows.toLocaleString("en")} rows, {r.result.topics.length} topics, {Math.round(r.result.overview.negative * 100)}% negative · {ago(r.createdAt)}
              </p>
            </Link>
            <button
              type="button"
              onClick={async () => {
                await deleteReport(r.id);
                setReports((list) => list?.filter((x) => x.id !== r.id) ?? null);
              }}
              className="rounded-lg px-3 py-1.5 text-sm text-muted hover:bg-negative/10 hover:text-negative"
            >
              Delete
            </button>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
