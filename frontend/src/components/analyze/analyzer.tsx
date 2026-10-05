"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import * as api from "@/lib/api";
import { guessColumns, parseCsv } from "@/lib/csv";
import { saveReport } from "@/lib/store";
import type { JobEvent, Step } from "@/lib/types";
import { Progress, type StepState } from "./progress";

type Mode = "sample" | "upload" | "paste";
type Server = "checking" | "ready" | "waking" | "down";

const MODES: { id: Mode; label: string }[] = [
  { id: "sample", label: "Sample data" },
  { id: "upload", label: "Upload CSV" },
  { id: "paste", label: "Paste text" },
];

const FALLBACK_SAMPLES = ["hearth-and-oak-reviews.csv"];

function useServer(): Server {
  const [state, setState] = useState<Server>("checking");
  useEffect(() => {
    let alive = true;
    let tries = 0;
    const check = async () => {
      try {
        await api.health();
        if (alive) setState("ready");
      } catch {
        tries++;
        if (!alive) return;
        // Free hosts sleep when idle. Keep knocking for about a minute.
        setState(tries > 12 ? "down" : "waking");
        if (tries <= 12) setTimeout(check, 5000);
      }
    };
    check();
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

export function Analyzer() {
  const router = useRouter();
  const server = useServer();
  const [mode, setMode] = useState<Mode>("sample");
  const [sampleList, setSampleList] = useState<string[]>(FALLBACK_SAMPLES);
  const [sample, setSample] = useState(FALLBACK_SAMPLES[0]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string[][]>([]);
  const [columns, setColumns] = useState<{ text?: string; date?: string; rating?: string }>({});
  const [pasted, setPasted] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<{ steps: Step[]; states: Record<string, StepState>; failed: string | null; notes: string[] } | null>(null);
  const stop = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (server !== "ready") return;
    api
      .samples()
      .then((s) => s.samples.length && setSampleList(s.samples))
      .catch(() => {});
  }, [server]);

  useEffect(() => () => stop.current?.(), []);

  const lines = pasted
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  async function choose(f: File | undefined) {
    setError(null);
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      setError("That file is larger than 5 MB. Split it or keep the most recent rows.");
      return;
    }
    const head = await f.slice(0, 256 * 1024).text();
    const rows = parseCsv(head, 7);
    if (rows.length < 2) {
      setError("That file has no rows under its header.");
      return;
    }
    setFile(f);
    setPreview(rows);
    setColumns(guessColumns(rows));
  }

  async function start() {
    setError(null);
    let started: api.Started;
    let name: string;
    try {
      if (mode === "sample") {
        started = await api.analyzeSample(sample);
        name = prettyName(sample);
      } else if (mode === "upload") {
        if (!file) return setError("Choose a CSV file first.");
        started = await api.analyzeFile(file, columns);
        name = prettyName(file.name);
      } else {
        if (lines.length < 10) return setError("Paste at least 10 pieces of feedback, one per line.");
        started = await api.analyzeTexts(lines);
        name = `Pasted feedback (${lines.length} lines)`;
      }
    } catch (e) {
      return setError(e instanceof Error ? e.message : String(e));
    }

    const { jobId, steps, notes } = started;
    setRun({ steps, states: {}, failed: null, notes });

    const onEvent = async (event: JobEvent) => {
      if (event.type === "step") {
        setRun((r) => r && { ...r, states: { ...r.states, [event.step]: { status: event.status, detail: event.detail } } });
      } else if (event.type === "error") {
        setRun((r) => r && { ...r, failed: event.message });
      } else {
        try {
          const result = await api.result(jobId);
          await saveReport({ id: jobId, name, createdAt: Date.now(), jobId, result });
          setTimeout(() => router.push(`/report/${jobId}`), 500);
        } catch (e) {
          setRun((r) => r && { ...r, failed: e instanceof Error ? e.message : String(e) });
        }
      }
    };
    stop.current = api.follow(jobId, onEvent, () =>
      setRun((r) => r && { ...r, failed: "The connection to the server dropped. Run the analysis again." }),
    );
  }

  if (run) {
    return (
      <div className="space-y-4">
        {run.notes.map((n) => (
          <p key={n} className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm text-muted">
            {n}
          </p>
        ))}
        <Progress steps={run.steps} states={run.states} failed={run.failed} />
        {run.failed && (
          <button type="button" onClick={() => setRun(null)} className="rounded-xl border border-line px-4 py-2 text-sm hover:bg-surface-2">
            Back
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="card p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div role="tablist" className="relative flex rounded-xl bg-surface-2 p-1 text-sm">
          {MODES.map((m) => (
            <button
              key={m.id}
              role="tab"
              type="button"
              aria-selected={mode === m.id}
              onClick={() => {
                setMode(m.id);
                setError(null);
              }}
              className={`relative rounded-lg px-4 py-2 transition-colors ${mode === m.id ? "text-ink" : "text-muted hover:text-ink"}`}
            >
              {mode === m.id && <motion.span layoutId="mode" className="absolute inset-0 rounded-lg bg-surface shadow-card" />}
              <span className="relative">{m.label}</span>
            </button>
          ))}
        </div>
        <ServerBadge state={server} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={mode} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} className="mt-8">
          {mode === "sample" && (
            <div className="space-y-3">
              {sampleList.map((s) => (
                <label key={s} className={`flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition-colors ${sample === s ? "border-accent bg-accent-soft" : "border-line hover:bg-surface-2"}`}>
                  <input type="radio" name="sample" className="mt-1 accent-[var(--accent)]" checked={sample === s} onChange={() => setSample(s)} />
                  <span>
                    <span className="font-medium">{prettyName(s)}</span>
                    <span className="mt-1 block text-sm text-muted">
                      1,400 reviews of an invented furniture shop over six months, with dates and star ratings. Watch for the week its app broke.
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}

          {mode === "upload" && (
            <div className="space-y-6">
              <Dropzone onFile={choose} file={file} />
              {preview.length > 1 && <ColumnPicker rows={preview} columns={columns} onChange={setColumns} />}
            </div>
          )}

          {mode === "paste" && (
            <div>
              <textarea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                rows={10}
                placeholder={"One piece of feedback per line, for example\nThe delivery was two weeks late and nobody replied to my emails\nLove the new dashboard, it saves me an hour a week"}
                className="w-full resize-y rounded-xl border border-line bg-surface-2 p-4 text-sm outline-none focus:border-accent"
              />
              <p className="mt-2 text-sm text-muted">{lines.length} lines. At least 10 are needed, and up to 20,000 are read.</p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {error && <p className="mt-6 rounded-xl bg-negative/10 px-4 py-3 text-sm text-negative">{error}</p>}

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={start}
          disabled={server !== "ready"}
          className="rounded-xl bg-accent px-6 py-3 font-medium text-white shadow-card transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Run analysis
        </button>
        <p className="text-sm text-muted">Usually takes 5 to 20 seconds.</p>
      </div>
    </div>
  );
}

function prettyName(file: string) {
  const base = file.replace(/\.csv$/i, "").replace(/[_-]+/g, " ");
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function ServerBadge({ state }: { state: Server }) {
  const text = { checking: "Checking server", ready: "Server ready", waking: "Waking the server", down: "Server unavailable" }[state];
  const color = { checking: "bg-neutral", ready: "bg-positive", waking: "bg-amber-500", down: "bg-negative" }[state];
  return (
    <span className="flex items-center gap-2 text-sm text-muted" title={state === "down" ? "Try the demo report instead, it needs no server." : undefined}>
      <span className={`size-2 rounded-full ${color} ${state === "waking" || state === "checking" ? "animate-pulse" : ""}`} />
      {text}
    </span>
  );
}

function Dropzone({ onFile, file }: { onFile: (f: File | undefined) => void; file: File | null }) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFile(e.dataTransfer.files[0]);
      }}
      onClick={() => input.current?.click()}
      className={`grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors ${over ? "border-accent bg-accent-soft" : "border-line hover:bg-surface-2"}`}
    >
      <input ref={input} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-accent" aria-hidden>
        <path d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {file ? (
        <p className="mt-3 font-medium">
          {file.name} <span className="text-muted">({(file.size / 1024).toFixed(0)} KB)</span>
        </p>
      ) : (
        <p className="mt-3 font-medium">Drop a CSV here or click to choose</p>
      )}
      <p className="mt-1 text-sm text-muted">Up to 5 MB. Any delimiter. One column must hold the feedback text.</p>
    </div>
  );
}

function ColumnPicker({
  rows,
  columns,
  onChange,
}: {
  rows: string[][];
  columns: { text?: string; date?: string; rating?: string };
  onChange: (c: { text?: string; date?: string; rating?: string }) => void;
}) {
  const [header, ...body] = rows;
  const fields = [
    { key: "text" as const, label: "Feedback text", optional: false },
    { key: "date" as const, label: "Date", optional: true },
    { key: "rating" as const, label: "Rating", optional: true },
  ];
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {fields.map((f) => (
          <label key={f.key} className="text-sm">
            <span className="text-muted">{f.label}</span>
            <select
              value={columns[f.key] ?? ""}
              onChange={(e) => onChange({ ...columns, [f.key]: e.target.value || undefined })}
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none focus:border-accent"
            >
              {f.optional && <option value="">None</option>}
              {header.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-2 text-muted">
            <tr>
              {header.map((h) => (
                <th key={h} className={`px-3 py-2 font-medium ${h === columns.text ? "text-accent" : ""}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((r, i) => (
              <tr key={i} className="border-t border-line">
                {header.map((h, j) => (
                  <td key={h} className={`max-w-xs truncate px-3 py-2 ${h === columns.text ? "" : "text-muted"}`}>
                    {r[j]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
