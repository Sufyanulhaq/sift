"use client";

import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { shortDate, topicColor } from "@/lib/format";
import type { Result } from "@/lib/types";

const W = 640;
const H = 240;
const L = 36;
const R = 24;
const T = 16;
const B = 28;

type View = "volume" | "mood";

export function Trends({ result, selected, onSelect }: { result: Result; selected: number | null; onSelect: (id: number | null) => void }) {
  const trends = result.trends;
  const [view, setView] = useState<View>("volume");
  const [hoverWeek, setHoverWeek] = useState<number | null>(null);
  const names = useMemo(() => new Map(result.topics.map((t) => [t.id, t.name])), [result.topics]);

  if (!trends || trends.weeks.length < 2) {
    return (
      <section className="card p-6">
        <h2 className="font-semibold">Trends</h2>
        <p className="mt-2 text-sm text-muted">This data has no readable dates, so there is nothing to chart over time. Include a date column to see weekly trends and spikes.</p>
      </section>
    );
  }

  const n = trends.weeks.length;
  const x = (i: number) => L + (i / (n - 1)) * (W - L - R);
  const shown = selected !== null ? [selected] : result.topics.slice(0, 6).map((t) => t.id);
  const series = shown.map((id) => ({ id, values: trends.series[String(id)] ?? [] }));
  const maxCount = Math.max(1, ...series.flatMap((s) => s.values));
  const yCount = (v: number) => T + (1 - v / maxCount) * (H - T - B);
  const yMood = (v: number) => T + ((1 - v) / 2) * (H - T - B);
  const line = (values: number[], y: (v: number) => number) => values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const spikes = trends.spikes.filter((s) => selected === null || s.topic === selected);
  const ticks = view === "volume" ? [0, Math.round(maxCount / 2), maxCount] : [1, 0, -1];

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Trends by week</h2>
          <p className="mt-1 text-sm text-muted">
            {spikes.length ? `${spikes.length} unusual spike${spikes.length > 1 ? "s" : ""} found, marked in red.` : "No unusual spikes found."}
          </p>
        </div>
        <div className="flex rounded-lg bg-surface-2 p-0.5 text-xs">
          {(["volume", "mood"] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1.5 ${view === v ? "bg-surface text-ink shadow-card" : "text-muted"}`}
            >
              {v === "volume" ? "Volume" : "Mood"}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" onPointerLeave={() => setHoverWeek(null)}>
          {ticks.map((t) => {
            const y = view === "volume" ? yCount(t) : yMood(t);
            return (
              <g key={t}>
                <line x1={L} x2={W - R} y1={y} y2={y} stroke="var(--border)" strokeDasharray={t === 0 && view === "mood" ? "" : "3 4"} />
                <text x={L - 8} y={y} textAnchor="end" dominantBaseline="middle" fontSize="10" fill="var(--muted)">
                  {view === "mood" && t > 0 ? `+${t}` : t}
                </text>
              </g>
            );
          })}
          {trends.weeks.map((w, i) =>
            i % Math.ceil(n / 6) === 0 ? (
              <text key={w} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--muted)">
                {shortDate(w)}
              </text>
            ) : null,
          )}

          {view === "volume" ? (
            series.map((s) => (
              <motion.path
                key={`${s.id}${view}`}
                d={line(s.values, yCount)}
                fill="none"
                stroke={topicColor(s.id)}
                strokeWidth={selected === s.id ? 2.5 : 1.8}
                strokeLinejoin="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1.2, ease: "easeInOut" }}
              />
            ))
          ) : (
            <motion.path
              key="mood"
              d={line(trends.sentiment, yMood)}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={2.2}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.2, ease: "easeInOut" }}
            />
          )}

          {view === "volume" &&
            spikes.map((s) => {
              const i = trends.weeks.indexOf(s.week);
              if (i < 0) return null;
              return (
                <motion.g key={`${s.topic}${s.week}`} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.2, type: "spring" }} style={{ originX: `${x(i)}px`, originY: `${yCount(s.count)}px` }}>
                  <circle cx={x(i)} cy={yCount(s.count)} r={9} fill="var(--negative)" opacity={0.18} />
                  <circle cx={x(i)} cy={yCount(s.count)} r={4} fill="var(--negative)" stroke="var(--surface)" strokeWidth={1.5} />
                </motion.g>
              );
            })}

          {trends.weeks.map((w, i) => (
            <rect key={w} x={x(i) - (W - L - R) / (n - 1) / 2} y={T} width={(W - L - R) / (n - 1)} height={H - T - B} fill="transparent" onPointerEnter={() => setHoverWeek(i)} />
          ))}
          {hoverWeek !== null && <line x1={x(hoverWeek)} x2={x(hoverWeek)} y1={T} y2={H - B} stroke="var(--muted)" strokeOpacity={0.4} pointerEvents="none" />}
        </svg>

        {hoverWeek !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 w-52 rounded-xl border border-line bg-surface p-3 text-xs shadow-card"
            style={{ left: `${(x(hoverWeek) / W) * 100}%`, transform: `translateX(${hoverWeek > n / 2 ? "-105%" : "5%"})` }}
          >
            <p className="font-medium">Week of {shortDate(trends.weeks[hoverWeek])}</p>
            {view === "mood" ? (
              <p className="mt-1 text-muted">Average mood {trends.sentiment[hoverWeek].toFixed(2)}</p>
            ) : (
              series.map((s) => (
                <p key={s.id} className="mt-1 flex justify-between gap-2 text-muted">
                  <span className="truncate">
                    <span className="mr-1.5 inline-block size-2 rounded-full" style={{ background: topicColor(s.id) }} />
                    {names.get(s.id)}
                  </span>
                  <span className="tabular-nums text-ink">{s.values[hoverWeek]}</span>
                </p>
              ))
            )}
            {spikes
              .filter((s) => s.week === trends.weeks[hoverWeek])
              .map((s) => (
                <p key={s.topic} className="mt-2 text-negative">
                  Spike in {names.get(s.topic)}: {s.count} against a usual {s.usual}
                </p>
              ))}
          </div>
        )}
      </div>

      {view === "volume" && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {series.map((s) => (
            <button key={s.id} type="button" onClick={() => onSelect(selected === s.id ? null : s.id)} className="flex items-center gap-1.5 hover:text-ink">
              <span className="size-2 rounded-full" style={{ background: topicColor(s.id) }} />
              {names.get(s.id)}
            </button>
          ))}
          {selected !== null && (
            <button type="button" onClick={() => onSelect(null)} className="underline underline-offset-2 hover:text-ink">
              Show top topics
            </button>
          )}
        </div>
      )}

      {spikes.length > 0 && (
        <ul className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
          {spikes.slice(0, 4).map((s) => (
            <li key={`${s.topic}${s.week}`} className="flex items-start gap-3">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-negative" />
              <span>
                <button type="button" className="font-medium hover:text-accent" onClick={() => onSelect(s.topic)}>
                  {names.get(s.topic)}
                </button>{" "}
                jumped to {s.count} mentions in the week of {shortDate(s.week)}, against a usual {s.usual}.
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
