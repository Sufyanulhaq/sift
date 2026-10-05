"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { getReport, renameReport } from "@/lib/store";
import type { Result, Review, StoredReport } from "@/lib/types";
import { Drivers } from "./drivers";
import { Explorer } from "./explorer";
import { ExportMenu } from "./export-menu";
import { Kpis } from "./kpis";
import { Summary } from "./summary";
import { TopicList } from "./topic-list";
import { TopicMap } from "./topic-map";
import { Trends } from "./trends";

async function load(id: string): Promise<StoredReport | null> {
  if (id === "sample") {
    const res = await fetch("/sample-report.json");
    if (!res.ok) return null;
    const result = (await res.json()) as Result;
    return { id, name: "Hearth & Oak reviews (demo)", createdAt: 0, jobId: null, result };
  }
  return (await getReport(id)) ?? null;
}

export function ReportView({ id }: { id: string }) {
  const [report, setReport] = useState<StoredReport | null | undefined>(undefined);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    load(id)
      .then(setReport)
      .catch(() => setReport(null));
  }, [id]);

  const byId = useMemo(() => new Map<number, Review>(report?.result.reviews.map((r) => [r.id, r]) ?? []), [report]);

  if (report === undefined) return <Skeleton />;
  if (report === null)
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold">Report not found</h1>
        <p className="mt-3 text-muted">Reports are saved only in the browser that ran them. It may have been cleared, or opened on another device.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/analyze" className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white">
            Run an analysis
          </Link>
          <Link href="/report/sample" className="rounded-xl border border-line px-5 py-2.5 text-sm">
            Open the demo
          </Link>
        </div>
      </div>
    );

  const { result } = report;
  const select = (t: number | null) => setSelected(t);

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <Title report={report} onRename={(name) => setReport({ ...report, name })} />
          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
            <span>{result.meta.rows.toLocaleString("en")} rows</span>
            <span>sentiment: {result.meta.sentimentModel.startsWith("trained") ? "trained classifier" : "VADER"}</span>
            <span>meaning: {result.meta.embedder === "minilm" ? "MiniLM" : "LSA"}</span>
            <span>clustering: {result.meta.clustering.toUpperCase()}</span>
            <span>{result.meta.seconds.toFixed(1)}s</span>
          </p>
        </div>
        <ExportMenu report={report} />
      </motion.header>

      {result.meta.notes.length > 0 && (
        <div className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm text-muted">
          {result.meta.notes.map((n) => (
            <p key={n}>{n}</p>
          ))}
        </div>
      )}

      <Kpis result={result} />
      <Summary result={result} byId={byId} />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold">Topic map</h2>
              <p className="mt-1 text-sm text-muted">Each dot is one review. Close dots say similar things. Click a group to focus it.</p>
            </div>
            {selected !== null && (
              <button type="button" onClick={() => setSelected(null)} className="text-sm text-accent">
                Show all
              </button>
            )}
          </div>
          <div className="mt-4">
            <TopicMap result={result} selected={selected} onSelect={select} />
          </div>
        </section>
        <section className="card p-4">
          <h2 className="px-3 pt-2 font-semibold">Topics</h2>
          <p className="px-3 pb-3 text-xs text-muted">Mood score and share of feedback</p>
          <TopicList result={result} byId={byId} selected={selected} onSelect={select} />
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Drivers result={result} onSelect={select} />
        <Trends result={result} selected={selected} onSelect={select} />
      </div>

      <Explorer result={result} jobId={report.jobId} topic={selected} onTopic={select} />
    </main>
  );
}

function Title({ report, onRename }: { report: StoredReport; onRename: (name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(report.name);
  if (report.id === "sample") return <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{report.name}</h1>;
  if (editing)
    return (
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const name = value.trim() || report.name;
          await renameReport(report, name);
          onRename(name);
          setEditing(false);
        }}
      >
        <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} onBlur={() => setEditing(false)} className="w-full rounded-lg border border-accent bg-surface px-2 text-2xl font-semibold outline-none" />
      </form>
    );
  return (
    <button type="button" onClick={() => setEditing(true)} title="Rename" className="text-left text-2xl font-semibold tracking-tight hover:text-accent sm:text-3xl">
      {report.name}
    </button>
  );
}

function Skeleton() {
  return (
    <main className="mx-auto max-w-7xl animate-pulse space-y-6 px-4 py-8 sm:px-6">
      <div className="h-9 w-80 rounded-lg bg-surface-2" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-surface-2" />
        ))}
      </div>
      <div className="h-40 rounded-2xl bg-surface-2" />
      <div className="h-96 rounded-2xl bg-surface-2" />
    </main>
  );
}
