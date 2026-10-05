"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useMemo, useRef, useState } from "react";
import { topicColor } from "@/lib/format";
import type { Result, Review } from "@/lib/types";

gsap.registerPlugin(useGSAP);

const PAD = 4;
const W = 100;
const H = 62;
const px = (x: number) => PAD + x * (W - PAD * 2);
const py = (y: number) => PAD + y * (H - PAD * 2);

/** Every review placed by meaning: close dots say similar things. */
export function TopicMap({ result, selected, onSelect }: { result: Result; selected: number | null; onSelect: (id: number | null) => void }) {
  const svg = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ review: Review; left: number; top: number } | null>(null);
  const names = useMemo(() => new Map(result.topics.map((t) => [t.id, t.name])), [result.topics]);

  const centres = useMemo(
    () =>
      result.topics.map((t) => {
        const members = result.reviews.filter((r) => r.topic === t.id);
        const x = members.reduce((s, r) => s + r.x, 0) / Math.max(1, members.length);
        const y = members.reduce((s, r) => s + r.y, 0) / Math.max(1, members.length);
        return { id: t.id, name: t.name, x: px(x), y: py(y) };
      }),
    [result],
  );

  useGSAP(
    () => {
      // Dots fly in from the centre, then the labels fade in (see .map-label).
      gsap.from(".dot", {
        attr: { cx: W / 2, cy: H / 2, r: 0 },
        duration: 1.1,
        ease: "expo.out",
        stagger: { amount: 0.8, from: "random" },
      });
    },
    { scope: svg, dependencies: [result] },
  );

  function move(e: React.PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * W;
    const y = ((e.clientY - box.top) / box.height) * H;
    let best: Review | null = null;
    let dist = 2.2 ** 2;
    for (const r of result.reviews) {
      const d = (px(r.x) - x) ** 2 + (py(r.y) - y) ** 2;
      if (d < dist) {
        dist = d;
        best = r;
      }
    }
    setHover(best ? { review: best, left: (px(best.x) / W) * box.width, top: (py(best.y) / H) * box.height } : null);
  }

  return (
    <div className="relative">
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none select-none"
        onPointerMove={move}
        onPointerLeave={() => setHover(null)}
        onClick={() => (hover ? onSelect(hover.review.topic === selected ? null : hover.review.topic) : onSelect(null))}
        role="img"
        aria-label="Map of reviews grouped by topic"
      >
        {result.reviews.map((r) => {
          const dim = selected !== null && r.topic !== selected;
          return (
            <circle
              key={r.id}
              className="dot"
              cx={px(r.x)}
              cy={py(r.y)}
              r={hover?.review.id === r.id ? 1.1 : 0.55}
              fill={topicColor(r.topic)}
              opacity={dim ? 0.08 : r.topic < 0 ? 0.35 : 0.75}
              style={{ transition: "opacity 300ms" }}
            />
          );
        })}
        {centres.map((c) => (
          <g
            key={c.id}
            className="map-label cursor-pointer"
            opacity={selected !== null && selected !== c.id ? 0.25 : 1}
            style={{ transition: "opacity 300ms", animationDelay: `${1 + c.id * 0.06}s` }}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(selected === c.id ? null : c.id);
            }}
          >
            <text x={c.x} y={c.y} textAnchor="middle" dominantBaseline="middle" fontSize="1.8" fontWeight="600" stroke="var(--surface)" strokeWidth="0.7" paintOrder="stroke" fill="var(--text)">
              {c.name}
            </text>
          </g>
        ))}
      </svg>
      {hover && (
        <div
          className="pointer-events-none absolute z-20 w-64 -translate-x-1/2 rounded-xl border border-line bg-surface p-3 text-sm shadow-card"
          style={{ left: hover.left, top: hover.top + 14 }}
        >
          <p className="flex items-center gap-2 text-xs text-muted">
            <span className="size-2 rounded-full" style={{ background: topicColor(hover.review.topic) }} />
            {names.get(hover.review.topic) ?? "No topic"}
          </p>
          <p className="mt-1 line-clamp-4">{hover.review.text}</p>
        </div>
      )}
    </div>
  );
}
