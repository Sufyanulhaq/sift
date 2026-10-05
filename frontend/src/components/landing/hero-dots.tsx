"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useMemo, useRef } from "react";
import { TOPIC_COLORS } from "@/lib/format";

gsap.registerPlugin(useGSAP);

const COUNT = 180;
const CLUSTERS = [
  { x: 22, y: 30 },
  { x: 70, y: 22 },
  { x: 48, y: 58 },
  { x: 82, y: 66 },
  { x: 18, y: 74 },
];

// A small seeded random so server and browser draw the same dots.
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

/** Loose feedback drifting in, then sorting itself into topics. */
export function HeroDots() {
  const root = useRef<SVGSVGElement>(null);
  const dots = useMemo(() => {
    const r = rng(42);
    return Array.from({ length: COUNT }, (_, i) => {
      const c = i % CLUSTERS.length;
      const angle = r() * Math.PI * 2;
      const dist = Math.sqrt(r()) * 9;
      return {
        c,
        sx: r() * 100,
        sy: r() * 100,
        tx: CLUSTERS[c].x + Math.cos(angle) * dist * 1.3,
        ty: CLUSTERS[c].y + Math.sin(angle) * dist,
      };
    });
  }, []);

  useGSAP(
    () => {
      const els = gsap.utils.toArray<SVGCircleElement>(".hero-dot");
      gsap.set(els, { attr: { fill: "var(--muted)" }, opacity: 0.35 });
      gsap.utils.toArray<SVGCircleElement>(".hero-ring").forEach((ring, i) => {
        gsap.set(ring, { svgOrigin: `${CLUSTERS[i].x} ${CLUSTERS[i].y}`, scale: 0.6, opacity: 0 });
      });
      const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.2, delay: 0.4 });
      tl.to(els, {
        attr: { cx: (i: number) => dots[i].tx, cy: (i: number) => dots[i].ty, fill: (i: number) => TOPIC_COLORS[dots[i].c] },
        opacity: 0.85,
        duration: 1.8,
        ease: "expo.inOut",
        stagger: { amount: 0.6, from: "random" },
      })
        .to(".hero-ring", { opacity: 1, scale: 1, duration: 0.6, stagger: 0.1, ease: "back.out(2)" }, "-=0.3")
        .to({}, { duration: 2.4 })
        .to(".hero-ring", { opacity: 0, scale: 0.6, duration: 0.4 })
        .to(els, {
          attr: { cx: (i: number) => dots[i].sx, cy: (i: number) => dots[i].sy, fill: "var(--muted)" },
          opacity: 0.35,
          duration: 1.6,
          ease: "power2.inOut",
          stagger: { amount: 0.4, from: "random" },
        });
    },
    { scope: root },
  );

  return (
    <svg ref={root} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" className="h-full w-full" aria-hidden>
      {CLUSTERS.map((c, i) => (
        <circle
          key={i}
          className="hero-ring"
          cx={c.x}
          cy={c.y}
          r={15}
          fill="none"
          stroke={TOPIC_COLORS[i]}
          strokeOpacity={0.4}
          strokeDasharray="1.5 1.5"
          strokeWidth={0.3}
          opacity={0}
        />
      ))}
      {dots.map((d, i) => (
        <circle key={i} className="hero-dot" cx={d.sx} cy={d.sy} r={0.9} />
      ))}
    </svg>
  );
}
