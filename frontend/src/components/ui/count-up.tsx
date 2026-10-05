"use client";

import { animate, useInView } from "motion/react";
import { useEffect, useRef } from "react";

export function CountUp({ value, format = (v) => Math.round(v).toLocaleString("en"), duration = 1.1 }: { value: number; format?: (v: number) => string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    const el = ref.current;
    if (!el || !inView) return;
    const controls = animate(0, value, { duration, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => (el.textContent = format(v)) });
    return () => controls.stop();
  }, [inView, value, duration, format]);
  return <span ref={ref}>{format(0)}</span>;
}
